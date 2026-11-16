'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa, isActiveUntil } from '@/context/MesaContext';
import { Mic, MicOff, Monitor, Video, X, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { StreamVideo } from '@/components/common/StreamVideo';
import { RoleBadge } from '@/components/modals/ParticipantModal';

/**
 * Palco de foco (estilo Discord): a câmera ou a tela de UMA pessoa em tamanho grande, sem abrir tela cheia.
 * Quem compartilha a tela e também tem câmera pode alternar entre as duas.
 * Dar foco na tela de alguém é o mesmo que escolher assistir a ela (a pessoa vê que você está assistindo).
 */
export function FocusStage() {
  const {
    currentRoom,
    currentUser,
    callFocus,
    setCallFocus,
    getPeerStreams,
    localCameraStream,
    localScreenStream,
    isCameraOn,
    isScreenSharing,
    isMicOn,
    audioVolumeLevel,
    myRole,
    watchScreen,
  } = useMesa();

  const watchRef = useRef(watchScreen);
  watchRef.current = watchScreen;
  const stageRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef<number>(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const changeZoom = (next: number) => {
    const clamped = Math.max(1, Math.min(4, Math.round(next * 100) / 100));
    setZoom(clamped);
    if (clamped <= 1) setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    openedAtRef.current = Date.now();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [callFocus?.id, callFocus?.kind]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    // Se a pessoa deu dois cliques no quadradinho da grade, o 1º clique abriu o foco e o 2º cai aqui logo em seguida
    if (Date.now() - openedAtRef.current < 420) {
      toggleFullscreen();
    }
  };

  const isMe = !!callFocus && callFocus.id === currentUser.id;
  const member = !isMe && callFocus && currentRoom ? currentRoom.members.find((m) => m.id === callFocus.id) : undefined;
  const sharing = isMe ? isScreenSharing && !!localScreenStream : !!member?.isSharingScreen;
  const kind: 'camera' | 'screen' = callFocus?.kind === 'screen' && sharing ? 'screen' : 'camera';

  // Em foco na tela de outra pessoa = assistindo a ela; ao sair do foco (ou trocar), para de assistir
  const watchId = member && kind === 'screen' ? member.id : null;
  useEffect(() => {
    if (!watchId) return;
    watchRef.current(watchId);
    return () => watchRef.current(null);
  }, [watchId]);

  // Quem estava em foco saiu da sala
  const gone = !!callFocus && !isMe && !member;
  useEffect(() => {
    if (gone) setCallFocus(null);
  }, [gone, setCallFocus]);

  if (!callFocus || gone) return null;

  const punished = !!member && isActiveUntil(member.punishedUntil);
  const cameraStream = isMe
    ? isCameraOn
      ? localCameraStream
      : undefined
    : member && !punished && member.isCameraOn
    ? getPeerStreams(member).camera
    : undefined;
  const screenStream = isMe ? localScreenStream : member ? getPeerStreams(member).screen : undefined;
  const name = isMe ? `${currentUser.name} (Você)` : member!.name;
  const avatarUrl = isMe ? currentUser.avatarUrl : member!.avatarUrl;
  const avatarColor = (isMe ? currentUser.avatarColor : member!.avatarColor) || '#2563eb';
  const avatarLetter = isMe ? currentUser.avatarLetter : member!.avatarLetter;
  const micOn = isMe ? isMicOn : !!member!.isMicOn;
  const speaking = isMe ? isMicOn && audioVolumeLevel > 15 : !!member!.isSpeaking && !!member!.isMicOn;
  const role = isMe ? myRole : member!.role;

  return (
    <div
      ref={stageRef}
      onClick={handleStageClick}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        toggleFullscreen();
      }}
      onWheel={(e) => {
        if (kind !== 'screen') return;
        e.preventDefault();
        changeZoom(zoom + (e.deltaY < 0 ? 0.25 : -0.25));
      }}
      onPointerDown={(e) => {
        if (zoom <= 1 || (e.target as HTMLElement).closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d || !d.active) return;
        setPan({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
      }}
      onPointerUp={() => {
        if (dragRef.current) dragRef.current.active = false;
      }}
      data-testid="focus-stage"
      data-focus-id={callFocus.id}
      data-focus-kind={kind}
      className={`relative overflow-hidden flex items-center justify-center ${
        isFullscreen ? 'w-screen h-screen max-w-none rounded-none' : 'w-full max-w-5xl flex-1 min-h-[220px] rounded-2xl'
      } ${kind === 'screen' ? 'bg-black' : 'bg-[#17203a]'} ${speaking && kind === 'camera' ? 'ring-2 ring-emerald-400' : ''} ${
        zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {kind === 'screen' ? (
        screenStream ? (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            className="w-full h-full flex items-center justify-center transition-transform duration-75"
          >
            <StreamVideo stream={screenStream} className="w-full h-full object-contain pointer-events-none" />
          </div>
        ) : (
          <span className="text-sm text-slate-400">Conectando à tela de {name}...</span>
        )
      ) : cameraStream ? (
        <StreamVideo stream={cameraStream} mirrored={isMe} className="w-full h-full object-contain bg-black" />
      ) : (
        <div className="flex flex-col items-center gap-3">
          {avatarUrl ? (
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden ring-4 ring-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-white text-5xl sm:text-6xl font-bold"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarLetter}
            </div>
          )}
          <span className="text-xs font-semibold text-white/70">Câmera desligada</span>
        </div>
      )}

      {/* Barra de cima: quem é, alternar câmera/tela e sair do foco */}
      <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between gap-2 z-10">
        <span className="max-w-[55%] px-2.5 py-1.5 rounded-md bg-black/55 text-white text-xs font-bold flex items-center gap-1.5">
          {kind === 'screen' && <Monitor className="w-3.5 h-3.5 flex-shrink-0 text-[#ffd027]" />}
          <RoleBadge role={role} className="flex-shrink-0" />
          <span translate="no" className="truncate">{name}</span>
          {kind === 'screen' && <span className="text-white/70 font-semibold flex-shrink-0">· Tela</span>}
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {sharing && (
            <div className="flex p-1 rounded-full bg-black/55">
              <button
                type="button"
                data-testid="focus-kind-camera"
                aria-pressed={kind === 'camera'}
                onClick={() => setCallFocus({ id: callFocus.id, kind: 'camera' })}
                className={`h-7 px-3 rounded-full text-[11px] font-extrabold flex items-center gap-1 transition-colors ${
                  kind === 'camera' ? 'bg-white text-slate-950' : 'text-white/80 hover:text-white'
                }`}
              >
                <Video className="w-3 h-3" /> <span>Câmera</span>
              </button>
              <button
                type="button"
                data-testid="focus-kind-screen"
                aria-pressed={kind === 'screen'}
                onClick={() => setCallFocus({ id: callFocus.id, kind: 'screen' })}
                className={`h-7 px-3 rounded-full text-[11px] font-extrabold flex items-center gap-1 transition-colors ${
                  kind === 'screen' ? 'bg-white text-slate-950' : 'text-white/80 hover:text-white'
                }`}
              >
                <Monitor className="w-3 h-3" /> <span>Tela</span>
              </button>
            </div>
          )}
          {kind === 'screen' && (
            <div className="flex items-center rounded-full bg-black/55 text-white p-0.5">
              <button
                type="button"
                onClick={() => changeZoom(zoom - 0.25)}
                disabled={zoom <= 1}
                title="Diminuir zoom"
                aria-label="Diminuir zoom"
                className="p-1.5 rounded-full hover:bg-white/15 disabled:opacity-40"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1)}
                title="Voltar ao tamanho normal (100%)"
                className="px-1.5 text-[11px] font-mono font-bold hover:text-[#ffd027]"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => changeZoom(zoom + 0.25)}
                disabled={zoom >= 4}
                title="Aumentar zoom"
                aria-label="Aumentar zoom"
                className="p-1.5 rounded-full hover:bg-white/15 disabled:opacity-40"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            data-testid="focus-fullscreen"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            onClick={toggleFullscreen}
            className="h-9 px-3 rounded-full bg-black/55 hover:bg-black/75 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
          </button>
          <button
            type="button"
            data-testid="focus-exit"
            title="Sair do foco"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              setCallFocus(null);
            }}
            className="h-9 px-3.5 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5 stroke-[3]" />
            <span className="hidden sm:inline">Sair do foco</span>
          </button>
        </div>
      </div>

      <span className="absolute left-3 bottom-3 z-10 px-2 py-1.5 rounded-md bg-black/55 text-white flex items-center">
        {micOn ? <Mic className={`w-4 h-4 ${speaking ? 'text-emerald-400' : 'text-slate-300'}`} /> : <MicOff className="w-4 h-4 text-rose-400" />}
      </span>
    </div>
  );
}
