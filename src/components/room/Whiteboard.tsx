'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { ColorField } from '@/components/common/ColorField';
import { BoardStroke } from '@/types';
import { Pencil, Eraser, Minus, Square, Circle, Undo2, Trash2, Download, Hand, ZoomIn, ZoomOut, BoxSelect, Copy, ClipboardPaste, Check, X } from 'lucide-react';

/** Ferramentas de desenho + "mover" + "selecionar" (copiar e colar trecho igual no Paint) */
type Tool = BoardStroke['tool'] | 'hand' | 'select';

const ASPECT = 16 / 10;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const COLORS = ['#111827', '#ef4444', '#f59e0b', '#10b981', '#2563eb', '#8b5cf6', '#ec4899'];
// Cores livres que a pessoa já usou (guardadas só neste aparelho)
const MAX_CUSTOM_COLORS = 5;
const CUSTOM_COLORS_KEY = 'mesa_board_colors';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const RAINBOW = 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)';
const SIZES = [
  { value: 3, label: 'Traço fino', dot: 'w-1.5 h-1.5' },
  { value: 6, label: 'Traço médio', dot: 'w-2.5 h-2.5' },
  { value: 12, label: 'Traço grosso', dot: 'w-4 h-4' },
];
const TOOLS: { id: Tool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'pen', label: 'Pincel', icon: Pencil },
  { id: 'eraser', label: 'Borracha', icon: Eraser },
  { id: 'line', label: 'Linha', icon: Minus },
  { id: 'rect', label: 'Retângulo', icon: Square },
  { id: 'ellipse', label: 'Elipse', icon: Circle },
  { id: 'select', label: 'Selecionar e copiar trecho (igual Paint)', icon: BoxSelect },
  { id: 'hand', label: 'Mover a lousa (com zoom)', icon: Hand },
];

