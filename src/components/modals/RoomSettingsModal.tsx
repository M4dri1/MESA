'use client';

import React, { useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Room } from '@/types';
import { Lock, Globe, Check, Camera, Trash2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { ModalShell, FIELD_LABEL, FIELD_INPUT, BTN_PRIMARY, BTN_GHOST } from '@/components/common/ModalShell';
import { shrinkAvatar } from '@/lib/api';
import { normalizeRoomColor } from '@/utils/roomColor';
import { COLOR_OPTIONS } from './CreateRoomModal';
import { ImagePickerModal } from '@/components/common/ImagePickerModal';
import { ColorField } from '@/components/common/ColorField';
import { mediaTransformStyle } from '@/utils/mediaTransform';

/** Configurações de uma sala que já existe: nome, matéria, quem pode entrar, cor e foto (dono e adm) */
export function RoomSettingsModal() {
  const { roomSettingsId, rooms, currentRoom } = useMesa();
  const room = roomSettingsId ? (currentRoom && currentRoom.id === roomSettingsId ? currentRoom : rooms.find((r) => r.id === roomSettingsId)) || null : null;
  if (!roomSettingsId || !room) return null;
  // "key": cada vez que abre (ou troca de sala) o formulário nasce de novo, já preenchido com o que a sala tem hoje
  return <RoomSettingsForm key={roomSettingsId} room={room} />;
}

function RoomSettingsForm({ room }: { room: Room }) {
  const { closeRoomSettings, updateRoom, notify } = useMesa();

  const [name, setName] = useState(room.name);
  const [subject, setSubject] = useState(room.subject === 'Geral' ? '' : room.subject);
  const [color, setColor] = useState(/^#[0-9a-f]{6}$/i.test(room.color || '') ? room.color : COLOR_OPTIONS[0].value);
  const [isPrivate, setIsPrivate] = useState(!!room.isPrivate);
  const [isHidden, setIsHidden] = useState(room.isHidden !== false);
  const [password, setPassword] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [iconUrl, setIconUrl] = useState(room.iconUrl || '');
  const [iconChanged, setIconChanged] = useState(false);
  const [iconError, setIconError] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const canEdit = room.myRole === 'owner' || room.myRole === 'admin';
  const isPreset = COLOR_OPTIONS.some((col) => col.value === color);
  const isDirty =
    name.trim() !== room.name ||
    (subject.trim() || 'Geral') !== room.subject ||
    color !== (room.color || COLOR_OPTIONS[0].value) ||
    isPrivate !== !!room.isPrivate ||
    (isPrivate && isHidden !== (room.isHidden !== false)) ||
    passwordChanged ||
    iconChanged;

  const requestClose = () => {
    if (canEdit && isDirty) {
      setShowUnsavedPrompt(true);
      return;
    }
    closeRoomSettings();
  };

  const handleIconFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (iconInputRef.current) iconInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setIconError('Escolha uma imagem para a foto da sala.');
      return;
    }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    const small = dataUrl ? await shrinkAvatar(dataUrl, 192) : '';
    if (!small) {
      setIconError('Não foi possível ler essa imagem.');
      return;
    }
    setIconError('');
    setIconUrl(small);
    setIconChanged(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError('Dê um nome para a sala.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await updateRoom(room.id, {
      name: name.trim(),
      subject: subject.trim() || 'Geral',
      isPrivate,
      isHidden: isPrivate ? isHidden : false,
      ...(passwordChanged ? { password: password.trim() } : {}),
      color,
      ...(iconChanged ? { iconUrl } : {}),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || 'Não foi possível salvar as mudanças.');
      return;
    }
    notify('Configurações da sala salvas.');
    closeRoomSettings();
  };

  return (
    <ModalShell
      testId="room-settings-modal"
      title="Configurações da sala"
      subtitle={
        <>
          <span translate="no" className="font-bold text-white">{room.name}</span>
          {' · '}
          {room.myRole === 'owner' ? 'Você é o dono' : room.myRole === 'admin' ? 'Você é adm' : 'Você é membro'}
        </>
      }
      onClose={requestClose}
      width="max-w-4xl"
    >
      <form onSubmit={handleSave} className="space-y-5" role="dialog" aria-modal="true" aria-label="Configurações da sala">
        {!canEdit ? (
          <p role="alert" className="text-sm font-semibold text-rose-600">Só o dono e os adm podem mudar essas configurações.</p>
        ) : (
          <>
            <div>
              <label htmlFor="room-settings-name" className={FIELD_LABEL}>
                Nome da sala
              </label>
              <input
                id="room-settings-name"
                data-testid="room-settings-name"
                type="text"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>

            <div>
              <label htmlFor="room-settings-subject" className={FIELD_LABEL}>
                Matéria ou assunto <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="room-settings-subject"
                data-testid="room-settings-subject"
                type="text"
                maxLength={30}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Cálculo II, ENEM, TCC, só resenha..."
                className={FIELD_INPUT}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>Quem pode entrar</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  data-testid="room-settings-private"
                  aria-pressed={isPrivate}
                  onClick={() => setIsPrivate(true)}
                  className={`text-left p-3.5 rounded-2xl border-2 transition-colors flex flex-col space-y-1 ${
                    isPrivate ? 'bg-[#3044f0]/[0.07] border-[#3044f0]' : 'bg-white border-slate-900/10 hover:border-slate-900/30'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#3044f0]" />
                    <span className="text-sm font-extrabold text-slate-950">Privada</span>
                  </span>
                  <span className="text-xs text-slate-500">Só com convite</span>
                </button>
                <button
                  type="button"
                  data-testid="room-settings-open"
                  aria-pressed={!isPrivate}
                  onClick={() => setIsPrivate(false)}
                  className={`text-left p-3.5 rounded-2xl border-2 transition-colors flex flex-col space-y-1 ${
                    !isPrivate ? 'bg-[#3044f0]/[0.07] border-[#3044f0]' : 'bg-white border-slate-900/10 hover:border-slate-900/30'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-extrabold text-slate-950">Aberta</span>
                  </span>
                  <span className="text-xs text-slate-500">Qualquer pessoa com o link</span>
                </button>
              </div>

              {isPrivate && (
                <div className="mt-3 p-3.5 rounded-2xl bg-white border border-slate-900/10 space-y-3">
                  <div>
                    <span className="block text-xs font-bold text-slate-800 mb-1.5">Visibilidade na aba principal (&ldquo;Minhas salas&rdquo;)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-testid="room-settings-visible"
                        onClick={() => setIsHidden(false)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                          !isHidden ? 'border-[#3044f0] bg-[#3044f0]/[0.07]' : 'border-slate-900/10 hover:border-slate-900/30'
                        }`}
                      >
                        <Eye className="w-4 h-4 text-[#3044f0] flex-shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-extrabold text-slate-950">Visível com cadeado</span>
                          <span className="block text-[11px] text-slate-500">Aparece na aba principal</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        data-testid="room-settings-hidden"
                        onClick={() => setIsHidden(true)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                          isHidden ? 'border-[#3044f0] bg-[#3044f0]/[0.07]' : 'border-slate-900/10 hover:border-slate-900/30'
                        }`}
                      >
                        <EyeOff className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-extrabold text-slate-950">Invisível (oculta)</span>
                          <span className="block text-[11px] text-slate-500">Só aparece para quem já entrou</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label htmlFor="room-settings-password" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#3044f0]" />
                        <span>Senha da sala</span>
                        <span className="font-normal text-slate-400">
                          {room.hasPassword && !passwordChanged ? '(ativa)' : '(opcional)'}
                        </span>
                      </label>
                      {room.hasPassword && (
                        <button
                          type="button"
                          onClick={() => {
                            setPassword('');
                            setPasswordChanged(true);
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          Remover senha
                        </button>
                      )}
                    </div>
                    <input
                      id="room-settings-password"
                      data-testid="room-settings-password"
                      type="password"
                      maxLength={60}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordChanged(true);
                      }}
                      placeholder={
                        room.hasPassword && !passwordChanged
                          ? 'Digite nova senha para trocar (ou mantenha atual)'
                          : 'Deixe vazio para entrar apenas com convite ou link'
                      }
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className={FIELD_LABEL}>Cor da sala</label>
              <div className="flex flex-wrap items-center gap-3" data-testid="room-settings-colors">
                {COLOR_OPTIONS.map((col) => {
                  const isSelected = color === col.value;
                  return (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setColor(col.value)}
                      style={{ backgroundColor: col.value }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isSelected ? 'ring-2 ring-slate-950 ring-offset-2 ring-offset-[#f6f5f0] scale-110' : 'hover:scale-110'
                      }`}
                      title={col.label}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
                <label
                  title="Escolher qualquer cor"
                  className={`relative w-8 h-8 rounded-full cursor-pointer flex items-center justify-center transition-all ${
                    !isPreset ? 'ring-2 ring-slate-950 ring-offset-2 ring-offset-[#f6f5f0] scale-110' : 'hover:scale-110'
                  }`}
                  style={{ background: 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)' }}
                >
                  <span className="w-4 h-4 rounded-full border-2 border-white pointer-events-none" style={{ backgroundColor: isPreset ? '#f6f5f0' : color }} />
                  <input
                    type="color"
                    data-testid="room-settings-color-custom"
                    aria-label="Escolher qualquer cor"
                    value={color}
                    onChange={(e) => setColor(normalizeRoomColor(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">Código da cor</span>
                <ColorField
                  hexOnly
                  size="sm"
                  testId="room-settings-color-hex-field"
                  value={color}
                  onChange={(hex) => setColor(normalizeRoomColor(hex))}
                  className="w-32"
                />
              </div>
            </div>

            <div>
              <label className={FIELD_LABEL}>
                Foto da sala <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span>
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  title="Escolher foto ou GIF"
                  className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-slate-900/25 bg-white hover:border-[#3044f0] flex items-center justify-center text-slate-400 hover:text-[#3044f0] transition-colors flex-shrink-0"
                >
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrl} alt="" style={mediaTransformStyle(iconUrl)} className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </button>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setShowIconPicker(true)} className="text-sm font-bold text-[#3044f0] hover:text-[#2334c9] underline underline-offset-4">
                    Escolher foto ou GIF
                  </button>
                  {iconUrl && (
                    <button
                      type="button"
                      data-testid="room-settings-icon-remove"
                      onClick={() => {
                        setIconUrl('');
                        setIconChanged(true);
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remover foto
                    </button>
                  )}
                </div>
                <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconFile} className="hidden" data-testid="room-settings-icon-input" />
              </div>
              {iconError && <p role="alert" className="text-xs text-rose-600 font-semibold mt-2">{iconError}</p>}
              <ImagePickerModal
                open={showIconPicker}
                shape="room"
                title="Foto ou GIF da sala"
                initialUrl={iconUrl}
                onClose={() => setShowIconPicker(false)}
                onSelect={(url) => {
                  setIconError('');
                  setIconUrl(url);
                  setIconChanged(true);
                }}
              />
            </div>

            {error && (
              <p role="alert" data-testid="room-settings-error" className="text-sm font-semibold text-rose-600">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900/10">
              <button type="button" data-testid="room-settings-cancel" onClick={requestClose} className={BTN_GHOST}>
                Cancelar
              </button>
              <button type="submit" data-testid="room-settings-save" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </>
        )}
      </form>

      {showUnsavedPrompt && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0b0f19]/75 animate-fadeIn"
          onClick={() => setShowUnsavedPrompt(false)}
        >
          <div
            role="alertdialog"
            aria-label="Alterações não salvas"
            onClick={(e) => e.stopPropagation()}
            className="mesa-paper w-full max-w-md rounded-3xl bg-[#f6f5f0] text-slate-900 p-6 shadow-2xl space-y-4 border border-slate-900/10"
          >
            <div>
              <h3 className="landing-display text-xl text-slate-950">Alterações não salvas</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Você modificou as configurações da sala, mas ainda não salvou. Deseja salvar antes de fechar?
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowUnsavedPrompt(false)}
                className="h-10 px-4 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-900/10"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedPrompt(false);
                  closeRoomSettings();
                }}
                className="h-10 px-4 rounded-full bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 text-xs font-bold"
              >
                Sair sem salvar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  setShowUnsavedPrompt(false);
                  void handleSave(e as unknown as React.FormEvent);
                }}
                className="h-10 px-5 rounded-full bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold"
              >
                {saving ? 'Salvando...' : 'Salvar e sair'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
