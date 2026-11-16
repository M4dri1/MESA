'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMesa } from '@/context/MesaContext';
import { StreamVideo } from '@/components/common/StreamVideo';
import { Avatar } from '@/components/common/Avatar';
import { Whiteboard } from './Whiteboard';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Edit3,
  PenTool,
  Timer,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ExternalLink,
  CheckCircle,
  Eye,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export function DocumentSheet() {
  const {
    screenShare,
    screenSharers,
    toggleScreenShare,
    watchedScreenId,
    watchScreen,
    screenViewers,
    currentRoom,
    studyCenterMode,
    setStudyCenterMode,
    roomNotes,
    updateRoomNotes,
    pomodoroSeconds,
    isPomodoroRunning,
    pomodoroMode,
    togglePomodoro,
    resetPomodoro,
    uploadRealFile,
  } = useMesa();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenViewRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    const el = screenViewRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  const currentNotes = currentRoom ? roomNotes[currentRoom.id] || '' : '';

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (currentRoom) {
      updateRoomNotes(currentRoom.id, e.target.value);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadRealFile(file, { asDocument: true });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Format pomodoro time
  const pomoMinutes = Math.floor(pomodoroSeconds / 60);
  const pomoSecs = pomodoroSeconds % 60;
  const formattedPomodoro = `${pomoMinutes.toString().padStart(2, '0')}:${pomoSecs.toString().padStart(2, '0')}`;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 sm:p-3 select-none overflow-hidden">
      {/* Top Study Stage Selector Bar (Tela vs Anotações vs Pomodoro vs Enviar Arquivo) */}
      <div
        className={`w-full mx-auto mb-2 flex items-center justify-between gap-1 p-1 rounded-full bg-white/10 flex-shrink-0 ${
          studyCenterMode === 'board' ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStudyCenterMode('screen')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap flex-shrink-0 transition-all ${
              studyCenterMode === 'screen'
                ? 'bg-white text-slate-950'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Tela</span>
            {screenShare && !screenShare.isLocal && watchedScreenId !== screenShare.user.id && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" title="Alguém está compartilhando a tela" />
            )}
          </button>

          <button
            onClick={() => setStudyCenterMode('notepad')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap flex-shrink-0 transition-all ${
              studyCenterMode === 'notepad'
                ? 'bg-white text-slate-950'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Anotações</span>
          </button>

          <button
            onClick={() => setStudyCenterMode('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap flex-shrink-0 transition-all ${
              studyCenterMode === 'board'
                ? 'bg-white text-slate-950'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Lousa</span>
          </button>

          <button
            onClick={() => setStudyCenterMode('pomodoro')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap flex-shrink-0 transition-all ${
              studyCenterMode === 'pomodoro'
                ? 'bg-white text-slate-950'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Pomodoro</span>
            {isPomodoroRunning && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
            )}
          </button>
        </div>

        {/* Real File Upload Button */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelected}
            className="hidden"
            
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Enviar um PDF, imagem ou outro arquivo para a sala"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 text-xs font-extrabold transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enviar arquivo</span>
          </button>
        </div>
      </div>

      {/* Main Study Stage Viewport */}
      <div
        className={`relative w-full flex-1 bg-white rounded-2xl overflow-hidden flex flex-col justify-between ${
          studyCenterMode === 'board' ? 'max-w-5xl min-h-[320px]' : 'max-w-3xl'
        }`}
      >
        {/* MODO 1: TELA COMPARTILHADA (só assiste e ouve quem quiser) */}
        {studyCenterMode === 'screen' && (
          <div ref={screenViewRef} className="w-full h-full flex flex-col bg-black">
            {screenShare && (screenShare.isLocal || watchedScreenId === screenShare.user.id) ? (
              <>
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#ffd027] text-slate-950 font-bold text-xs flex-shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse flex-shrink-0" />
                    <span className="truncate" data-testid="screen-share-banner">
                      {screenShare.isLocal
                        ? 'Você está compartilhando a tela'
                        : `${screenShare.user.name} está compartilhando a tela`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {screenShare.isLocal ? (
                      <span data-testid="screen-viewers" data-count={screenViewers.length} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-900 flex-shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                        {screenViewers.length === 0
                          ? 'Ninguém assistindo ainda'
                          : screenViewers.length === 1
                          ? '1 pessoa assistindo'
                          : `${screenViewers.length} pessoas assistindo`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid="stop-watching"
                        onClick={() => {
                          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                          watchScreen(null);
                        }}
                        className="px-2 py-0.5 rounded-md bg-slate-950 text-white text-[11px] font-bold flex-shrink-0 hover:bg-slate-800"
                      >
                        Parar de assistir
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="screen-fullscreen"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                      aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                      className="px-2 py-0.5 rounded-md bg-slate-950 text-white text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:bg-slate-800"
                    >
                      {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                      <span className="hidden sm:inline">{isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
                    </button>
                  </div>
                </div>
                {!screenShare.isLocal && screenSharers.length > 1 && (
                  <div data-testid="screen-switcher" className="flex items-center gap-2 flex-wrap px-3 py-1.5 bg-[#0e1424] text-[11px] text-slate-200 flex-shrink-0">
                    <span className="font-semibold text-slate-400">Telas compartilhadas:</span>
                    {screenSharers.map((sharer) => (
                      <button
                        key={sharer.id}
                        type="button"
                        data-testid="switch-screen"
                        aria-pressed={sharer.id === screenShare.user.id}
                        onClick={() => watchScreen(sharer.id)}
                        translate="no"
                        className={`px-2.5 py-1 rounded-full font-bold transition-colors ${
                          sharer.id === screenShare.user.id ? 'bg-white text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {sharer.name}
                      </button>
                    ))}
                  </div>
                )}
                {screenShare.isLocal && screenViewers.length > 0 && (
                  <div data-testid="screen-viewers-list" className="flex items-center gap-2 flex-wrap px-3 py-1.5 bg-[#0e1424] text-[11px] text-slate-200 flex-shrink-0">
                    <span className="font-semibold text-slate-400">Assistindo:</span>
                    {screenViewers.map((viewer) => (
                      <span key={viewer.id} translate="no" className="inline-flex items-center gap-1.5 font-semibold" data-testid="screen-viewer">
                        <Avatar letter={viewer.avatarLetter} avatarUrl={viewer.avatarUrl} color={viewer.avatarColor} size="sm" />
                        {viewer.name}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  onDoubleClick={toggleFullscreen}
                  className="group relative w-full flex-1 min-h-0 bg-black flex items-center justify-center"
                >
                  {screenShare.stream ? (
                    <StreamVideo stream={screenShare.stream} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">Conectando à tela de {screenShare.user.name}...</span>
                  )}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                    aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                    className="absolute bottom-3 right-3 z-10 p-2 rounded-xl bg-black/65 hover:bg-black/90 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </>
            ) : screenShare ? (
              <div className="w-full flex-1 bg-[#3044f0] flex flex-col items-center justify-center gap-4 p-8 text-center">
                <Monitor className="w-10 h-10 text-[#ffd027]" />
                <h3 className="mesa-display text-2xl text-white" data-testid="screen-share-offer">
                  {screenSharers.length > 1 ? `${screenSharers.length} pessoas estão compartilhando a tela` : `${screenShare.user.name} está compartilhando a tela`}
                </h3>
                <p className="text-sm text-white/80 max-w-xs leading-relaxed">
                  Você só vê e ouve a tela se quiser. Dá para continuar na lousa, nas anotações ou só na conversa.
                </p>
                {screenSharers.length > 1 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {screenSharers.map((sharer) => (
                      <button
                        key={sharer.id}
                        type="button"
                        data-testid="watch-screen"
                        onClick={() => watchScreen(sharer.id)}
                        className="px-5 py-2.5 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 font-extrabold text-sm transition-colors"
                      >
                        {`Assistir à tela de ${sharer.name}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="watch-screen"
                    onClick={() => watchScreen(screenShare.user.id)}
                    className="px-6 py-2.5 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 font-extrabold text-sm transition-colors"
                  >
                    Assistir à tela
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full flex-1 bg-[#3044f0] flex flex-col items-center justify-center gap-4 p-8 text-center">
                <Monitor className="w-10 h-10 text-white/70" />
                <h3 className="mesa-display text-2xl text-white">Ninguém está compartilhando a tela</h3>
                <p className="text-sm text-white/80 max-w-xs leading-relaxed">
                  Compartilhe a sua para resolver um exercício junto, ou envie um PDF para a turma abrir.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={toggleScreenShare}
                    className="px-5 py-2.5 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 font-extrabold text-sm transition-colors"
                  >
                    Compartilhar minha tela
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 rounded-full border border-white/40 hover:bg-white/10 text-white font-bold text-sm transition-colors"
                  >
                    Enviar arquivo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODO: LOUSA COMPARTILHADA */}
        {studyCenterMode === 'board' && <Whiteboard />}

        {/* MODE 2: SHARED STUDY NOTEPAD */}
        {studyCenterMode === 'notepad' && (
          <div className="mesa-paper w-full h-full bg-[#f6f5f0] text-slate-900 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900/15">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#3044f0]" />
                <span className="mesa-display text-base text-slate-900">Bloco de Anotações Coletivo</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Sincronizado na sala
              </span>
            </div>

            <textarea
              value={currentNotes}
              onChange={handleNotesChange}
              placeholder="Digite aqui as anotações, resoluções de questões, dúvidas ou links para a turma..."
              className="flex-1 w-full bg-transparent px-1 py-0 my-2 text-[15px] text-slate-900 placeholder-slate-400 focus:outline-none resize-none"
              style={{ lineHeight: '28px', backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(48,68,240,0.16) 28px)', backgroundAttachment: 'local' }}
            />

            <div className="pt-2 border-t-2 border-slate-900/15 flex items-center justify-between text-xs text-slate-600">
              <span>Todos na sala veem o que você escreve aqui</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentNotes);
                  alert('Anotações copiadas para a área de transferência!');
                }}
                className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-700 text-white font-bold"
              >
                Copiar Notas
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: INTEGRATED POMODORO TIMER */}
        {studyCenterMode === 'pomodoro' && (
          <div className={`w-full h-full text-slate-950 p-8 flex flex-col items-center justify-center space-y-6 transition-colors ${pomodoroMode === 'break' ? 'bg-[#39d6a0]' : 'bg-[#ffd027]'}`}>
            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-black/10">
              <button
                onClick={() => resetPomodoro('focus')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  pomodoroMode === 'focus'
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-950/70 hover:text-slate-950'
                }`}
              >
                Foco (25 min)
              </button>
              <button
                onClick={() => resetPomodoro('break')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  pomodoroMode === 'break'
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-950/70 hover:text-slate-950'
                }`}
              >
                Pausa (5 min)
              </button>
            </div>

            {/* Countdown display */}
            <div className="mesa-display text-7xl md:text-8xl tabular-nums text-slate-950">
              {formattedPomodoro}
            </div>

            <p className="text-sm text-slate-950/75 text-center max-w-xs">
              {pomodoroMode === 'focus'
                ? 'Mantenha o foco nos estudos. Um alarme suave soará ao finalizar.'
                : 'Hora de esticar as pernas e descansar a mente!'}
            </p>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePomodoro}
                className={`px-7 py-3 rounded-full font-extrabold text-sm flex items-center gap-2 transition-all active:scale-95 ${
                  isPomodoroRunning ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-950 hover:bg-slate-800 text-white'
                }`}
              >
                {isPomodoroRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Iniciar Foco</span>
                  </>
                )}
              </button>

              <button
                onClick={() => resetPomodoro()}
                className="p-3 rounded-full bg-black/10 hover:bg-black/20 text-slate-950 transition-colors"
                title="Reiniciar timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