function drawStroke(ctx: CanvasRenderingContext2D, stroke: BoardStroke, width: number, height: number) {
  const p = stroke.points;
  if (p.length < 2) return;
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
  ctx.fillStyle = ctx.strokeStyle;
  // A espessura acompanha o tamanho da lousa, para o desenho ficar igual em qualquer tela
  ctx.lineWidth = Math.max(1, stroke.size * (width / 1000));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const x = (i: number) => p[i] * width;
  const y = (i: number) => p[i + 1] * height;

  if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
    if (p.length === 2) {
      ctx.beginPath();
      ctx.arc(x(0), y(0), ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    for (let i = 2; i < p.length - 2; i += 2) {
      // Curva passando pelo ponto médio: tira o serrilhado do traço à mão
      ctx.quadraticCurveTo(x(i), y(i), (x(i) + x(i + 2)) / 2, (y(i) + y(i + 2)) / 2);
    }
    ctx.lineTo(x(p.length - 2), y(p.length - 2));
    ctx.stroke();
    return;
  }

  if (p.length < 4) return;
  ctx.beginPath();
  if (stroke.tool === 'line') {
    ctx.moveTo(x(0), y(0));
    ctx.lineTo(x(2), y(2));
  } else if (stroke.tool === 'rect') {
    ctx.rect(Math.min(x(0), x(2)), Math.min(y(0), y(2)), Math.abs(x(2) - x(0)), Math.abs(y(2) - y(0)));
  } else {
    ctx.ellipse((x(0) + x(2)) / 2, (y(0) + y(2)) / 2, Math.abs(x(2) - x(0)) / 2, Math.abs(y(2) - y(0)) / 2, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}

export function Whiteboard() {
  const { board, myRole, isPunished } = useMesa();
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [size, setSize] = useState(6);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectionBox, setSelectionBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [pasteOffset, setPasteOffset] = useState<{ dx: number; dy: number } | null>(null);

  const selectionRef = useRef<{ x0: number; y0: number; x1: number; y1: number; dragging: boolean } | null>(null);
  const clipboardRef = useRef<{
    strokes: Array<{ tool: BoardStroke['tool']; color: string; size: number; points: number[] }>;
    box: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const pasteDragRef = useRef<{ startPt: [number, number]; startDx: number; startDy: number } | null>(null);
  const pasteOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  // Visão atual: escala e o canto superior esquerdo visível (em coordenadas da lousa, 0 a 1)
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ distance: number; scale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef<{
    info: Omit<BoardStroke, 'points' | 'userId'>;
    start: [number, number];
    last: [number, number];
    buffer: number[];
    flush: number | null;
  } | null>(null);

  const canClearAll = myRole === 'owner' || myRole === 'admin';

  const redraw = () => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const view = viewRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(view.scale, 0, 0, view.scale, -view.x * canvas.width * view.scale, -view.y * canvas.height * view.scale);
      for (const stroke of board.getStrokes()) drawStroke(ctx, stroke, canvas.width, canvas.height);

      // Pré-visualização de cola (arrastável antes de confirmar)
      const pOff = pasteOffsetRef.current;
      const clip = clipboardRef.current;
      if (pOff && clip) {
        for (const s of clip.strokes) {
          const shifted: number[] = [];
          for (let i = 0; i < s.points.length; i += 2) {
            shifted.push(s.points[i] + pOff.dx, s.points[i + 1] + pOff.dy);
          }
          drawStroke(ctx, { id: 'preview', userId: '', ...s, points: shifted }, canvas.width, canvas.height);
        }
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = Math.max(1.5, 2 / view.scale);
        ctx.strokeRect(
          (clip.box.x + pOff.dx) * canvas.width,
          (clip.box.y + pOff.dy) * canvas.height,
          clip.box.w * canvas.width,
          clip.box.h * canvas.height
        );
        ctx.restore();
      }

      // Caixa de seleção tracejada estilo Paint
      const sel = selectionRef.current;
      if (sel) {
        const sx = Math.min(sel.x0, sel.x1) * canvas.width;
        const sy = Math.min(sel.y0, sel.y1) * canvas.height;
        const sw = Math.abs(sel.x1 - sel.x0) * canvas.width;
        const sh = Math.abs(sel.y1 - sel.y0) * canvas.height;
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#3044f0';
        ctx.fillStyle = 'rgba(48, 68, 240, 0.08)';
        ctx.lineWidth = Math.max(1.5, 2 / view.scale);
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.restore();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    });
  };

  /** Aplica uma nova visão sem deixar sair da lousa */
  const setView = (scale: number, x: number, y: number) => {
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
    const max = 1 - 1 / s;
    viewRef.current = { scale: s, x: Math.max(0, Math.min(max, x)), y: Math.max(0, Math.min(max, y)) };
    setZoom(s);
    redraw();
  };

  /** Dá zoom mantendo parado o ponto (fx, fy) da tela — 0 a 1 dentro da lousa visível */
  const zoomAt = (scale: number, fx = 0.5, fy = 0.5) => {
    const view = viewRef.current;
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
    const boardX = view.x + fx / view.scale;
    const boardY = view.y + fy / view.scale;
    setView(s, boardX - fx / s, boardY - fy / s);
  };

  // Cores livres usadas antes neste aparelho
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || '[]');
      if (Array.isArray(saved)) {
        setCustomColors(
          saved
            .filter((c): c is string => typeof c === 'string' && HEX_COLOR.test(c))
            .map((c) => c.toLowerCase())
            .slice(0, MAX_CUSTOM_COLORS)
        );
      }
    } catch {}
  }, []);

  /** Escolher uma cor volta para o pincel se a borracha ou a mão estavam ativas */
  const pickColor = (value: string) => {
    setColor(value.toLowerCase());
    if (tool === 'eraser' || tool === 'hand') setTool('pen');
  };

  /** Guarda a cor livre usada num traço, para dar para voltar a ela com um clique */
  const rememberColor = (value: string) => {
    if (COLORS.includes(value) || customColors[0] === value) return;
    const next = [value, ...customColors.filter((c) => c !== value)].slice(0, MAX_CUSTOM_COLORS);
    setCustomColors(next);
    try {
      localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(next));
    } catch {}
  };

  // Redesenha quando qualquer pessoa da sala desenha
  useEffect(() => {
    const unsubscribe = board.subscribe(redraw);
    redraw();
    return () => {
      unsubscribe();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // Mantém a proporção fixa dentro do espaço disponível
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const width = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight * ASPECT));
      setBoardSize({ width, height: Math.floor(width / ASPECT) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !boardSize.width) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(boardSize.width * ratio);
    canvas.height = Math.round(boardSize.height * ratio);
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize.width, boardSize.height]);

  // Roda do mouse dá zoom no ponto onde está o cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAt(viewRef.current.scale * factor, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Posição do ponteiro em coordenadas da lousa (0 a 1), já descontando zoom e deslocamento */
  const position = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const view = viewRef.current;
    return [
      Math.max(0, Math.min(1, view.x + (e.clientX - rect.left) / rect.width / view.scale)),
      Math.max(0, Math.min(1, view.y + (e.clientY - rect.top) / rect.height / view.scale)),
    ];
  };

  const flush = (done: boolean) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    if (drawing.flush) cancelAnimationFrame(drawing.flush);
    drawing.flush = null;
    const freehand = drawing.info.tool === 'pen' || drawing.info.tool === 'eraser';
    if (freehand) {
      if (drawing.buffer.length || done) board.draw(drawing.info, drawing.buffer, done);
      drawing.buffer = [];
    } else {
      board.draw(drawing.info, [...drawing.start, ...drawing.last], done);
    }
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    flush(true);
    drawingRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Dois dedos: pinça para zoom (e encerra qualquer traço em andamento)
    if (pointersRef.current.size === 2) {
      finishStroke();
      panRef.current = null;
      const [a, b] = Array.from(pointersRef.current.values());
      gestureRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: viewRef.current.scale };
      return;
    }

    if (tool === 'hand') {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const point = position(e);

    // Arrastar trecho colado antes de confirmar
    if (pasteOffsetRef.current && clipboardRef.current) {
      pasteDragRef.current = {
        startPt: point,
        startDx: pasteOffsetRef.current.dx,
        startDy: pasteOffsetRef.current.dy,
      };
      return;
    }

    if (tool === 'select') {
      selectionRef.current = { x0: point[0], y0: point[1], x1: point[0], y1: point[1], dragging: true };
      setSelectionBox(null);
      redraw();
      return;
    }

    if (isPunished) return;

    if (tool !== 'eraser') rememberColor(color);
    drawingRef.current = {
      info: {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        tool,
        color,
        size: tool === 'eraser' ? size * 4 : size,
      },
      start: point,
      last: point,
      buffer: [...point],
      flush: null,
    };
    flush(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const gesture = gestureRef.current;
    if (gesture && pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zoomAt(
        gesture.scale * (distance / gesture.distance),
        ((a.x + b.x) / 2 - rect.left) / rect.width,
        ((a.y + b.y) / 2 - rect.top) / rect.height
      );
      return;
    }

    if (panRef.current) {
      const view = viewRef.current;
      const dx = (e.clientX - panRef.current.x) / rect.width / view.scale;
      const dy = (e.clientY - panRef.current.y) / rect.height / view.scale;
      panRef.current = { x: e.clientX, y: e.clientY };
      setView(view.scale, view.x - dx, view.y - dy);
      return;
    }

    const point = position(e);

    if (pasteDragRef.current && pasteOffsetRef.current) {
      const next = {
        dx: pasteDragRef.current.startDx + (point[0] - pasteDragRef.current.startPt[0]),
        dy: pasteDragRef.current.startDy + (point[1] - pasteDragRef.current.startPt[1]),
      };
      pasteOffsetRef.current = next;
      setPasteOffset(next);
      redraw();
      return;
    }

    if (selectionRef.current?.dragging) {
      selectionRef.current.x1 = point[0];
      selectionRef.current.y1 = point[1];
      redraw();
      return;
    }

    const drawing = drawingRef.current;
    if (!drawing) return;
    const minStep = 0.002 / viewRef.current.scale;
    if (Math.abs(point[0] - drawing.last[0]) + Math.abs(point[1] - drawing.last[1]) < minStep) return;
    drawing.last = point;
    drawing.buffer.push(...point);
    // Junta os pontos e manda no máximo uma vez por quadro
    if (!drawing.flush) drawing.flush = requestAnimationFrame(() => flush(false));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) gestureRef.current = null;
    panRef.current = null;
    pasteDragRef.current = null;
    if (selectionRef.current?.dragging) {
      selectionRef.current.dragging = false;
      const { x0, y0, x1, y1 } = selectionRef.current;
      if (Math.abs(x1 - x0) > 0.01 && Math.abs(y1 - y0) > 0.01) {
        setSelectionBox({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) });
      } else {
        selectionRef.current = null;
        setSelectionBox(null);
      }
      redraw();
    }
    finishStroke();
  };

  const copySelection = () => {
    const sel = selectionBox;
    if (!sel) return;
    const picked: Array<{ tool: BoardStroke['tool']; color: string; size: number; points: number[] }> = [];
    for (const s of board.getStrokes()) {
      let inside = false;
      for (let i = 0; i < s.points.length; i += 2) {
        const px = s.points[i];
        const py = s.points[i + 1];
        if (px >= sel.x0 && px <= sel.x1 && py >= sel.y0 && py <= sel.y1) {
          inside = true;
          break;
        }
      }
      if (inside) picked.push({ tool: s.tool, color: s.color, size: s.size, points: [...s.points] });
    }
    if (picked.length === 0) return;
    clipboardRef.current = {
      strokes: picked,
      box: { x: sel.x0, y: sel.y0, w: sel.x1 - sel.x0, h: sel.y1 - sel.y0 },
    };
    setHasClipboard(true);
  };

  const startPaste = () => {
    if (!clipboardRef.current || isPunished) return;
    selectionRef.current = null;
    setSelectionBox(null);
    const off = { dx: 0.04, dy: 0.04 };
    pasteOffsetRef.current = off;
    setPasteOffset(off);
    redraw();
  };

  const commitPaste = () => {
    const clip = clipboardRef.current;
    const off = pasteOffsetRef.current;
    if (!clip || !off || isPunished) return;
    for (const s of clip.strokes) {
      const shifted: number[] = [];
      for (let i = 0; i < s.points.length; i += 2) {
        shifted.push(
          Math.max(0, Math.min(1, s.points[i] + off.dx)),
          Math.max(0, Math.min(1, s.points[i + 1] + off.dy))
        );
      }
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      board.draw({ id, tool: s.tool, color: s.color, size: s.size }, shifted, true);
    }
    pasteOffsetRef.current = null;
    setPasteOffset(null);
    redraw();
  };

  const cancelPaste = () => {
    pasteOffsetRef.current = null;
    setPasteOffset(null);
    redraw();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectionBox) {
        e.preventDefault();
        copySelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && hasClipboard) {
        e.preventDefault();
        startPaste();
      } else if (e.key === 'Enter' && pasteOffset) {
        e.preventDefault();
        commitPaste();
      } else if (e.key === 'Escape') {
        if (pasteOffset) cancelPaste();
        else if (selectionBox) {
          selectionRef.current = null;
          setSelectionBox(null);
          redraw();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionBox, hasClipboard, pasteOffset]);

  const handleClear = () => {
    if (canClearAll) {
      if (confirm('Limpar a lousa inteira para todo mundo da sala?')) board.clear(false);
    } else if (confirm('Apagar todos os SEUS traços da lousa?')) {
      board.clear(true);
    }
  };

  // Baixa a lousa INTEIRA (não só a parte com zoom)
  const handleDownload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = Math.round(1600 / ASPECT);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of board.getStrokes()) drawStroke(ctx, stroke, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lousa-mesa.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  };

  const toolButton = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${
      active ? 'bg-[#ffd027] text-slate-950' : 'text-slate-300 hover:bg-slate-700/70 hover:text-white'
    }`;

  const cursor = tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : isPunished ? 'cursor-not-allowed' : 'cursor-crosshair';

  return (
    <div className="w-full h-full flex flex-col bg-[#111728]" data-testid="whiteboard">
      {/* Ferramentas */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 border-b border-[#232f4e] flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={tool === id}
              data-testid={`board-tool-${id}`}
              onClick={() => setTool(id)}
              className={toolButton(tool === id)}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5" data-testid="board-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Cor ${c}`}
              aria-label={`Cor ${c}`}
              aria-pressed={color === c}
              onClick={() => pickColor(c)}
              className={`w-5 h-5 rounded-full border border-white/30 transition-transform ${
                color === c && tool !== 'eraser' ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}

          {/* Cores livres que já usei */}
          {customColors.map((c) => (
            <button
              key={c}
              type="button"
              data-testid="board-color-recent"
              title={`Cor ${c} (usada antes)`}
              aria-label={`Cor ${c}`}
              aria-pressed={color === c}
              onClick={() => pickColor(c)}
              className={`w-5 h-5 rounded-full border border-white/30 transition-transform ${
                color === c && tool !== 'eraser' ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}

          {/* Qualquer cor: abre o seletor do navegador (arco-íris, ou a cor escolhida no meio) */}
          <label
            title="Escolher qualquer cor"
            className={`relative w-6 h-6 rounded-full cursor-pointer flex items-center justify-center transition-transform ${
              !COLORS.includes(color) && tool !== 'eraser' ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
            }`}
            style={{ background: RAINBOW }}
          >
            <span
              className="w-3 h-3 rounded-full border border-white/80 pointer-events-none"
              style={{ backgroundColor: COLORS.includes(color) ? '#111728' : color }}
            />
            <input
              type="color"
              data-testid="board-color-custom"
              aria-label="Escolher qualquer cor"
              value={color}
              onChange={(e) => pickColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
          <ColorField
            hexOnly
            dark
            size="sm"
            testId="board-color-hex-field"
            value={color}
            onChange={(hex) => pickColor(hex)}
            className="w-[5.5rem]"
          />
        </div>

        <div className="flex items-center gap-0.5">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.label}
              aria-label={s.label}
              aria-pressed={size === s.value}
              onClick={() => setSize(s.value)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                size === s.value ? 'bg-slate-600' : 'hover:bg-slate-700/70'
              }`}
            >
              <span className={`rounded-full bg-white ${s.dot}`} />
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Diminuir zoom"
            data-testid="board-zoom-out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => zoomAt(viewRef.current.scale / 1.5)}
            className={`${toolButton(false)} disabled:opacity-40`}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Voltar ao tamanho normal"
            data-testid="board-zoom-value"
            onClick={() => setView(1, 0, 0)}
            className="min-w-[3.25rem] px-1.5 py-1.5 rounded-lg text-xs font-mono text-slate-200 hover:bg-slate-700/70"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            title="Aumentar zoom"
            data-testid="board-zoom-in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => zoomAt(viewRef.current.scale * 1.5)}
            className={`${toolButton(false)} disabled:opacity-40`}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 ml-auto">
          {selectionBox && (
            <button
              type="button"
              title="Copiar trecho selecionado (Ctrl+C)"
              onClick={copySelection}
              className="px-2 py-1.5 rounded-lg bg-[#3044f0] hover:bg-[#2334c9] text-white text-xs font-bold flex items-center gap-1 mr-1"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar
            </button>
          )}
          {hasClipboard && !pasteOffset && (
            <button
              type="button"
              title="Colar trecho copiado (Ctrl+V)"
              onClick={startPaste}
              className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 mr-1"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> Colar
            </button>
          )}
          <button type="button" title="Desfazer meu último traço" onClick={() => board.undo()} className={toolButton(false)}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={canClearAll ? 'Limpar a lousa inteira' : 'Apagar os meus traços'}
            data-testid="board-clear"
            onClick={handleClear}
            className={toolButton(false)}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button type="button" title="Baixar a lousa inteira como imagem" onClick={handleDownload} className={toolButton(false)}>
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Área de desenho */}
      <div ref={wrapRef} className="relative flex-1 min-h-0 flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          data-testid="board-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`rounded-lg bg-white touch-none ${cursor}`}
          style={{ width: boardSize.width || undefined, height: boardSize.height || undefined }}
        />
        {zoom > 1 && (
          <span className="absolute top-4 right-4 px-2 py-1 rounded-md bg-black/60 text-[11px] font-semibold text-white pointer-events-none">
            Zoom {Math.round(zoom * 100)}% · use a mão para mover
          </span>
        )}
        {pasteOffset && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-bold shadow-lg">
            <span>Arraste para posicionar</span>
            <button
              type="button"
              onClick={commitPaste}
              className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Colar aqui
            </button>
            <button
              type="button"
              onClick={cancelPaste}
              title="Cancelar"
              className="p-1 rounded-full hover:bg-white/15"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {isPunished && (
          <span className="absolute bottom-4 px-3 py-1 rounded-full bg-black/70 text-xs font-semibold text-white">
            Você está de castigo e não pode desenhar agora
          </span>
        )}
      </div>
    </div>
  );
}
