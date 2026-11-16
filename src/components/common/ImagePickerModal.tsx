'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { GifResult } from '@/types';
import { Upload, Sparkles, Search, ZoomIn, ZoomOut, RotateCcw, Check, X, Move } from 'lucide-react';

export type PickerShape = 'avatar' | 'banner' | 'room';

interface ImagePickerModalProps {
  open: boolean;
  shape: PickerShape;
  title: string;
  initialUrl?: string;
  onClose: () => void;
  onSelect: (resultUrl: string) => void;
}

const DIMENSIONS: Record<PickerShape, { w: number; h: number; previewClass: string }> = {
  avatar: { w: 240, h: 240, previewClass: 'w-48 h-48 rounded-full' },
  banner: { w: 640, h: 220, previewClass: 'w-full max-w-md aspect-[640/220] rounded-2xl' },
  room: { w: 480, h: 270, previewClass: 'w-full max-w-sm aspect-[16/9] rounded-2xl' },
};

/**
 * Janela para escolher Foto ou GIF (do computador ou pesquisando GIFs igual no chat)
 * e posicionar/dar zoom na imagem antes de salvar.
 */
export function ImagePickerModal({ open, shape, title, initialUrl, onClose, onSelect }: ImagePickerModalProps) {
  const { searchGifs } = useMesa();

  const [tab, setTab] = useState<'upload' | 'gif'>('upload');
  const [rawUrl, setRawUrl] = useState<string>(initialUrl && initialUrl.startsWith('data:image/') ? initialUrl : '');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab('upload');
    setRawUrl(initialUrl && initialUrl.startsWith('data:image/') ? initialUrl : '');
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
    setGifQuery('');
  }, [open, initialUrl]);

  useEffect(() => {
    if (!open || tab !== 'gif') return;
    let cancelled = false;
    setGifLoading(true);
    setGifError(null);
    const timer = window.setTimeout(async () => {
      const res = await searchGifs(gifQuery.trim());
      if (cancelled) return;
      setGifLoading(false);
      if (!res.ok) {
        setGifError(res.error || 'Não foi possível carregar os GIFs agora.');
        setGifs([]);
      } else {
        setGifs(res.gifs || []);
      }
    }, gifQuery.trim() ? 260 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, tab, gifQuery, searchGifs]);

  if (!open) return null;

  const dim = DIMENSIONS[shape];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Escolha um arquivo de imagem (PNG, JPG, WebP ou GIF).');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setRawUrl(url);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const clampOffset = (nx: number, ny: number, z = zoom) => {
    const box = previewRef.current;
    const bw = box ? box.clientWidth : 240;
    const bh = box ? box.clientHeight : 240;
    const baseScale = Math.max(bw / naturalSize.w, bh / naturalSize.h);
    const dispW = naturalSize.w * baseScale * z;
    const dispH = naturalSize.h * baseScale * z;
    const maxX = Math.max(0, (dispW - bw) / 2);
    const maxY = Math.max(0, (dispH - bh) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    };
  };

  const handleZoomChange = (nextZoom: number) => {
    const z = Math.max(1, Math.min(3, Math.round(nextZoom * 100) / 100));
    setZoom(z);
    setOffset((prev) => clampOffset(prev.x, prev.y, z));
  };

  const handleApplyUpload = () => {
    if (!rawUrl) return;
    // Se for um GIF animado sem recorte/zoom e leve, mantém o GIF animado original
    if (rawUrl.startsWith('data:image/gif') && zoom === 1 && offset.x === 0 && offset.y === 0 && rawUrl.length <= 380000) {
      onSelect(rawUrl);
      onClose();
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = dim.w;
      canvas.height = dim.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const box = previewRef.current;
      const bw = box ? box.clientWidth : dim.w;
      const bh = box ? box.clientHeight : dim.h;
      const ratioX = dim.w / bw;
      const ratioY = dim.h / bh;

      const baseScale = Math.max(dim.w / img.width, dim.h / img.height);
      const drawW = img.width * baseScale * zoom;
      const drawH = img.height * baseScale * zoom;
      const dx = (dim.w - drawW) / 2 + offset.x * ratioX;
      const dy = (dim.h - drawH) / 2 + offset.y * ratioY;

      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, dim.w, dim.h);
      ctx.drawImage(img, dx, dy, drawW, drawH);
      const out = canvas.toDataURL('image/jpeg', 0.86);
      onSelect(out);
      onClose();
    };
    img.src = rawUrl;
  };

  const box = previewRef.current;
  const bw = box ? box.clientWidth : 240;
  const bh = box ? box.clientHeight : 240;
  const baseScale = Math.max(bw / Math.max(1, naturalSize.w), bh / Math.max(1, naturalSize.h));
  const dispW = naturalSize.w * baseScale * zoom;
  const dispH = naturalSize.h * baseScale * zoom;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0b0f19]/80 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mesa-paper w-full max-w-lg rounded-3xl bg-[#f6f5f0] text-slate-900 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Topo */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-900/10 flex items-center justify-between gap-2">
          <h3 className="landing-display text-lg text-slate-950">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-900/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas: Enviar foto/GIF vs Buscar GIF */}
        <div className="px-5 pt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`flex-1 h-9 rounded-full text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'upload' ? 'bg-[#3044f0] text-white' : 'bg-slate-900/5 text-slate-700 hover:bg-slate-900/10'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Enviar e Posicionar</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('gif')}
            className={`flex-1 h-9 rounded-full text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'gif' ? 'bg-[#3044f0] text-white' : 'bg-slate-900/5 text-slate-700 hover:bg-slate-900/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Buscar GIF</span>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {tab === 'upload' ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!rawUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 px-4 rounded-2xl border-2 border-dashed border-slate-900/20 hover:border-[#3044f0] bg-white flex flex-col items-center justify-center gap-2 text-center transition-colors"
                >
                  <Upload className="w-8 h-8 text-[#3044f0]" />
                  <span className="text-sm font-extrabold text-slate-900">Escolher foto ou GIF do computador</span>
                  <span className="text-xs text-slate-500">Depois de escolher, arraste para posicionar como quiser</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col items-center">
                    <div
                      ref={previewRef}
                      onWheel={(e) => {
                        e.preventDefault();
                        handleZoomChange(zoom + (e.deltaY < 0 ? 0.12 : -0.12));
                      }}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        dragRef.current = {
                          active: true,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: offset.x,
                          origY: offset.y,
                        };
                      }}
                      onPointerMove={(e) => {
                        const d = dragRef.current;
                        if (!d || !d.active) return;
                        setOffset(clampOffset(d.origX + (e.clientX - d.startX), d.origY + (e.clientY - d.startY)));
                      }}
                      onPointerUp={() => {
                        if (dragRef.current) dragRef.current.active = false;
                      }}
                      className={`relative overflow-hidden bg-[#0b0f19] border-2 border-[#3044f0] cursor-grab active:cursor-grabbing select-none flex items-center justify-center shadow-inner ${dim.previewClass}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rawUrl}
                        alt="Prévia"
                        draggable={false}
                        onLoad={(e) => {
                          const el = e.currentTarget;
                          setNaturalSize({ w: el.naturalWidth || 240, h: el.naturalHeight || 240 });
                        }}
                        style={{
                          width: `${dispW}px`,
                          height: `${dispH}px`,
                          maxWidth: 'none',
                          transform: `translate(${offset.x}px, ${offset.y}px)`,
                        }}
                        className="pointer-events-none select-none object-cover"
                      />
                      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-bold flex items-center gap-1 pointer-events-none whitespace-nowrap">
                        <Move className="w-3 h-3" /> Arraste para posicionar
                      </span>
                    </div>
                  </div>

                  {/* Controles de zoom e troca de arquivo */}
                  <div className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-900/10">
                    <ZoomOut className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="flex-1 accent-[#3044f0]"
                    />
                    <ZoomIn className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(1);
                        setOffset({ x: 0, y: 0 });
                      }}
                      title="Centralizar imagem"
                      className="p-1.5 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-[#3044f0] hover:underline"
                    >
                      Escolher outra imagem do computador
                    </button>
                    <span className="text-[11px] font-mono text-slate-500">{Math.round(zoom * 100)}%</span>
                  </div>
                </div>
              )}

              {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-4 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-900/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!rawUrl}
                  onClick={handleApplyUpload}
                  className="h-10 px-5 rounded-full bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar</span>
                </button>
              </div>
            </>
          ) : (
            /* ABA 2: BUSCAR GIF */
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  value={gifQuery}
                  onChange={(e) => setGifQuery(e.target.value)}
                  placeholder="Buscar GIFs animados (ex: anime, gatinho, estudo)..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-900/15 focus:border-[#3044f0] text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>

              {gifLoading ? (
                <div className="py-10 text-center text-xs text-slate-500 font-semibold">Carregando GIFs...</div>
              ) : gifError ? (
                <div className="py-8 text-center text-xs text-rose-600 font-semibold">{gifError}</div>
              ) : gifs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">Nenhum GIF encontrado para essa busca.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {gifs.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => {
                        onSelect(gif.url);
                        onClose();
                      }}
                      title={gif.title || 'Escolher este GIF'}
                      className="group relative aspect-video rounded-xl overflow-hidden bg-black/20 border border-slate-900/10 hover:ring-2 hover:ring-[#3044f0]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={gif.preview || gif.url} alt={gif.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
