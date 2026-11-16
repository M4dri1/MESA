'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMesa, isActiveUntil, untilLabel, ModerationDuration, MUSIC_BOT_ID } from '@/context/MesaContext';
import { RoomRole } from '@/types';
import { X, Volume2, VolumeX, Crown, Shield, ShieldOff, Clock, Undo2, Mic, MicOff, ChevronDown, Music2, Power, Maximize2 } from 'lucide-react';

const RANK: Record<RoomRole, number> = { owner: 3, admin: 2, member: 1 };
const ROLE_LABEL: Record<RoomRole, string> = { owner: 'Dono da sala', admin: 'Adm', member: 'Membro' };
const CARD_WIDTH = 300;

const DURATIONS = [
  { value: '10', label: '10 minutos' },
  { value: '60', label: '1 hora' },
  { value: '1440', label: '1 dia' },
  { value: 'forever', label: 'Para sempre' },
  { value: 'custom', label: 'Outro tempo...' },
];

/** Selos de cargo usados na lista e nos cartões de vídeo */
export function RoleBadge({ role, className = '' }: { role?: RoomRole; className?: string }) {
  if (role === 'owner') {
    return (
      <span title="Dono da sala" className={`inline-flex ${className}`}>
        <Crown className="w-3.5 h-3.5 text-[#3044f0]" aria-label="Dono da sala" />
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span title="Adm" className={`inline-flex ${className}`}>
        <Shield className="w-3.5 h-3.5 text-sky-400" aria-label="Adm" />
      </span>
    );
  }
  return null;
}

