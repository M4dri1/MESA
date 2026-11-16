'use client';

import React, { useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { shrinkAvatar } from '@/lib/api';
import {
  Lock,
  Globe,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  UserPlus,
  Volume2,
  VolumeX,
  Plus,
  Sparkles,
  Settings,
  PhoneOff,
  Volume1,
  Hash,
  ChevronDown,
  UserCheck,
  Camera,
  Music2,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Sparkle } from '@/components/common/Sparkle';
import { RoleBadge } from '@/components/modals/ParticipantModal';
import { isActiveUntil, untilLabel, MUSIC_BOT_ID } from '@/context/MesaContext';

export function SidebarLeft() {
  const {
    currentRoom,
    setCurrentRoomId,
    rooms,
    currentUser,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    isDeafened,
    audioVolumeLevel,
    toggleMic,
    toggleDeafen,
    setIsCreateModalOpen,
    setIsInviteModalOpen,
    openSettings,
    activeCallUsers,
    myRole,
    moderate,
    openParticipantMenu,
    callFocus,
    setCallFocus,
    music,
    setRoomIcon,
    notify,
    openRoomSettings,
  } = useMesa();

  const iconInputRef = useRef<HTMLInputElement>(null);
  const [iconBusy, setIconBusy] = useState(false);

  const handleIconFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (iconInputRef.current) iconInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Escolha uma imagem para a foto da sala.');
    setIconBusy(true);
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    const small = await shrinkAvatar(dataUrl, 192);
    if (!small) notify('Não foi possível ler essa imagem.');
    else await setRoomIcon(small);
    setIconBusy(false);
  };

  // Atalhos das salas na barra da esquerda (as primeiras da lista)
  const dockRooms = rooms.slice(0, 8).map((room) => ({
    id: room.id,
    iconUrl: room.iconUrl,
    name: room.name,
    color: room.color && room.color.startsWith('#') ? room.color : '#2563eb',
    label: room.name
      .split(/[\s·-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase(),
  }));

  return (
    <div className="flex h-full flex-shrink-0 select-none">
      {/* Barra de salas (estilo Discord) direto sobre o cobalto da marca */}
      <div className="w-14 md:w-[72px] flex flex-col items-center py-2 gap-3 z-20">
        {/* Início */}
        <button
          onClick={() => setCurrentRoomId(null)}
          title="Minhas salas (Início)"
          className={`relative group w-10 h-10 md:w-12 md:h-12 flex items-center justify-center font-black text-base md:text-lg transition-all duration-200 ${
            currentRoom === null
              ? 'rounded-2xl bg-[#ffd027] text-slate-950'
              : 'rounded-full bg-white/15 text-white hover:rounded-2xl hover:bg-[#ffd027] hover:text-slate-950'
          }`}
        >
          {currentRoom === null && <span className="absolute -left-[10px] md:-left-[14px] w-1.5 h-6 md:h-8 bg-white rounded-r-full" />}
          M
        </button>

        <div className="w-8 h-[2px] bg-white/25 rounded-full" />

        {/* Atalhos das salas */}
        <div className="flex-1 flex flex-col items-center gap-3 overflow-y-auto no-scrollbar py-1 w-full">
          {dockRooms.map((dock) => {
            const isActive = currentRoom?.id === dock.id;
            return (
              <button
                key={dock.id}
                onClick={() => setCurrentRoomId(dock.id)}
                title={dock.name}
                className={`relative group flex-shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center font-extrabold text-[11px] md:text-xs text-white transition-all duration-200 ring-2 ${
                  isActive ? 'rounded-2xl ring-white' : 'rounded-full ring-white/25 hover:rounded-2xl hover:ring-white/70'
                }`}
                style={{ backgroundColor: dock.color }}
              >
                {isActive && <span className="absolute -left-[14px] w-1.5 h-8 bg-white rounded-r-full" />}
                {dock.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dock.iconUrl} alt={dock.name} className="absolute inset-0 w-full h-full object-cover rounded-[inherit]" />
                ) : (
                  dock.label
                )}
              </button>
            );
          })}

          {/* Criar sala */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            title="Criar nova sala"
            className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-dashed border-white/50 hover:border-white text-white hover:bg-white hover:text-[#3044f0] flex items-center justify-center transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Dentro de uma sala: painel da sala, um cartão escuro flutuando no cobalto */}
      {currentRoom && (
        <div className="w-[272px] mr-3 rounded-3xl overflow-hidden bg-[#0f1524] flex flex-col justify-between hidden md:flex">
          {/* Cabeçalho na cor da sala */}
          <div
            className="relative p-4 pb-5 overflow-hidden"
            style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(currentRoom.color || '') ? currentRoom.color : '#2563eb' }}
          >
            <Sparkle className="right-4 bottom-4 h-4 w-4 text-white/55" />
            <Sparkle className="right-12 top-3 h-2.5 w-2.5 text-white/40" />

            <div className="flex items-start justify-between gap-2">
              {/* Foto da sala: dono e adm podem trocar */}
              <div className="relative flex-shrink-0">
                <div
                  data-testid="room-icon"
                  className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center text-white font-black text-sm bg-black/25"
                >
                  {currentRoom.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentRoom.iconUrl} alt="Foto da sala" className="w-full h-full object-cover" />
                  ) : (
                    currentRoom.name.split(/[\s·-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
                  )}
                  {iconBusy && <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-[10px]">...</span>}
                </div>
                {myRole !== 'member' && (
                  <>
                    <button
                      type="button"
                      data-testid="room-icon-button"
                      title="Mudar a foto da sala"
                      disabled={iconBusy}
                      onClick={() => iconInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#ffd027] text-slate-950 hover:scale-110 transition-transform disabled:opacity-60"
                    >
                      <Camera className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconFile} className="hidden" data-testid="room-icon-input" />
                  </>
                )}
              </div>

              {myRole !== 'member' && (
                <button
                  type="button"
                  data-testid="room-settings-button"
                  title="Configurações da sala"
                  aria-label="Configurações da sala"
                  onClick={() => openRoomSettings(currentRoom.id)}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/35 text-white transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>

            <h2 translate="no" className="landing-display text-[19px] text-white mt-3 line-clamp-3 [overflow-wrap:anywhere]">
              {currentRoom.name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="px-2.5 py-1 rounded-full bg-black/25 text-white text-[11px] font-bold">{currentRoom.subject}</span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/25 text-white text-[11px] font-bold">
                {currentRoom.isPrivate ? (
                  <>
                    <Lock className="w-3 h-3" /> Privada
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3" /> Aberta
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Quem está na sala */}
          <div className="flex-1 p-3 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between px-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <span>Na sala agora</span>
              <span className="bg-white/10 px-2 py-0.5 rounded-full text-white">{currentRoom.members.length + 1}</span>
            </div>

            <div className="space-y-0.5 -mt-2">
              {/* Outros membros */}
              {currentRoom.members.map((member) => (
                <button
                  type="button"
                  key={member.id}
                  data-testid="participant-row"
                  data-presence={member.presence || 'online'}
                  title={`Ver perfil e ajustar o volume de ${member.name}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    openParticipantMenu(member.id, { x: rect.right + 8, y: rect.top });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    openParticipantMenu(member.id, { x: rect.right + 8, y: rect.top });
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      letter={member.avatarLetter}
                      avatarUrl={member.avatarUrl}
                      color={member.avatarColor}
                      size="sm"
                      isSpeaking={!!member.isSpeaking && !!member.isMicOn}
                    />
                    <span className="text-sm font-semibold text-white truncate">{member.name}</span>
                    <RoleBadge role={member.role} />
                    {member.presence && member.presence !== 'online' && (
                      <span
                        title={member.presence === 'ocupado' ? 'Não perturbe' : 'Ausente'}
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${member.presence === 'ocupado' ? 'bg-rose-500' : 'bg-amber-400'}`}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {member.isSharingScreen && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#ffd027] text-slate-950 text-[10px] font-extrabold">Tela</span>
                    )}
                    {isActiveUntil(member.punishedUntil) && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 text-[10px] font-bold">Castigo</span>
                    )}
                    {member.isMicOn ? <Mic className="w-3.5 h-3.5 text-slate-300" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                </button>
              ))}

              {/* Bot de música */}
              {music.on && (
                <div
                  data-testid="music-bot-row"
                  role="button"
                  tabIndex={0}
                  title="Volume e opções do bot de música"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    openParticipantMenu(MUSIC_BOT_ID, { x: rect.right + 8, y: rect.top });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    openParticipantMenu(MUSIC_BOT_ID, { x: rect.right + 8, y: rect.top });
                  }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                      <Music2 className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">Mesa DJ</span>
                      <span className="block text-[10px] text-violet-300 truncate">
                        {music.queue[0] ? music.queue[0].title : 'esperando música'}
                      </span>
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full bg-violet-500/25 text-violet-200 text-[10px] font-bold">Bot</span>
                </div>
              )}

              {/* Você */}
              <button
                type="button"
                title={`Dar foco em ${currentUser.name}`}
                onClick={() =>
                  setCallFocus(
                    callFocus?.id === currentUser.id
                      ? null
                      : { id: currentUser.id, kind: isScreenSharing ? 'screen' : 'camera' }
                  )
                }
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl bg-[#3044f0]/30 hover:bg-[#3044f0]/45 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar
                      letter={currentUser.avatarLetter}
                      avatarUrl={currentUser.avatarUrl}
                      color={currentUser.avatarColor}
                      size="sm"
                      isSpeaking={isMicOn && audioVolumeLevel > 15}
                    />
                  </div>
                  <span className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    Você <RoleBadge role={myRole} />
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isScreenSharing && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#ffd027] text-slate-950 text-[10px] font-extrabold">Tela</span>
                  )}
                  {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                </div>
              </button>
            </div>

            {/* Convite */}
            <div className="space-y-2.5">
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Convidar amigos
              </button>

              {/* Só adm e dono enxergam quem foi expulso */}
              {(currentRoom.bans || []).length > 0 && (
                <div className="pt-2" data-testid="ban-list">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-2 px-1">
                    Expulsos ({(currentRoom.bans || []).length})
                  </span>
                  <div className="space-y-1.5">
                    {(currentRoom.bans || []).map((ban) => (
                      <div key={ban.user.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-rose-500/10">
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-white block truncate">{ban.user.name}</span>
                          <span className="text-[10px] text-slate-400 block">{untilLabel(ban.until)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => moderate('unban', ban.user.id)}
                          className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white flex-shrink-0"
                        >
                          Liberar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Minhas salas */}
            <div>
              <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                <span>Minhas salas</span>
                <span className="text-[10px] text-slate-500 font-medium normal-case tracking-normal">Clique p/ trocar</span>
              </div>
              <div className="space-y-0.5">
                {rooms.map((r) => {
                  const isCurrent = r.id === currentRoom.id;
                  const roomUsers = activeCallUsers[r.id] || r.members || [];
                  return (
                    <button
                      key={r.id}
                      onClick={() => setCurrentRoomId(r.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-colors group ${
                        isCurrent ? 'bg-white/10 text-white font-bold' : 'hover:bg-white/5 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Volume1 className={`w-4 h-4 flex-shrink-0 ${isCurrent ? 'text-emerald-400' : 'text-slate-500 group-hover:text-[#ffd027]'}`} />
                        <span className="text-xs truncate">{r.name}</span>
                      </div>
                      {roomUsers.length > 0 && (
                        <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">{roomUsers.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Voz conectada */}
          <div className="mx-3 mb-2 px-3 py-2.5 rounded-2xl bg-emerald-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-emerald-400">Voz Conectada</div>
                <div translate="no" className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                  {currentRoom.name}
                </div>
              </div>
            </div>
            <button
              onClick={() => setCurrentRoomId(null)}
              title="Desconectar da call"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors flex-shrink-0"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Meu perfil e controles rápidos */}
          <div className="px-3 py-3 bg-black/25 flex items-center justify-between">
            <div
              onClick={() => openSettings('account')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity flex-1 min-w-0"
              title="Minha conta"
            >
              <Avatar letter={currentUser.avatarLetter} avatarUrl={currentUser.avatarUrl} color={currentUser.avatarColor} size="sm" />
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white truncate">{currentUser.name}</span>
                <span className="text-[10px] text-emerald-400">Conectado</span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 text-slate-400 flex-shrink-0">
              <button
                onClick={toggleMic}
                title={isMicOn ? 'Mutar microfone' : 'Ativar microfone'}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${!isMicOn ? 'text-rose-400 hover:text-rose-300' : 'hover:text-white'}`}
              >
                {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleDeafen}
                title={isDeafened ? 'Ativar som' : 'Desativar áudio'}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isDeafened ? 'text-rose-400 hover:text-rose-300' : 'hover:text-white'}`}
              >
                {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => openSettings('account')}
                title="Configurações"
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
