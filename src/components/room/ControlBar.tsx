'use client';

import React from 'react';
import { useMesa } from '@/context/MesaContext';
import { SoundpadButton } from './Soundpad';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, MessageSquare, Volume2, VolumeX, AudioLines, SlidersHorizontal } from 'lucide-react';

interface ControlBarProps {
  onToggleChat?: () => void;
  showChatToggle?: boolean;
}

/** Botão redondo da barra de controles: só o ícone (o nome fica na dica e para leitores de tela) */
const ROUND = 'relative flex-shrink-0 w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors';
const NEUTRAL = 'bg-white/10 hover:bg-white/20 text-white';

export function ControlBar({ onToggleChat, showChatToggle = false }: ControlBarProps) {
  const {
    isMicOn,
    isCameraOn,
    isScreenSharing,
    isDeafened,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    toggleDeafen,
    toggleChatPanel,
    isChatPanelOpen,
    setCurrentRoomId,
    noiseSuppression,
    toggleNoiseSuppression,
    openSettings,
    unread,
    screenViewers,
  } = useMesa();

  const handleChatClick = () => {
    if (onToggleChat) {
      onToggleChat();
    } else {
      toggleChatPanel();
    }
  };

  return (
    <div className="w-full flex items-center justify-center pt-2 pb-3 sm:pb-4 px-2 sm:px-3 z-20">
      <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-full bg-[#171e33] max-w-full overflow-x-auto no-scrollbar shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)]">
        {/* Microfone */}
        <button
          onClick={toggleMic}
          title={isMicOn ? 'Desativar microfone' : 'Ativar microfone'}
          className={`${ROUND} ${isMicOn ? NEUTRAL : 'bg-rose-500 hover:bg-rose-400 text-white'}`}
        >
          {isMicOn ? <Mic className="w-5 h-5 text-emerald-300" /> : <MicOff className="w-5 h-5" />}
          <span className="sr-only">Microfone</span>
        </button>

        {/* Supressão de ruído do meu microfone */}
        <button
          onClick={toggleNoiseSuppression}
          data-testid="noise-toggle"
          aria-pressed={noiseSuppression}
          title={noiseSuppression ? 'Supressão de ruído ligada (clique para desligar)' : 'Supressão de ruído desligada (clique para ligar)'}
          className={`${ROUND} ${noiseSuppression ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300' : `${NEUTRAL} text-white/55`}`}
        >
          <AudioLines className="w-5 h-5" />
          <span className="sr-only">Ruído</span>
        </button>

        {/* Escolher microfone e saída de áudio */}
        <button
          onClick={() => openSettings('voice')}
          title="Configurar microfone e saída de áudio"
          className={`${ROUND} ${NEUTRAL}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="sr-only">Voz e Áudio</span>
        </button>

        {/* Soundpad */}
        <SoundpadButton />

        <span className="hidden sm:block w-px h-6 bg-white/15 mx-0.5 flex-shrink-0" aria-hidden="true" />

        {/* Câmera */}
        <button
          onClick={toggleCamera}
          title={isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
          className={`${ROUND} ${isCameraOn ? 'bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950' : NEUTRAL}`}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-white/70" />}
          <span className="sr-only">Câmera</span>
        </button>

        {/* Compartilhar tela */}
        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
          className={`${ROUND} ${isScreenSharing ? 'bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950' : NEUTRAL}`}
        >
          <MonitorUp className="w-5 h-5" />
          <span className="sr-only">Tela</span>
          {isScreenSharing && screenViewers.length > 0 && (
            <span
              data-testid="screen-viewers-badge"
              title={screenViewers.length === 1 ? '1 pessoa assistindo' : `${screenViewers.length} pessoas assistindo`}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-950 text-[#ffd027] text-[10px] font-black flex items-center justify-center"
            >
              {screenViewers.length}
            </span>
          )}
        </button>

        {/* Áudio da chamada (deafen) */}
        <button
          onClick={toggleDeafen}
          title={isDeafened ? 'Ativar áudio da chamada' : 'Silenciar áudio da chamada'}
          className={`hidden md:flex ${ROUND} ${isDeafened ? 'bg-rose-500 hover:bg-rose-400 text-white' : NEUTRAL}`}
        >
          {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          <span className="sr-only">Áudio da chamada</span>
        </button>

        {/* Chat e materiais */}
        <button
          onClick={handleChatClick}
          title={isChatPanelOpen ? 'Ocultar chat e materiais' : 'Exibir chat e materiais'}
          className={`${ROUND} ${isChatPanelOpen ? 'bg-white hover:bg-[#f6f5f0] text-slate-950' : NEUTRAL}`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="sr-only">Chat</span>
          {unread.count > 0 && (
            <span
              data-testid="control-unread"
              className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${
                unread.mentions > 0 ? 'bg-rose-500 text-white' : 'bg-[#ffd027] text-slate-950'
              }`}
            >
              {unread.mentions > 0 ? `@${unread.mentions}` : unread.count}
            </span>
          )}
        </button>

        {/* Sair */}
        <button
          onClick={() => setCurrentRoomId(null)}
          title="Sair da sala de estudo"
          className="flex-shrink-0 h-9 sm:h-12 w-12 sm:w-16 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center transition-colors active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="sr-only">Sair</span>
        </button>
      </div>
    </div>
  );
}