function DurationPicker({
  id,
  value,
  custom,
  onChange,
  onCustomChange,
  allowNone,
}: {
  id: string;
  value: string;
  custom: string;
  onChange: (value: string) => void;
  onCustomChange: (value: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <select
        id={id}
        data-testid={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-[#f6f5f0] border border-slate-900/10 text-xs text-slate-900 focus:outline-none focus:border-[#3044f0]"
      >
        {allowNone && <option value="0">Só tirar agora</option>}
        {DURATIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      {value === 'custom' && (
        <input
          type="number"
          min={1}
          max={525600}
          value={custom}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="min"
          aria-label="Tempo em minutos"
          className="w-16 px-2 py-1.5 rounded-lg bg-[#f6f5f0] border border-slate-900/10 text-xs text-slate-900 focus:outline-none focus:border-[#3044f0]"
        />
      )}
    </div>
  );
}

/**
 * Cartão de perfil de quem está na chamada. Abre ao lado de onde a pessoa clicou
 * (clique ou clique direito no cartão de vídeo ou na lista), sem cobrir a tela.
 * Qualquer pessoa ajusta aqui o volume com que ELA ouve o colega; adm e dono veem também a moderação.
 */
export function ParticipantModal() {
  const {
    participantMenuId,
    participantMenuPos,
    setParticipantMenuId,
    currentRoom,
    peerVolumes,
    setPeerVolume,
    myRole,
    moderate,
    music,
    musicDismiss,
    musicVolume,
    setMusicVolume,
    musicMuted,
    setMusicMuted,
    setCallFocus,
  } = useMesa();

  const [punishChoice, setPunishChoice] = useState('10');
  const [punishCustom, setPunishCustom] = useState('30');
  const [kickChoice, setKickChoice] = useState('0');
  const [kickCustom, setKickCustom] = useState('30');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModeration, setShowModeration] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  // Volume de antes de silenciar, para o botão "ouvir de novo" devolver o mesmo valor
  const beforeMuteRef = useRef<Record<string, number>>({});
  const cardRef = useRef<HTMLDivElement>(null);

  const isBot = participantMenuId === MUSIC_BOT_ID && music.on;
  const member = isBot ? undefined : currentRoom?.members.find((m) => m.id === participantMenuId);
  const memberId = isBot ? MUSIC_BOT_ID : member?.id;

  useEffect(() => {
    setFormError(null);
    setShowModeration(false);
  }, [memberId]);

  // O bot foi embora com o cartão aberto: fecha
  useEffect(() => {
    if (participantMenuId === MUSIC_BOT_ID && !music.on) setParticipantMenuId(null);
  }, [participantMenuId, music.on, setParticipantMenuId]);

  // Encaixa o cartão dentro da janela, perto do ponto clicado
  useLayoutEffect(() => {
    if (!memberId) {
      setPlace(null);
      return;
    }
    const card = cardRef.current;
    const height = card ? card.offsetHeight : 360;
    const width = Math.min(CARD_WIDTH, window.innerWidth - 16);
    const anchor = participantMenuPos || { x: window.innerWidth / 2 - width / 2, y: window.innerHeight / 2 - height / 2 };
    let left = anchor.x + 12;
    if (left + width > window.innerWidth - 8) left = anchor.x - width - 12;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(anchor.y - 24, window.innerHeight - height - 8));
    setPlace({ left, top });
  }, [memberId, participantMenuPos, showModeration, formError]);

  // Fecha com Esc ou clicando fora
  useEffect(() => {
    if (!memberId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setParticipantMenuId(null);
    };
    const onDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setParticipantMenuId(null);
    };
    window.addEventListener('keydown', onKey);
    // Espera o clique que abriu o cartão terminar antes de começar a ouvir cliques de fora
    const timer = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [memberId, setParticipantMenuId]);

  if (isBot && currentRoom) {
    const closeBot = () => setParticipantMenuId(null);
    const botVolume = Math.round(musicVolume * 100);
    const canDismiss = myRole !== 'member';
    const nowPlaying = music.queue[0];
    return (
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Opções do bot de música"
        data-testid="participant-modal"
        data-bot="true"
        className="mesa-paper fixed z-50 rounded-2xl bg-[#f6f5f0] text-slate-900 overflow-hidden max-h-[calc(100vh-16px)] overflow-y-auto shadow-[0_24px_48px_-12px_rgba(11,15,25,0.6)]"
        style={{
          width: `min(${CARD_WIDTH}px, calc(100vw - 16px))`,
          left: place?.left ?? -9999,
          top: place?.top ?? 0,
          visibility: place ? 'visible' : 'hidden',
        }}
      >
        <div className="h-14 relative bg-violet-600">
          <button
            onClick={closeBot}
            title="Fechar"
            className="absolute top-2 right-2 p-1 rounded-full bg-black/30 text-white/90 hover:bg-black/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="relative z-10 -mt-7 mb-2 flex items-end justify-between">
            <div className="w-14 h-14 rounded-full ring-4 ring-[#f6f5f0] bg-violet-500 flex items-center justify-center">
              <Music2 className="w-7 h-7 text-slate-900" />
            </div>
            <span className="mb-1 px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/40 text-[11px] font-semibold text-violet-700">Bot de música</span>
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Mesa DJ</h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{nowPlaying ? `Tocando: ${nowPlaying.title}` : 'Esperando música'}</p>

          <div className="mt-3 p-3 rounded-2xl bg-white border border-slate-900/10">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="bot-volume" className="text-xs font-bold text-slate-800">Volume da música</label>
              <span className="text-xs font-mono text-slate-700" data-testid="bot-volume-value">{botVolume}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="bot-mute"
                onClick={() => setMusicMuted(!musicMuted)}
                title={musicMuted ? 'Voltar a ouvir a música' : 'Silenciar a música só para mim'}
                aria-pressed={musicMuted}
                className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${musicMuted ? 'bg-rose-600 text-white' : 'bg-slate-900/5 text-slate-800 hover:bg-slate-900/10'}`}
              >
                {musicMuted || botVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                id="bot-volume"
                data-testid="bot-volume"
                type="range"
                min={0}
                max={100}
                step={5}
                value={botVolume}
                onChange={(e) => {
                  setMusicVolume(Number(e.target.value) / 100);
                  setMusicMuted(false);
                }}
                className="w-full accent-violet-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Só muda o que você ouve. Ninguém mais percebe.</p>
          </div>

          {canDismiss ? (
            <button
              type="button"
              data-testid="bot-dismiss"
              onClick={() => {
                musicDismiss();
                closeBot();
              }}
              className="mt-2 w-full py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 text-rose-200 font-bold text-xs flex items-center justify-center gap-2 border border-rose-500/40"
            >
              <Power className="w-4 h-4" /> Tirar o bot da call
            </button>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">Só o dono e os adm podem tirar o bot da call.</p>
          )}
        </div>
      </div>
    );
  }

  if (!member || !currentRoom) return null;

  const role: RoomRole = member.role || 'member';
  const canAct = RANK[myRole] >= RANK.admin && RANK[myRole] > RANK[role];
  const isOwner = myRole === 'owner';
  const punished = isActiveUntil(member.punishedUntil);
  const volume = Math.round((peerVolumes[member.id] ?? 1) * 100);
  const close = () => setParticipantMenuId(null);

  const toggleMuteForMe = () => {
    if (volume === 0) {
      setPeerVolume(member.id, beforeMuteRef.current[member.id] || 1);
    } else {
      beforeMuteRef.current[member.id] = volume / 100;
      setPeerVolume(member.id, 0);
    }
  };

  const resolveDuration = (choice: string, custom: string): ModerationDuration | null => {
    if (choice === 'forever') return 'forever';
    const minutes = Number(choice === 'custom' ? custom : choice);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  };

  const run = async (action: Parameters<typeof moderate>[0], duration?: ModerationDuration, closeAfter = false) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    const ok = await moderate(action, member.id, duration);
    setBusy(false);
    if (ok && closeAfter) close();
  };

  const handlePunish = () => {
    const duration = resolveDuration(punishChoice, punishCustom);
    if (!duration) return setFormError('Digite por quantos minutos vale o castigo.');
    void run('punish', duration);
  };

  const handleKick = () => {
    if (kickChoice === '0') return void run('kick', 0, true);
    const duration = resolveDuration(kickChoice, kickCustom);
    if (!duration) return setFormError('Digite por quantos minutos a pessoa fica sem poder voltar.');
    void run('kick', duration, true);
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Perfil de ${member.name}`}
      data-testid="participant-modal"
      className="mesa-paper fixed z-50 rounded-2xl bg-[#f6f5f0] text-slate-900 overflow-hidden max-h-[calc(100vh-16px)] overflow-y-auto shadow-[0_24px_48px_-12px_rgba(11,15,25,0.6)]"
      style={{
        width: `min(${CARD_WIDTH}px, calc(100vw - 16px))`,
        left: place?.left ?? -9999,
        top: place?.top ?? 0,
        visibility: place ? 'visible' : 'hidden',
      }}
    >
      {/* Faixa colorida / banner + avatar, como um cartão de perfil */}
      <div
        className="h-20 relative bg-cover bg-center"
        style={{
          backgroundColor: member.avatarColor || '#2563eb',
          backgroundImage: member.bannerUrl ? `url(${member.bannerUrl})` : undefined,
        }}
      >
        <button
          onClick={close}
          title="Fechar"
          className="absolute top-2 right-2 p-1 rounded-full bg-black/30 text-white/90 hover:bg-black/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="relative z-10 -mt-7 mb-2 flex items-end justify-between">
          <div className="w-14 h-14 rounded-full ring-4 ring-[#f6f5f0] overflow-hidden flex items-center justify-center text-xl font-bold text-slate-900" style={{ backgroundColor: member.avatarColor || '#2563eb' }}>
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              member.avatarLetter
            )}
          </div>
          <span className="mb-1 px-2 py-0.5 rounded-md bg-slate-900/5 border border-slate-900/10 text-[11px] font-semibold text-slate-800 flex items-center gap-1">
            <RoleBadge role={role} />
            {ROLE_LABEL[role]}
          </span>
        </div>

        <h2 className="text-base font-extrabold text-slate-900 truncate">{member.name}</h2>
        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
          {member.isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-600" /> : <MicOff className="w-3.5 h-3.5 text-rose-600" />}
          <span>{member.isMicOn ? 'Microfone ligado' : 'Microfone desligado'}</span>
        </p>
        {punished && (
          <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> De castigo {untilLabel(member.punishedUntil || 0)}
          </p>
        )}

        {/* Dar foco: a câmera (ou a tela) dessa pessoa em tamanho grande no palco */}
        <button
          type="button"
          data-testid="participant-focus"
          onClick={() => {
            setCallFocus({ id: member.id, kind: member.isSharingScreen ? 'screen' : 'camera' });
            close();
          }}
          className="mt-3 w-full h-10 rounded-full bg-[#0b0f19] hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Dar foco
        </button>

        {/* Volume: vale só para quem está mexendo */}
        <div className="mt-2 p-3 rounded-2xl bg-white border border-slate-900/10">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="participant-volume" className="text-xs font-bold text-slate-800">
              Volume do usuário
            </label>
            <span className="text-xs font-mono text-slate-700" data-testid="participant-volume-value">
              {volume}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMuteForMe}
              data-testid="participant-mute"
              title={volume === 0 ? 'Voltar a ouvir' : 'Silenciar só para mim'}
              aria-pressed={volume === 0}
              className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
                volume === 0 ? 'bg-rose-600 text-white' : 'bg-slate-900/5 text-slate-800 hover:bg-slate-900/10'
              }`}
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              id="participant-volume"
              data-testid="participant-volume"
              type="range"
              min={0}
              max={200}
              step={5}
              value={volume}
              onChange={(e) => setPeerVolume(member.id, Number(e.target.value) / 100)}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="text-[11px] text-slate-500 leading-tight">Só muda o que você ouve.</span>
            {volume !== 100 && (
              <button
                type="button"
                onClick={() => setPeerVolume(member.id, 1)}
                className="text-[11px] font-semibold text-[#3044f0] hover:underline flex-shrink-0"
              >
                Voltar a 100%
              </button>
            )}
          </div>
        </div>

        {/* Cargo: só o dono */}
        {isOwner && role !== 'owner' && (
          <button
            type="button"
            disabled={busy}
            data-testid={role === 'admin' ? 'btn-demote' : 'btn-promote'}
            onClick={() => run(role === 'admin' ? 'demote' : 'promote')}
            className="mt-2 w-full py-2 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 text-slate-900 font-bold text-xs flex items-center justify-center gap-2 border border-slate-900/10 disabled:opacity-50"
          >
            {role === 'admin' ? <ShieldOff className="w-4 h-4 text-slate-700" /> : <Shield className="w-4 h-4 text-sky-400" />}
            <span>{role === 'admin' ? 'Tirar o cargo de adm' : 'Tornar adm da sala'}</span>
          </button>
        )}

        {/* Moderação: adm e dono, só sobre quem está abaixo. Fica recolhida para não poluir o cartão. */}
        {canAct && (
          <div className="mt-2">
            <button
              type="button"
              data-testid="moderation-toggle"
              aria-expanded={showModeration}
              onClick={() => setShowModeration((v) => !v)}
              className="w-full py-2 px-3 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 text-rose-700 font-bold text-xs flex items-center justify-between border border-slate-900/10"
            >
              <span>Moderação</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showModeration ? 'rotate-180' : ''}`} />
            </button>

            {showModeration && (
              <div className="mt-2 space-y-3">
                <div>
                  <label htmlFor="punish-duration" className="text-xs font-bold text-slate-800 block">
                    Castigar
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">Fica na sala, sem microfone, câmera, tela, chat e lousa.</p>
                  {punished ? (
                    <button
                      type="button"
                      disabled={busy}
                      data-testid="btn-pardon"
                      onClick={() => run('pardon')}
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Undo2 className="w-4 h-4" /> Tirar o castigo
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <DurationPicker
                        id="punish-duration"
                        value={punishChoice}
                        custom={punishCustom}
                        onChange={setPunishChoice}
                        onCustomChange={setPunishCustom}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        data-testid="btn-punish"
                        onClick={handlePunish}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex-shrink-0 disabled:opacity-50"
                      >
                        Castigar
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="kick-duration" className="text-xs font-bold text-slate-800 block">
                    Expulsar
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">Sai da sala. Escolha por quanto tempo fica sem poder voltar.</p>
                  <div className="flex items-center gap-1.5">
                    <DurationPicker
                      id="kick-duration"
                      value={kickChoice}
                      custom={kickCustom}
                      onChange={setKickChoice}
                      onCustomChange={setKickCustom}
                      allowNone
                    />
                    <button
                      type="button"
                      disabled={busy}
                      data-testid="btn-kick"
                      onClick={handleKick}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex-shrink-0 disabled:opacity-50"
                    >
                      Expulsar
                    </button>
                  </div>
                </div>

                {formError && <p className="text-xs text-rose-600">{formError}</p>}
              </div>
            )}
          </div>
        )}

        {!canAct && RANK[myRole] >= RANK.admin && (
          <p className="mt-2 text-[11px] text-slate-500">
            {role === 'owner' ? 'O dono da sala não pode ser castigado nem expulso.' : 'Só o dono pode moderar outro adm.'}
          </p>
        )}
      </div>
    </div>
  );
}
