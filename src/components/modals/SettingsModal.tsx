'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Accessibility, Bell, Languages, Palette, User, X } from 'lucide-react';
import { SettingsSection, useMesa } from '@/context/MesaContext';
import { PresenceSettings } from '@/components/common/PresenceSettings';
import { AppearancePanel } from '@/components/modals/AppearancePanel';
import { AccountPanel } from '@/components/settings/AccountPanel';
import { AccessibilityPanel } from '@/components/settings/AccessibilityPanel';
import { LanguagePanel } from '@/components/settings/LanguagePanel';

type Tab = { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }>; needsAccount: boolean };

const TABS: Tab[] = [
  { id: 'account', label: 'Minha conta', icon: User, needsAccount: true },
  { id: 'appearance', label: 'Aparência', icon: Palette, needsAccount: true },
  { id: 'notifications', label: 'Notificações', icon: Bell, needsAccount: true },
  { id: 'accessibility', label: 'Acessibilidade', icon: Accessibility, needsAccount: false },
  { id: 'language', label: 'Idioma', icon: Languages, needsAccount: false },
];

/**
 * Configurações do Mesa, no estilo do Discord: lista de seções à esquerda e o conteúdo ao lado.
 * Antes de entrar na conta só aparecem Acessibilidade e Idioma, que valem para o aparelho todo.
 */
export function SettingsModal() {
  const { settingsSection, openSettings, closeSettings, isAuthenticated, logout } = useMesa();
  const [accountDirty, setAccountDirty] = useState(false);
  const accountSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const [unsavedPrompt, setUnsavedPrompt] = useState<{ action: 'close' | 'tab'; tab?: SettingsSection } | null>(null);
  const [savingBeforeLeave, setSavingBeforeLeave] = useState(false);

  const requestClose = () => {
    if (settingsSection === 'account' && accountDirty) {
      setUnsavedPrompt({ action: 'close' });
      return;
    }
    closeSettings();
  };

  const requestTab = (tab: SettingsSection) => {
    if (tab === settingsSection) return;
    if (settingsSection === 'account' && accountDirty) {
      setUnsavedPrompt({ action: 'tab', tab });
      return;
    }
    openSettings(tab);
  };

  useEffect(() => {
    if (!settingsSection) {
      setAccountDirty(false);
      setUnsavedPrompt(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (unsavedPrompt) setUnsavedPrompt(null);
        else requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSection, accountDirty, unsavedPrompt]);

  if (!settingsSection) return null;

  const tabs = TABS.filter((tab) => isAuthenticated || !tab.needsAccount);
  const active = tabs.find((tab) => tab.id === settingsSection) || tabs[0];

  const executePending = (prompt: { action: 'close' | 'tab'; tab?: SettingsSection }) => {
    setAccountDirty(false);
    setUnsavedPrompt(null);
    if (prompt.action === 'close') closeSettings();
    else if (prompt.tab) openSettings(prompt.tab);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0b0f19]/70 animate-fadeIn" onClick={requestClose}>
      <div
        role="dialog"
        aria-label="Configurações"
        data-testid="settings-modal"
        onClick={(e) => e.stopPropagation()}
        className="mesa-paper relative w-full max-w-4xl h-[min(44rem,100%)] flex flex-col sm:flex-row bg-[#f6f5f0] text-slate-900 rounded-3xl overflow-hidden shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)]"
      >
        <div className="flex-shrink-0 flex items-start sm:block sm:w-64 min-w-0 bg-[#3044f0] text-white">
        <nav
          aria-label="Seções das configurações"
          className="flex-1 min-w-0 p-3 sm:p-4 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto no-scrollbar"
        >
          <p className="hidden sm:block landing-display text-base px-2 pt-3 pb-5">Configurações</p>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === active.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`settings-tab-${tab.id}`}
                aria-current={selected ? 'page' : undefined}
                onClick={() => requestTab(tab.id)}
                className={`flex-shrink-0 w-auto sm:w-full text-left px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2.5 whitespace-nowrap transition-colors ${
                  selected ? 'bg-white text-slate-950' : 'text-white hover:bg-white/15'
                }`}
              >
                <Icon className={`w-4 h-4 ${selected ? 'text-[#3044f0]' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* No celular o X fica ao lado das abas; no computador, no canto da janela */}
        <button
          type="button"
          data-testid="settings-close"
          onClick={requestClose}
          title="Fechar"
          className="flex-shrink-0 m-2 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors sm:m-0 sm:absolute sm:top-4 sm:right-4 sm:bg-slate-900/5 sm:text-slate-700 sm:hover:bg-slate-900/10"
        >
          <X className="w-5 h-5" />
        </button>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-5 sm:p-9">
          {active.id === 'account' && (
            <AccountPanel
              onDirtyChange={(dirty, saveFn) => {
                setAccountDirty(dirty);
                accountSaveRef.current = saveFn;
              }}
              onLogout={() => {
                setAccountDirty(false);
                closeSettings();
                logout();
              }}
            />
          )}
          {active.id === 'appearance' && <AppearancePanel />}
          {active.id === 'notifications' && (
            <div>
              <h2 className="landing-display text-2xl text-slate-950 flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-[#3044f0]" /> Notificações
              </h2>
              <PresenceSettings />
            </div>
          )}
          {active.id === 'accessibility' && <AccessibilityPanel />}
          {active.id === 'language' && <LanguagePanel />}
        </div>

        {unsavedPrompt && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f19]/75 animate-fadeIn"
            onClick={() => setUnsavedPrompt(null)}
          >
            <div
              role="alertdialog"
              aria-label="Alterações não salvas"
              data-testid="unsaved-profile-modal"
              onClick={(e) => e.stopPropagation()}
              className="mesa-paper w-full max-w-md rounded-3xl bg-[#f6f5f0] text-slate-900 p-6 shadow-2xl space-y-4 border border-slate-900/10"
            >
              <div>
                <h3 className="landing-display text-xl text-slate-950">Alterações não salvas</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Você alterou seu perfil (foto, banner ou dados), mas ainda não salvou. Deseja salvar antes de sair?
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUnsavedPrompt(null)}
                  className="h-10 px-4 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-900/10"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => executePending(unsavedPrompt)}
                  className="h-10 px-4 rounded-full bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 text-xs font-bold"
                >
                  Sair sem salvar
                </button>
                <button
                  type="button"
                  disabled={savingBeforeLeave}
                  onClick={async () => {
                    if (!accountSaveRef.current) return;
                    setSavingBeforeLeave(true);
                    const ok = await accountSaveRef.current();
                    setSavingBeforeLeave(false);
                    if (ok) executePending(unsavedPrompt);
                    else setUnsavedPrompt(null);
                  }}
                  className="h-10 px-5 rounded-full bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold"
                >
                  {savingBeforeLeave ? 'Salvando...' : 'Salvar e sair'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
