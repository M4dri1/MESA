'use client';

import React, { useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Room, SubjectType } from '@/types';
import { Lock, Globe, Check, Camera, Trash2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { ModalShell, FIELD_LABEL, FIELD_INPUT, BTN_PRIMARY, BTN_GHOST } from '@/components/common/ModalShell';
import { Avatar } from '@/components/common/Avatar';
import { shrinkAvatar } from '@/lib/api';
import { normalizeRoomColor } from '@/utils/roomColor';
import { RoomCard } from '@/components/rooms/RoomCard';

const SUBJECT_OPTIONS: SubjectType[] = [
  'Matemática',
  'Biologia',
  'Português',
  'História',
  'Programação',
  'Outra',
];

export const COLOR_OPTIONS = [
  { label: 'Azul', value: '#2563eb', gradient: 'from-blue-600 via-blue-700 to-indigo-900' },
  { label: 'Verde', value: '#059669', gradient: 'from-emerald-600 via-teal-700 to-emerald-950' },
  { label: 'Rosa', value: '#db2777', gradient: 'from-pink-600 via-rose-700 to-rose-950' },
  { label: 'Laranja', value: '#d97706', gradient: 'from-amber-600 via-yellow-700 to-amber-950' },
  { label: 'Ciano', value: '#0891b2', gradient: 'from-cyan-600 via-teal-700 to-slate-900' },
  { label: 'Roxo', value: '#7c3aed', gradient: 'from-purple-600 via-indigo-700 to-purple-950' },
];

export function CreateRoomModal() {
  const { isCreateModalOpen, setIsCreateModalOpen, createRoom, setCurrentRoomId, currentUser } = useMesa();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [iconUrl, setIconUrl] = useState('');
  const [iconError, setIconError] = useState('');
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  if (!isCreateModalOpen) return null;

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
  };

  const isPreset = COLOR_OPTIONS.some((col) => col.value === color);
  const previewRoom = {
    id: 'preview',
    name: name.trim() || 'Cálculo II · prova de sexta',
    subject: subject.trim() || 'Geral',
    code: 'MESA-XXXX',
    color,
    gradient: '',
    isPrivate,
    activeCount: 1,
    members: [currentUser],
    iconUrl: iconUrl || undefined,
    myRole: 'member',
    isOwner: false,
  } as unknown as Room;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return; // evita criar duas salas com um clique duplo enquanto espera a conexão
    setCreating(true);
    setCreateError('');
    const created = await createRoom({
      name: name.trim() || (subject.trim() ? `${subject.trim()} · Grupo de Estudos` : 'Sala de estudo'),
      subject: subject.trim() || 'Geral',
      color,
      isPrivate,
      isHidden: isPrivate ? isHidden : false,
      password: isPrivate && password.trim() ? password.trim() : undefined,
      iconUrl: iconUrl || undefined,
    });
    setCreating(false);
    if (!created) {
      setCreateError('Não foi possível criar a sala agora. Confira sua conexão e tente de novo.');
      return;
    }
    setIsCreateModalOpen(false);
    setName('');
    setSubject('');
    setIconUrl('');
    setIconError('');
    setPassword('');
    setIsHidden(true);
    setColor(COLOR_OPTIONS[0].value);
    // Entra direto na sala recém-criada
    setCurrentRoomId(created.id);
  };

  return (
    <ModalShell
      title="Criar sala de estudo"
      subtitle="Configure sua sala para estudar junto com a sua turma."
      onClose={() => setIsCreateModalOpen(false)}
      width="max-w-5xl"
      aside={
        <div>
          <span className="block mb-2 text-[11px] font-bold uppercase tracking-wide text-white/80">Pré-visualização</span>
          {/* O cartão como vai aparecer em "Minhas salas" */}
          <div data-testid="room-create-preview" className="pointer-events-none select-none">
            <RoomCard room={previewRoom} onEnter={() => {}} />
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 md:pr-2">
        {/* Nome da sala */}
        <div>
          <label className={FIELD_LABEL}>Nome da sala</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Cálculo II · prova de sexta"
            className={FIELD_INPUT}
          />
        </div>

        {/* Matéria ou assunto: a pessoa escreve o que quiser */}
        <div>
          <label htmlFor="room-subject" className={FIELD_LABEL}>
            Matéria ou assunto <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span>
          </label>
          <input
            id="room-subject"
            type="text"
            maxLength={30}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex: Cálculo II, ENEM, TCC, só resenha..."
            className={FIELD_INPUT}
          />
        </div>

        {/* Cor da sala: as prontas ou qualquer cor */}
        <div>
          <label className={FIELD_LABEL}>Cor da sala</label>
          <div className="flex flex-wrap items-center gap-3" data-testid="room-colors">
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
                data-testid="room-color-custom"
                aria-label="Escolher qualquer cor"
                value={color}
                onChange={(e) => setColor(normalizeRoomColor(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
          </div>
          {!isPreset && <p className="text-xs text-slate-500 mt-2">Cores muito claras ficam mais escuras para o texto continuar legível.</p>}
        </div>

        {/* Foto da sala */}
        <div>
          <label className={FIELD_LABEL}>
            Foto da sala <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span>
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              data-testid="room-create-icon-button"
              onClick={() => iconInputRef.current?.click()}
              title="Escolher foto"
              className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-slate-900/25 bg-white hover:border-[#3044f0] flex items-center justify-center text-slate-400 hover:text-[#3044f0] transition-colors flex-shrink-0"
            >
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl} alt="" className="w-full h-full object-cover" data-testid="room-create-icon-preview" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => iconInputRef.current?.click()} className="text-sm font-bold text-[#3044f0] hover:text-[#2334c9] underline underline-offset-4">
                  Escolher foto
                </button>
                {iconUrl && (
                  <button
                    type="button"
                    data-testid="room-create-icon-remove"
                    onClick={() => setIconUrl('')}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Remover foto
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Aparece no cartão da sala e na barra da esquerda.</p>
            </div>
            <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconFile} className="hidden" data-testid="room-create-icon-input" />
          </div>
          {iconError && <p role="alert" className="text-xs text-rose-600 font-semibold mt-2">{iconError}</p>}
        </div>

        {/* Quem pode entrar */}
        <div>
          <label className={FIELD_LABEL}>Quem pode entrar</label>
          <div className="grid grid-cols-2 gap-3">
            {/* Privada */}
            <div
              onClick={() => setIsPrivate(true)}
              className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-colors flex flex-col space-y-1 ${
                isPrivate ? 'bg-[#3044f0]/[0.07] border-[#3044f0]' : 'bg-white border-slate-900/10 hover:border-slate-900/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#3044f0]" />
                <span className="text-sm font-extrabold text-slate-950">Privada</span>
              </div>
              <span className="text-xs text-slate-500">Só com convite</span>
            </div>

            {/* Aberta */}
            <div
              onClick={() => setIsPrivate(false)}
              className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-colors flex flex-col space-y-1 ${
                !isPrivate ? 'bg-[#3044f0]/[0.07] border-[#3044f0]' : 'bg-white border-slate-900/10 hover:border-slate-900/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-950">Aberta</span>
              </div>
              <span className="text-xs text-slate-500">Qualquer pessoa com o link</span>
            </div>
          </div>

          {isPrivate && (
            <div className="mt-3 p-3.5 rounded-2xl bg-white border border-slate-900/10 space-y-3">
              <div>
                <span className="block text-xs font-bold text-slate-800 mb-1.5">Visibilidade na aba principal (&ldquo;Minhas salas&rdquo;)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="room-create-visible"
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
                    data-testid="room-create-hidden"
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
                <label htmlFor="room-create-password" className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <KeyRound className="w-3.5 h-3.5 text-[#3044f0]" />
                  <span>Senha da sala</span>
                  <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  id="room-create-password"
                  data-testid="room-create-password"
                  type="password"
                  maxLength={60}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Deixe vazio para entrar apenas com convite ou link"
                  className={FIELD_INPUT}
                />
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">Depois de criar, você recebe um link para convidar os amigos.</p>

        {createError && (
          <p role="alert" data-testid="create-room-error" className="text-sm font-semibold text-rose-600">
            {createError}
          </p>
        )}

        {/* Botões */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900/10">
          <button type="button" onClick={() => setIsCreateModalOpen(false)} className={BTN_GHOST}>
            Cancelar
          </button>
          <button type="submit" disabled={creating} className={BTN_PRIMARY}>
            {creating ? 'Criando...' : 'Criar sala'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
