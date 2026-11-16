'use client';

import React, { useState, useEffect } from 'react';
import { useMesa, untilLabel } from '@/context/MesaContext';
import { DocumentSheet } from './DocumentSheet';
import { VideoGrid } from './VideoGrid';
import { FocusStage } from './FocusStage';
import { ControlBar } from './ControlBar';
import { ChatAndMaterialsPanel } from './ChatAndMaterialsPanel';
import {
  Volume2,
  Clock,
  Users,
  ArrowLeft,
  MessageSquare,
  Files,
  LayoutGrid,
  Presentation,
  FileEdit,
  UserPlus,
  Wifi,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';

export function StudyRoomView() {
  const {
    currentRoom,
    setCurrentRoomId,
    currentUser,
    callViewMode,
    setCallViewMode,
    callFocus,
    setCallFocus,
    isChatPanelOpen,
    setIsInviteModalOpen,
    isConnected,
    isPunished,
    myPunishedUntil,
  } = useMesa();

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<'study' | 'chat'>('study');

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Se quem estava em foco não está mais na sala, o foco acaba (mesmo que o palco de foco já tenha sumido)
  const focusGone = !!callFocus && callFocus.id !== currentUser.id && !(currentRoom && currentRoom.members.some((m) => m.id === callFocus.id));
  useEffect(() => {
    if (focusGone) setCallFocus(null);
  }, [focusGone, setCallFocus]);

  if (!currentRoom) return null;

  // Em foco só vale quem ainda está na sala (você mesmo sempre vale)
  const focusActive = !!callFocus && (callFocus.id === currentUser.id || currentRoom.members.some((m) => m.id === callFocus.id));

  const hours = Math.floor(secondsElapsed / 3600);
  const minutes = Math.floor((secondsElapsed % 3600) / 60);
  const formattedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

  return (
    <div className="flex-1 min-w-0 flex flex-col md:flex-row md:gap-3 h-full overflow-hidden">
      {/* Center Main Stage (Slide 11 & Discord-like Clean Call) */}
      <div
        className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#0b0f19] md:rounded-3xl transition-all ${
          mobilePanel === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Discord-style Stage Header */}
        <div className="h-16 px-4 sm:px-6 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 z-20">
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            <button
              onClick={() => setCurrentRoomId(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white md:hidden"
              title="Voltar para Minhas Salas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-bold text-sm text-white whitespace-nowrap">Mesa principal</span>
              <span className="text-slate-500 hidden 2xl:inline">•</span>
              <span translate="no" className="text-xs font-semibold text-slate-300 hidden 2xl:inline truncate max-w-[200px]">
                {currentRoom.name}
              </span>
            </div>

            {/* Green Voice Connection Badge (Discord style) */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span>{isConnected ? 'Conectado' : 'Reconectando...'}</span>
            </div>

            <div className="hidden 2xl:flex items-center gap-1.5 text-xs text-slate-400 border-l border-slate-800 pl-3 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>estudando há {formattedTime}</span>
            </div>
          </div>

          {/* Center Call View Mode Switcher */}
          <div className="hidden md:flex items-center p-1 rounded-full bg-white/10">
            <button
              type="button"
              onClick={() => {
                setCallViewMode('stage');
                setCallFocus(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                callViewMode === 'stage'
                  ? 'bg-white text-slate-950'
                  : 'text-white/70 hover:text-white'
              }`}
              title="Visualização com Material/Tela compartilhada"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>Palco</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCallViewMode('grid');
                setCallFocus(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                callViewMode === 'grid'
                  ? 'bg-white text-slate-950'
                  : 'text-white/70 hover:text-white'
              }`}
              title="Grade de vídeo estilo Discord com foco nos participantes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grade</span>
            </button>
          </div>

          {/* Member Avatars Stack & Right Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden sm:flex items-center -space-x-1.5">
              {currentRoom.members.map((member) => (
                <div key={member.id} className="ring-2 ring-[#0b0f19] rounded-full" title={member.name}>
                  <Avatar
                    letter={member.avatarLetter}
                    avatarUrl={member.avatarUrl}
                    color={member.avatarColor}
                    size="sm"
                  />
                </div>
              ))}
              <div className="ring-2 ring-[#0b0f19] rounded-full" title={`${currentUser.name} (Você)`}>
                <Avatar
                  letter={currentUser.avatarLetter}
                  avatarUrl={currentUser.avatarUrl}
                  color={currentUser.avatarColor}
                  size="sm"
                />
              </div>
            </div>

            {/* Invite button */}
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 text-xs font-extrabold transition-colors"
              title="Convidar colegas para esta call"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Convidar</span>
            </button>

            {/* Mobile Chat Switcher Button */}
            <button
              onClick={() => setMobilePanel('chat')}
              className="md:hidden p-2 rounded-xl bg-[#ffd027] text-slate-950 text-xs font-bold flex items-center gap-1.5 "
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>
          </div>
        </div>

        {/* Study Presentation Viewport (Slide 11 Center & Discord Call Stage) */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto p-2 sm:p-4 relative">
          {focusActive ? (
            <>
              <FocusStage />
              <VideoGrid strip />
            </>
          ) : callViewMode === 'stage' ? (
            <>
              <DocumentSheet />
              <VideoGrid />
            </>
          ) : (
            <VideoGrid />
          )}
        </div>

        {isPunished && (
          <div
            role="status"
            data-testid="punished-banner"
            className="mx-4 mb-1 px-3 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 text-xs font-semibold text-rose-200 text-center"
          >
            Você está de castigo nesta sala {untilLabel(myPunishedUntil)}: sem microfone, câmera, tela, chat e lousa.
          </div>
        )}

        {/* Bottom Floating Control Bar */}
        <ControlBar
          showChatToggle={true}
          onToggleChat={() => setMobilePanel('chat')}
        />
      </div>

      {/* Right Column: Chat and Materials (Slide 8 & 11) */}
      <div
        className={`h-full md:rounded-3xl overflow-hidden transition-all ${
          mobilePanel === 'study'
            ? isChatPanelOpen
              ? 'hidden md:flex'
              : 'hidden'
            : 'flex w-full md:w-auto'
        }`}
      >
        {/* On mobile, provide a back to stage button */}
        {mobilePanel === 'chat' && (
          <div className="md:hidden fixed top-[10px] left-[134px] z-50">
            <button
              onClick={() => setMobilePanel('study')}
              title="Voltar para a mesa"
              aria-label="Voltar para a mesa"
              className="h-9 px-2.5 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 text-xs font-extrabold flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden min-[430px]:inline">Voltar para a mesa</span>
            </button>
          </div>
        )}
        <ChatAndMaterialsPanel />
      </div>
    </div>
  );
}
