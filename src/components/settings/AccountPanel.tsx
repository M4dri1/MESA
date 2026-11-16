'use client';

import React, { useRef, useState } from 'react';
import { AtSign, Camera, Check, Image as ImageIcon, LogOut, Mail, Music2, Play, ShieldCheck, Trash2, Upload, User } from 'lucide-react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import { ImagePickerModal } from '@/components/common/ImagePickerModal';
import { playClip } from '@/utils/soundpadPlayer';
import { playJoinRoomSound } from '@/utils/soundEffects';

const fieldClass =
  'w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#f6f5f0] border border-slate-900/10 focus:border-[#3044f0] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors';
const labelClass = 'text-xs font-bold text-slate-700 block mb-1.5';

/** Seção "Minha conta": foto, banner, som de entrada, nome, nickname e status. É aqui que se edita o perfil. */
export function AccountPanel({ onLogout }: { onLogout: () => void }) {
  const { currentUser, updateUserProfile, sounds, addSound, padVolume } = useMesa();

  const [fullName, setFullName] = useState(currentUser.fullName || currentUser.name || '');
  const [nickname, setNickname] = useState(currentUser.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState<string>(currentUser.bannerUrl || '');
  const [joinSoundId, setJoinSoundId] = useState<string>(currentUser.joinSoundId || '');
  const [uploadingSound, setUploadingSound] = useState(false);
  const [statusText, setStatusText] = useState(currentUser.statusText || 'Pronto para estudar');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'avatar' | 'banner' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);

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

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (bannerInputRef.current) bannerInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Escolha um arquivo de imagem para o banner do perfil.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => setBannerUrl(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (soundInputRef.current) soundInputRef.current.value = '';
    if (!file) return;
    setUploadingSound(true);
    setError(null);
    try {
      const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const tempCtx = new Ctx();
        const decoded = await tempCtx.decodeAudioData(await file.arrayBuffer());
        await tempCtx.close().catch(() => {});
        if (decoded.duration > 5.2) {
          setUploadingSound(false);
          setError('O som de entrada na call pode ter no máximo 5 segundos.');
          return;
        }
      }
    } catch {}
    const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Entrada';
    const res = await addSound(file, { name: baseName, emoji: '🎺' });
    setUploadingSound(false);
    if (!res.ok) {
      setError(res.error || 'Não foi possível enviar o áudio.');
    }
  };

  const previewJoinSound = () => {
    if (!joinSoundId) {
      playJoinRoomSound();
      return;
    }
    const found = sounds.find((s) => s.id === joinSoundId);
    if (found) void playClip(found.url, padVolume, 5);
    else playJoinRoomSound();
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
      bannerUrl,
      joinSoundId,
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
        {/* Cartão de Perfil com Banner + Foto */}
        <div className="rounded-2xl bg-[#f6f5f0] border border-slate-900/10 overflow-hidden">
          <div
            className="relative h-28 w-full flex items-end justify-end p-2.5 bg-cover bg-center"
            style={{
              backgroundColor: currentUser.avatarColor || '#2563eb',
              backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
            }}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPickerTarget('banner')}
                className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-sm transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{bannerUrl ? 'Trocar banner / GIF' : 'Adicionar banner / GIF'}</span>
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => setBannerUrl('')}
                  title="Remover banner"
                  className="p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerSelect} className="hidden" data-testid="profile-banner-input" />
          </div>

          <div className="px-4 pb-4 pt-2 flex items-center gap-4">
            <div className="relative -mt-9 inline-flex flex-shrink-0 ring-4 ring-[#f6f5f0] rounded-full">
              <Avatar letter={letter} avatarUrl={avatarUrl} color={currentUser.avatarColor || '#2563eb'} size="lg" />
              <button
                type="button"
                onClick={() => setPickerTarget('avatar')}
                title="Alterar foto de perfil ou GIF"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 transition-colors"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-900 block">Foto de Perfil e Banner</span>
              <span className="text-[11px] text-slate-500 block mb-1">Envie e posicione uma foto ou escolha um GIF animado.</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPickerTarget('avatar')} className="text-xs font-bold text-[#3044f0] hover:text-[#2334c9]">
                  {avatarUrl ? 'Trocar foto / GIF' : 'Escolher foto / GIF'}
                </button>
                {avatarUrl && (
                  <button type="button" onClick={() => setAvatarUrl('')} className="text-xs font-medium text-rose-600 hover:text-rose-400 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remover foto
                  </button>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" data-testid="profile-photo-input" />
          </div>
        </div>

        <ImagePickerModal
          open={pickerTarget !== null}
          shape={pickerTarget === 'banner' ? 'banner' : 'avatar'}
          title={pickerTarget === 'banner' ? 'Banner do perfil' : 'Foto de perfil'}
          initialUrl={pickerTarget === 'banner' ? bannerUrl : avatarUrl}
          onClose={() => setPickerTarget(null)}
          onSelect={(url) => {
            if (pickerTarget === 'banner') setBannerUrl(url);
            else setAvatarUrl(url);
          }}
        />

        {/* Som de entrada na call (customizável, até 5s) */}
        <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-slate-900/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label htmlFor="profile-join-sound" className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-[#3044f0]" /> Som de entrada na call (até 5 s)
              </label>
              <span className="text-[11px] text-slate-500 block">
                Escolha um áudio curto (máx. 5 segundos) para tocar quando você entrar na chamada.
              </span>
            </div>
            <button
              type="button"
              onClick={() => soundInputRef.current?.click()}
              disabled={uploadingSound}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-900/10 hover:border-[#3044f0] text-slate-900 text-[11px] font-bold flex items-center gap-1.5 flex-shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-[#3044f0]" />
              <span>{uploadingSound ? 'Enviando...' : 'Enviar áudio (5 s)'}</span>
            </button>
            <input ref={soundInputRef} type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" />
          </div>
          <div className="flex items-center gap-2">
            <select
              id="profile-join-sound"
              data-testid="profile-join-sound"
              value={joinSoundId}
              onChange={(e) => setJoinSoundId(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-slate-900/10 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#3044f0]"
            >
              <option value="">Som padrão do Mesa (sino suave)</option>
              {sounds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={previewJoinSound}
              title="Ouvir prévia do som de entrada"
              className="h-9 px-3 rounded-xl bg-[#0b0f19] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
            >
              <Play className="w-3.5 h-3.5" /> Ouvir
            </button>
          </div>
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
