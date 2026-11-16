'use client';

import React, { useEffect } from 'react';
import { useMesa } from '@/context/MesaContext';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { SidebarLeft } from '@/components/navigation/SidebarLeft';
import { SidebarRightFriends } from '@/components/navigation/SidebarRightFriends';
import { MinhasSalasView } from '@/components/rooms/MinhasSalasView';
import { StudyRoomView } from '@/components/room/StudyRoomView';
import { LandingView } from '@/components/landing/LandingView';
import { CreateRoomModal } from '@/components/modals/CreateRoomModal';
import { RoomSettingsModal } from '@/components/modals/RoomSettingsModal';
import { InviteModal } from '@/components/modals/InviteModal';
import { JoinByCodeModal } from '@/components/modals/JoinByCodeModal';
import { DocumentViewerModal } from '@/components/modals/DocumentViewerModal';
import { ParticipantModal } from '@/components/modals/ParticipantModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { initPrefs } from '@/lib/preferences';
import { startI18n } from '@/lib/i18n';
import { applyTheme, clearTheme, loadTheme, saveTheme } from '@/lib/theme';
import { AuthModal } from '@/components/auth/AuthModal';
import { AlertCircle, X } from 'lucide-react';

export function MainApp() {
  const {
    currentRoom,
    currentUser,
    mediaNotice,
    clearMediaNotice,
    isAuthenticated,
    isAuthLoading,
    isInviteModalOpen,
    setIsInviteModalOpen,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isJoinCodeModalOpen,
    setIsJoinCodeModalOpen,
    activeDocument,
    setActiveDocument,
    participantMenuId,
    setParticipantMenuId,
    roomSettingsId,
    closeRoomSettings,
  } = useMesa();

  // Esc fecha a janela que estiver aberta por cima (uma por vez; as Configurações têm o próprio atalho)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (roomSettingsId) closeRoomSettings();
      else if (participantMenuId) setParticipantMenuId(null);
      else if (activeDocument) setActiveDocument(null);
      else if (isInviteModalOpen) setIsInviteModalOpen(false);
      else if (isCreateModalOpen) setIsCreateModalOpen(false);
      else if (isJoinCodeModalOpen) setIsJoinCodeModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [roomSettingsId, participantMenuId, activeDocument, isInviteModalOpen, isCreateModalOpen, isJoinCodeModalOpen, closeRoomSettings, setParticipantMenuId, setActiveDocument, setIsInviteModalOpen, setIsCreateModalOpen, setIsJoinCodeModalOpen]);

  // Acessibilidade e idioma valem para o aparelho todo (até antes de entrar na conta)
  useEffect(() => {
    initPrefs();
    return startI18n();
  }, []);

  // O tema (cores) vale só dentro do app, separado por conta
  useEffect(() => {
    if (isAuthenticated && currentUser?.id) {
      const userTheme = loadTheme(currentUser.id);
      saveTheme(userTheme, currentUser.id);
      applyTheme(userTheme);
    } else {
      clearTheme();
    }
  }, [isAuthenticated, currentUser?.id]);

  // Enquanto confere a sessão salva, não mostra nem a landing nem o app
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19]">
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-[#ffd027] text-xl font-black text-slate-950">
          M
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen w-screen text-slate-100 overflow-hidden font-sans ${isAuthenticated ? 'mesa-frame bg-[#3044f0]' : 'bg-[#0b0f19]'}`}>
      {/* Top Header (a tela inicial tem a própria navegação sobre o hero) */}
      {isAuthenticated && <TopNavigation />}

      {/* Notice toast if any */}
      {mediaNotice && (
        <div role="status" className="bg-[#ffd027] text-slate-950 font-semibold text-xs px-4 py-2 flex items-center justify-between z-40">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{mediaNotice}</span>
          </div>
          <button
            onClick={clearMediaNotice}
            className="p-1 hover:bg-black/10 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {!isAuthenticated ? (
          /* Unauthenticated Landing / Welcome Screen */
          <LandingView />
        ) : (
          /* Authenticated User Workspace */
          <div className="flex-1 flex h-full overflow-hidden md:pb-3 md:pr-3">
            {/* Left Sidebar / Dock */}
            <SidebarLeft />

            {/* Center Area: Minhas Salas or Study Room */}
            {currentRoom ? (
              <StudyRoomView />
            ) : (
              <>
                <MinhasSalasView />
                <SidebarRightFriends />
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal />
      <RoomSettingsModal />
      <InviteModal />
      <JoinByCodeModal />
      <DocumentViewerModal />
      <ParticipantModal />
      <SettingsModal />
      <AuthModal />
    </div>
  );
}
