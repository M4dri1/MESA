'use client';

import React, { useRef, useState } from 'react';
import { AtSign, Camera, Check, LogOut, Mail, ShieldCheck, Trash2, User } from 'lucide-react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';

const fieldClass =
  'w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#f6f5f0] border border-slate-900/10 focus:border-[#3044f0] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors';
const labelClass = 'text-xs font-bold text-slate-700 block mb-1.5';

/** Seção "Minha conta": foto, nome, nickname e status. É aqui que se edita o perfil. */
export function AccountPanel({ onLogout }: { onLogout: () => void }) {
  const { currentUser, updateUserProfile } = useMesa();

  const [fullName, setFullName] = useState(currentUser.fullName || currentUser.name || '');
  const [nickname, setNickname] = useState(currentUser.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatarUrl || '');
  const [statusText, setStatusText] = useState(currentUser.statusText || 'Pronto para estudar');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Escolha um arquivo de imagem para a foto de perfil.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => setAvatarUrl(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateUserProfile({
      fullName: fullName.trim(),
      name: nickname.trim() || fullName.trim().split(' ')[0] || 'Estudante',
      avatarUrl,
      statusText: statusText.trim(),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || 'Não foi possível salvar o perfil.');
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const letter = (nickname.trim()[0] || fullName.trim()[0] || 'U').toUpperCase();

  return (
    <div data-testid="account-panel">
      <h2 className="landing-display text-2xl text-slate-950 flex items-center gap-2">
        <User className="w-5 h-5 text-[#3044f0]" /> Minha conta
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-5">Seus dados no Mesa. Eles aparecem para quem estuda com você.</p>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Foto de perfil */}
        <div className="p-4 rounded-xl bg-[#f6f5f0] border border-slate-900/10 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <Avatar letter={letter} avatarUrl={avatarUrl} color={currentUser.avatarColor || '#2563eb'} size="lg" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Alterar foto de perfil"
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 transition-colors"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-900 block">Foto de Perfil</span>
            <span className="text-[11px] text-slate-500 block mb-1.5">Essa imagem aparecerá nas suas salas de estudo, chamadas e mensagens.</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-[#3044f0] hover:text-[#2334c9]">
                {avatarUrl ? 'Trocar foto' : 'Enviar foto'}
              </button>
              {avatarUrl && (
                <button type="button" onClick={() => setAvatarUrl('')} className="text-xs font-medium text-rose-600 hover:text-rose-300 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Remover foto
                </button>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" data-testid="profile-photo-input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-fullname" className={labelClass}>
              Nome Completo
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="profile-fullname"
                data-testid="profile-fullname"
                type="text"
                required
                maxLength={80}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-nickname" className={labelClass}>
              Nickname (Nome Aparente na Sala)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="profile-nickname"
                data-testid="profile-nickname"
                type="text"
                required
                minLength={3}
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value.replace(/\s/g, ''))}
                placeholder="Ex: Carlos"
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="profile-email" className="text-xs font-bold text-slate-700 ">
              E-mail da Conta
            </label>
            {currentUser.isEmailVerified && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Verificado
              </span>
            )}
          </div>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="profile-email"
              type="email"
              disabled
              value={currentUser.email || ''}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/5 border border-slate-900/10 text-sm text-slate-500 cursor-not-allowed select-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="profile-status" className={labelClass}>
            Status Atual
          </label>
          <input
            id="profile-status"
            data-testid="profile-status"
            type="text"
            maxLength={80}
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            placeholder="Ex: Focado em Cálculo II"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f6f5f0] border border-slate-900/10 focus:border-[#3044f0] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
          />
        </div>

        {error && (
          <div role="alert" data-testid="profile-error" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-700">
            {error}
          </div>
        )}
        {saved && (
          <div role="status" data-testid="profile-saved" className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4" />
            <span>Perfil atualizado com sucesso!</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="submit"
            data-testid="profile-save"
            disabled={saving}
            className="h-11 px-6 rounded-full bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-extrabold transition-colors"
          >
            Salvar Alterações
          </button>
          <button
            type="button"
            data-testid="settings-logout"
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair da Conta
          </button>
        </div>
      </form>
    </div>
  );
}
