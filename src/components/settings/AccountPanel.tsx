'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Camera, Check, ChevronDown, Image as ImageIcon, LogOut, Mail, Music2, Play, ShieldCheck, Trash2, Upload, User } from 'lucide-react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import { ImagePickerModal } from '@/components/common/ImagePickerModal';
import { mediaTransformStyle } from '@/utils/mediaTransform';
import { playClip } from '@/utils/soundpadPlayer';
import { playJoinRoomSound } from '@/utils/soundEffects';

const fieldClass =
  'w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#f6f5f0] border border-slate-900/10 focus:border-[#3044f0] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors';
const labelClass = 'text-xs font-bold text-slate-700 block mb-1.5';

/** Seção "Minha conta": foto, banner, som de entrada, nome, nickname e status. É aqui que se edita o perfil. */
export function AccountPanel({
  onLogout,
  onDirtyChange,
}: {
  onLogout: () => void;
  onDirtyChange?: (dirty: boolean, saveNow: () => Promise<boolean>) => void;
}) {
  const { currentUser, updateUserProfile, sounds, addSound, padVolume } = useMesa();

  const [fullName, setFullName] = useState(currentUser.fullName || currentUser.name || '');
  const [nickname, setNickname] = useState(currentUser.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState<string>(currentUser.bannerUrl || '');
  const [bannerColor, setBannerColor] = useState<string>(currentUser.bannerColor || currentUser.avatarColor || '#2563eb');
  const [borderColor, setBorderColor] = useState<string>(currentUser.borderColor || '');
  const [joinSoundId, setJoinSoundId] = useState<string>(currentUser.joinSoundId || '');
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
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
      return;
    }
    if (res.soundId) {
      setJoinSoundId(res.soundId);
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

  const performSave = async (): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateUserProfile({
      fullName: fullName.trim(),
      name: nickname.trim() || fullName.trim().split(' ')[0] || 'Estudante',
      avatarUrl,
      bannerUrl,
      bannerColor,
      borderColor,
      joinSoundId,
      statusText: statusText.trim(),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || 'Não foi possível salvar o perfil.');
      return false;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSave();
  };

  const isDirty =
    fullName.trim() !== (currentUser.fullName || currentUser.name || '') ||
    nickname.trim() !== (currentUser.name || '') ||
    avatarUrl !== (currentUser.avatarUrl || '') ||
    bannerUrl !== (currentUser.bannerUrl || '') ||
    bannerColor !== (currentUser.bannerColor || currentUser.avatarColor || '#2563eb') ||
    borderColor !== (currentUser.borderColor || '') ||
    joinSoundId !== (currentUser.joinSoundId || '') ||
    statusText.trim() !== (currentUser.statusText || 'Pronto para estudar');

  const saveRef = useRef(performSave);
  saveRef.current = performSave;

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty, () => saveRef.current());
    }
  }, [isDirty, onDirtyChange]);

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
            className="relative h-28 w-full flex items-end justify-end p-2.5 overflow-hidden"
            style={{
              backgroundColor: bannerColor || currentUser.avatarColor || '#2563eb',
            }}
          >
            {bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                alt="Banner"
                style={mediaTransformStyle(bannerUrl)}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
            )}
            <div className="relative z-10 flex items-center gap-1.5">
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
            <div
              className="relative -mt-9 inline-flex flex-shrink-0 rounded-full"
              style={{ boxShadow: `0 0 0 4px ${borderColor || '#f6f5f0'}` }}
            >
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

          {/* Cores do perfil: Cor do banner (quando não tem foto) e Cor da borda da foto */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-900/10 grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            <label className="p-2.5 rounded-xl bg-white border border-slate-900/10 cursor-pointer flex flex-col justify-between">
              <div>
                <span className="block text-xs font-bold text-slate-900">Cor do banner</span>
                <span className="block text-[11px] text-slate-500 mb-1.5">Aparece quando você não usa foto no banner</span>
              </div>
              <input
                type="color"
                data-testid="profile-banner-color"
                value={bannerColor}
                onChange={(e) => setBannerColor(e.target.value)}
                className="w-full h-8 rounded-lg bg-transparent cursor-pointer"
              />
            </label>
            <label className="p-2.5 rounded-xl bg-white border border-slate-900/10 cursor-pointer flex flex-col justify-between">
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="block text-xs font-bold text-slate-900">Cor da borda da foto</span>
                  <span className="block text-[11px] text-slate-500 mb-1.5">Contorno exclusivo em volta do seu avatar</span>
                </div>
                {borderColor && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setBorderColor('');
                    }}
                    className="text-[10px] font-bold text-[#3044f0] hover:underline flex-shrink-0"
                  >
                    Padrão
                  </button>
                )}
              </div>
              <input
                type="color"
                data-testid="profile-border-color"
                value={borderColor || '#ffd027'}
                onChange={(e) => setBorderColor(e.target.value)}
                className="w-full h-8 rounded-lg bg-transparent cursor-pointer"
              />
            </label>
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
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                id="profile-join-sound"
                data-testid="profile-join-sound"
                aria-expanded={soundMenuOpen}
                onClick={() => setSoundMenuOpen((v) => !v)}
                className="w-full h-9 px-3.5 rounded-xl bg-white border border-slate-900/10 hover:border-[#3044f0] text-xs font-semibold text-slate-900 flex items-center justify-between gap-2 transition-colors focus:outline-none focus:border-[#3044f0]"
              >
                <span className="truncate">
                  {(() => {
                    const selected = sounds.find((s) => s.id === joinSoundId);
                    return selected ? `${selected.emoji} ${selected.name}` : 'Som padrão do Mesa (sino suave)';
                  })()}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${soundMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {soundMenuOpen && (
                <div className="absolute left-0 right-0 top-10 z-30 rounded-xl bg-white border border-slate-900/10 shadow-xl p-1 max-h-48 overflow-y-auto space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setJoinSoundId('');
                      setSoundMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                      !joinSoundId ? 'bg-[#3044f0]/10 text-[#3044f0]' : 'text-slate-800 hover:bg-slate-900/5'
                    }`}
                  >
                    <span className="truncate">Som padrão do Mesa (sino suave)</span>
                    {!joinSoundId && <Check className="w-3.5 h-3.5 text-[#3044f0] flex-shrink-0" />}
                  </button>
                  {sounds.map((s) => {
                    const active = joinSoundId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setJoinSoundId(s.id);
                          setSoundMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                          active ? 'bg-[#3044f0]/10 text-[#3044f0]' : 'text-slate-800 hover:bg-slate-900/5'
                        }`}
                      >
                        <span className="truncate">
                          {s.emoji} {s.name}
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-[#3044f0] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
