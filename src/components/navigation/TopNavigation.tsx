'use client';

import React, { useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Volume2, VolumeX, LogOut, UserPlus, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { PRESENCE_OPTIONS } from '@/components/common/PresenceSettings';
import { Avatar } from '@/components/common/Avatar';

export function TopNavigation() {
  const {
    openAuthModal,
    isAuthenticated,
    logout,
    currentRoom,
    setCurrentRoomId,
    currentUser,
    soundEnabled,
    toggleSoundEffects,
    presence,
    setPresence,
    openSettings,
  } = useMesa();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const presenceOption = PRESENCE_OPTIONS.find((o) => o.id === presence);

  return (
    <header className="h-16 px-4 md:px-6 flex items-center justify-between flex-shrink-0 select-none z-30">
      {/* Marca: a mesma da tela inicial */}
      <div className="flex items-center gap-3">
        <div onClick={() => setCurrentRoomId(null)} className="flex items-center gap-2.5 cursor-pointer group">
          <div className="w-9 h-9 rounded-xl bg-[#ffd027] flex items-center justify-center font-black text-[#0b0f19] text-base group-hover:rotate-[-6deg] transition-transform">
            M
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">Mesa</span>
        </div>

        {/* Sala atual */}
        {currentRoom && (
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/25 text-sm text-white/70">
            <span translate="no" className="font-bold text-white">{currentRoom.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sons do app */}
        <button
          onClick={toggleSoundEffects}
          title={soundEnabled ? 'Sons estilo Discord ativados (clique para silenciar)' : 'Sons silenciados (clique para ativar)'}
          className="h-10 px-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-2 transition-colors"
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-4 h-4" />
              <span className="hidden lg:inline">Sons On</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-white/70" />
              <span className="hidden lg:inline text-white/70">Sons Off</span>
            </>
          )}
        </button>

        {isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="h-10 pl-1 pr-3 sm:pr-4 rounded-full bg-white hover:bg-[#f6f5f0] flex items-center gap-2.5 transition-colors"
              title="Meu Perfil"
            >
              <Avatar letter={currentUser.avatarLetter} avatarUrl={currentUser.avatarUrl} color={currentUser.avatarColor} size="sm" />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-extrabold text-slate-950 leading-tight">{currentUser.name}</span>
                <span className="text-[10px] text-slate-500 leading-tight font-semibold flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${presenceOption?.dot || 'bg-emerald-500'}`} /> {presenceOption?.label || 'Online'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
            </button>

            {/* Menu do perfil: papel creme, como os popups */}
            {showUserMenu && (
              <div
                onMouseLeave={() => setShowUserMenu(false)}
                className="mesa-paper absolute right-0 top-12 w-60 bg-[#f6f5f0] text-slate-900 rounded-2xl overflow-hidden z-50 animate-fadeIn shadow-[0_24px_48px_-12px_rgba(11,15,25,0.55)]"
              >
                {currentUser.bannerUrl && (
                  <div
                    className="h-14 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${currentUser.bannerUrl})` }}
                  />
                )}
                <div className="p-2">
                <div className="px-3 py-2.5 border-b border-slate-900/10 mb-1.5">
                  <span className="text-sm font-extrabold text-slate-950 block truncate">{currentUser.name}</span>
                  <span className="text-[11px] text-slate-500 truncate block">{currentUser.email || 'Conta Mesa'}</span>
                </div>

                <div className="pb-1.5 mb-1.5 border-b border-slate-900/10" data-testid="quick-status">
                  <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p>
                  {PRESENCE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      data-testid={`quick-status-${option.id}`}
                      aria-pressed={presence === option.id}
                      onClick={() => setPresence(option.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                        presence === option.id ? 'bg-slate-900/10 text-slate-950' : 'text-slate-700 hover:bg-slate-900/5'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${option.dot}`} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  data-testid="open-settings"
                  onClick={() => {
                    openSettings();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-900/5 flex items-center gap-2.5 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#3044f0]" />
                  <span>Configurações</span>
                </button>

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-600/10 flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da Conta</span>
                </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuthModal('login')}
              className="h-10 px-4 rounded-full text-white font-bold text-xs transition-colors hover:bg-white/10"
            >
              Entrar
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="h-10 px-4 rounded-full bg-white hover:bg-[#f6f5f0] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Criar Conta</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
