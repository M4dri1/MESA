'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Sound } from '@/types';
import { comboFromEvent } from '@/utils/hotkeys';
import { AudioWaveform, X, Plus, Pencil, Trash2, Keyboard, Check, Loader2, Volume2 } from 'lucide-react';

const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta'];

/** Uma linha do modo "Editar": nome, emoji, tecla de atalho e apagar */
function SoundRow({
  sound,
  capturing,
  onCapture,
  onClear,
}: {
  sound: Sound;
  capturing: boolean;
  onCapture: () => void;
  onClear: () => void;
}) {
  const { updateSound, deleteSound } = useMesa();
  const [name, setName] = useState(sound.name);
  const [emoji, setEmoji] = useState(sound.emoji);

  // Quando a lista muda (outra edição, outro aparelho), acompanha
  useEffect(() => setName(sound.name), [sound.name]);
  useEffect(() => setEmoji(sound.emoji), [sound.emoji]);

  const commitName = () => {
    const next = name.trim();
    if (!next) return setName(sound.name);
    if (next !== sound.name) void updateSound(sound.id, { name: next });
  };
  const commitEmoji = () => {
    const next = Array.from(emoji.trim()).slice(0, 2).join('') || '🔊';
    setEmoji(next);
    if (next !== sound.emoji) void updateSound(sound.id, { emoji: next });
  };

  return (
    <div data-testid="sound-row" className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[#0b0f19] border border-[#232f4e]">
      <input
        aria-label="Emoji do som"
        data-testid="sound-emoji"
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        onBlur={commitEmoji}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-9 text-center px-1 py-1.5 rounded-lg bg-[#141c2e] text-sm focus:outline-none focus:ring-1 focus:ring-[#ffd027]"
      />
      <input
        aria-label="Nome do som"
        data-testid="sound-name"
        value={name}
        maxLength={24}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-[#141c2e] text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#ffd027]"
      />
      <button
        type="button"
        data-testid="sound-key"
        onClick={onCapture}
        title={capturing ? 'Aperte a tecla agora (Esc cancela, Backspace remove)' : 'Escolher a tecla de atalho'}
        className={`min-w-[4.5rem] px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 ${
          capturing ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-[#1b253e] text-slate-200 hover:bg-[#243152]'
        }`}
      >
        <Keyboard className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{capturing ? 'Aperte...' : sound.key || 'Tecla'}</span>
      </button>
      {sound.key && !capturing && (
        <button type="button" onClick={onClear} title="Tirar a tecla" className="p-1 rounded-md text-slate-400 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        data-testid="sound-delete"
        onClick={() => deleteSound(sound.id)}
        title="Apagar este som"
        className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-600/70"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SoundpadPanel({ onClose }: { onClose: () => void }) {
  const { sounds, addSound, updateSound, playSound, padVolume, setPadVolume, padListen, setPadListen, padHotkeys, setPadHotkeys } = useMesa();
  const [editing, setEditing] = useState(false);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fecha com Esc ou clicando fora (o botão que abre também conta como "dentro")
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (panelRef.current && !panelRef.current.contains(target) && !target.closest('[data-testid="soundpad-button"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  // Escolher a tecla: a próxima combinação apertada vira o atalho
  useEffect(() => {
    if (!capturingId) return;
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (MODIFIER_KEYS.includes(e.key)) return;
      if (e.key === 'Escape') return setCapturingId(null);
      const id = capturingId;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setCapturingId(null);
        await updateSound(id, { key: '' });
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) {
        setError('Essa tecla não pode ser atalho. Use F1 a F12, números, letras ou o teclado numérico (com Ctrl, Alt ou Shift se quiser).');
        return;
      }
      setError(null);
      setCapturingId(null);
      const result = await updateSound(id, { key: combo });
      if (!result.ok) setError(result.error || 'Não foi possível salvar a tecla.');
    };
    // Fase de captura: roda antes do atalho normal, para a tecla não tocar um som sem querer
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturingId, updateSound]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await addSound(file);
    setBusy(false);
    if (!result.ok) setError(result.error || 'Não foi possível adicionar o som.');
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Soundpad"
      data-testid="soundpad-panel"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,400px)] max-h-[72vh] overflow-y-auto rounded-xl bg-[#111728] border border-[#27365c] "
    >
      <div className="flex items-center justify-between p-3 border-b border-[#232f4e] sticky top-0 bg-[#111728] z-10">
        <p className="text-sm font-black text-white flex items-center gap-2">
          <AudioWaveform className="w-4 h-4 text-amber-300" /> Soundpad
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="soundpad-edit"
            aria-pressed={editing}
            onClick={() => {
              setEditing((v) => !v);
              setCapturingId(null);
              setError(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
              editing ? 'bg-emerald-600 text-white' : 'bg-[#1b253e] text-slate-200 hover:bg-[#243152]'
            }`}
          >
            {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editing ? 'Pronto' : 'Editar'}
          </button>
          <button type="button" onClick={onClose} title="Fechar" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1b253e]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {sounds.length === 0 && (
          <p className="text-xs text-slate-400 leading-relaxed text-center py-3">
            Você ainda não tem sons. Adicione clipes curtos (até 15 s), como uma risada, um aplauso ou um efeito. Quando você toca um,
            a sala toda ouve.
          </p>
        )}

        {!editing && sounds.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {sounds.map((sound) => (
              <button
                key={sound.id}
                type="button"
                data-testid="sound-button"
                title={sound.key ? `${sound.name} (tecla ${sound.key})` : sound.name}
                onClick={() => playSound(sound.id)}
                className="relative p-2 rounded-xl bg-[#1b253e] hover:bg-[#243152] active:scale-95 border border-[#27365c] text-center transition-all"
              >
                <span className="block text-xl leading-none">{sound.emoji}</span>
                <span className="block mt-1 text-[11px] font-bold text-white truncate">{sound.name}</span>
                {sound.key && (
                  <kbd className="absolute top-1 right-1 px-1 rounded bg-black/50 text-[9px] font-mono text-slate-300">{sound.key}</kbd>
                )}
              </button>
            ))}
          </div>
        )}

        {editing && sounds.length > 0 && (
          <div className="space-y-1.5">
            {sounds.map((sound) => (
              <SoundRow
                key={sound.id}
                sound={sound}
                capturing={capturingId === sound.id}
                onCapture={() => {
                  setError(null);
                  setCapturingId((current) => (current === sound.id ? null : sound.id));
                }}
                onClear={() => void updateSound(sound.id, { key: '' })}
              />
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
          onChange={handleFile}
          className="hidden"
          data-testid="soundpad-file"
        />
        <button
          type="button"
          data-testid="soundpad-add"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 rounded-xl bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar som (até 15 s)
        </button>

        {error && (
          <p data-testid="soundpad-error" role="alert" className="text-xs text-rose-300 leading-relaxed">
            {error}
          </p>
        )}

        {/* Ajustes só meus */}
        <div className="pt-3 border-t border-[#232f4e] space-y-2.5">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(padVolume * 100)}
              data-testid="pad-volume"
              aria-label="Volume dos sons do soundpad (só para você)"
              onChange={(e) => setPadVolume(Number(e.target.value) / 100)}
              className="w-full accent-amber-400"
            />
            <span className="text-[11px] font-mono text-slate-300 w-9 text-right">{Math.round(padVolume * 100)}%</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
            <input type="checkbox" data-testid="pad-listen" checked={padListen} onChange={(e) => setPadListen(e.target.checked)} className="accent-amber-400" />
            Ouvir os sons que os outros tocam
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
            <input type="checkbox" data-testid="pad-hotkeys" checked={padHotkeys} onChange={(e) => setPadHotkeys(e.target.checked)} className="accent-amber-400" />
            Atalhos de teclado ligados
          </label>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Os atalhos funcionam com a aba do Mesa aberta e em foco, e não durante a digitação no chat. O navegador não permite captar
            teclas com outros programas na frente. Teclas como Ctrl+T ou Ctrl+W são do navegador e não servem.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Botão do soundpad na barra de controles; abre o painel por cima da chamada */
export function SoundpadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="soundpad-button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Soundpad: sons curtos para a sala"
        className={`relative flex-shrink-0 w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${
          open ? 'bg-white text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        <AudioWaveform className="w-5 h-5" />
        <span className="sr-only">Sons</span>
      </button>
      {open && <SoundpadPanel onClose={() => setOpen(false)} />}
    </>
  );
}
