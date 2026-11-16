'use client';

import React from 'react';
import { useMesa, isActiveUntil, MUSIC_BOT_ID } from '@/context/MesaContext';
import { Mic, MicOff, VideoOff, Clock, Music2, Monitor, MoreHorizontal } from 'lucide-react';
import { Equalizer } from './MusicPanel';
import { RoleBadge } from '@/components/modals/ParticipantModal';
import { StreamVideo } from '@/components/common/StreamVideo';

/**
 * Quadradinhos de quem está na chamada.
 * Clicar numa pessoa dá foco nela (o palco mostra a câmera ou a tela dela em tamanho grande);
 * o perfil e o volume ficam no botão "⋯" do quadradinho (ou no clique direito).
 * Com `strip`, vira uma faixa pequena embaixo do palco de foco.
 */
export function VideoGrid({ strip = false }: { strip?: boolean }) {
  const {
    currentRoom,
    currentUser,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    audioVolumeLevel,
    localCameraStream,
    getPeerStreams,
    callViewMode,
    callFocus,
    setCallFocus,
    openParticipantMenu,
    peerVolumes,
    myRole,
    music,
    soundFlash,
  } = useMesa();

  if (!currentRoom) return null;

  const otherMembers = currentRoom.members.filter((m) => !(callFocus && callFocus.id === m.id));
  const meFocused = !!callFocus && callFocus.id === currentUser.id;
  const isExpandedGrid = callViewMode === 'grid' && !strip;
  const localSpeaking = isMicOn && audioVolumeLevel > 15;

  const tileClass = (speaking: boolean) =>
    `group relative rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all ${
      strip ? 'w-36 sm:w-44 flex-shrink-0 aspect-[4/3]' : isExpandedGrid ? 'aspect-[16/10]' : 'aspect-[4/3]'
    } ${speaking ? 'ring-2 ring-emerald-400' : 'hover:ring-2 hover:ring-white/30'}`;

  const focusOn = (id: string, sharing: boolean) => setCallFocus({ id, kind: sharing ? 'screen' : 'camera' });

  const containerClass = strip
    ? 'w-full max-w-5xl flex gap-2.5 overflow-x-auto no-scrollbar mt-3 px-1 flex-shrink-0'
    : `w-full transition-all duration-300 ${
        isExpandedGrid
          ? 'max-w-5xl grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 p-4 my-auto'
          : 'max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5 px-3'
      }`;

  return (
    <div className={containerClass}>
      {/* Outros participantes da chamada */}
      {otherMembers.map((member) => {
        const punished = isActiveUntil(member.punishedUntil);
        const speaking = !punished && !!member.isSpeaking && !!member.isMicOn;
        const camera = !punished && member.isCameraOn ? getPeerStreams(member).camera : undefined;
        const volume = Math.round((peerVolumes[member.id] ?? 1) * 100);

        return (
          <div
            key={member.id}
            data-testid="remote-tile"
            role="button"
            tabIndex={0}
            title={`Dar foco em ${member.name}`}
            onClick={() => focusOn(member.id, !!member.isSharingScreen)}
            onContextMenu={(e) => {
              e.preventDefault();
              openParticipantMenu(member.id, { x: e.clientX, y: e.clientY });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                focusOn(member.id, !!member.isSharingScreen);
              }
            }}
            className={`${tileClass(speaking)} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}
            style={{ backgroundColor: camera ? '#000000' : '#17203a' }}
          >
            {punished && (
              <span
                data-testid="punished-flag"
                className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-rose-600/90 text-[10px] font-bold text-white flex items-center gap-1"
              >
                <Clock className="w-3 h-3" /> Castigo
              </span>
            )}
            {soundFlash[member.id] && (
              <span data-testid="sound-flash" className="absolute top-2 left-1/2 -translate-x-1/2 z-10 max-w-[90%] truncate px-2 py-0.5 rounded-md bg-violet-600/90 text-[11px] font-bold text-white">
                {soundFlash[member.id].emoji} {soundFlash[member.id].name}
              </span>
            )}
            {volume !== 100 && (
              <span className="absolute top-2 right-11 z-10 px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] font-mono text-white">
                {volume}%
              </span>
            )}

            {/* Perfil e volume (o clique no quadradinho dá foco) */}
            <button
              type="button"
              data-testid="tile-menu"
              title={`Ver perfil e ajustar o volume de ${member.name}`}
              aria-label={`Ver perfil e ajustar o volume de ${member.name}`}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openParticipantMenu(member.id, { x: rect.right, y: rect.bottom });
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {camera ? (
              <StreamVideo stream={camera} className="w-full h-full object-cover" />
            ) : member.avatarUrl ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 ring-white/20 ">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold "
                style={{ backgroundColor: member.avatarColor || '#2563eb' }}
              >
                {member.avatarLetter}
              </div>
            )}

            {member.isSharingScreen && (
              <span
                data-testid="tile-sharing"
                className="absolute right-2 bottom-2 z-10 px-2 py-1 rounded-md bg-[#ffd027] text-slate-950 text-[10px] font-extrabold flex items-center gap-1"
              >
                <Monitor className="w-3 h-3" /> Tela
              </span>
            )}

            <div className={`absolute left-2 bottom-2 ${member.isSharingScreen ? 'max-w-[calc(100%-4.5rem)]' : 'max-w-[calc(100%-1rem)]'} px-2 py-1 rounded-md bg-black/55 flex items-center gap-2 text-white z-10`}>
              <span className="text-xs font-bold truncate flex items-center gap-1 min-w-0">
                <RoleBadge role={member.role} className="flex-shrink-0" />
                <span className="truncate">{member.name}</span>
              </span>
              <div className="flex items-center gap-1.5">
                {member.isMicOn ? (
                  <Mic className={`w-3.5 h-3.5 ${speaking ? 'text-emerald-400' : 'text-slate-300'}`} />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                {!member.isCameraOn && <VideoOff className="w-3 h-3 text-slate-400" />}
              </div>
            </div>
          </div>
        );
      })}

      {/* Bot de música */}
      {music.on && (
        <div
          data-testid="music-bot-tile"
          role="button"
          tabIndex={0}
          title="Volume e opções do bot de música"
          onClick={(e) => openParticipantMenu(MUSIC_BOT_ID, { x: e.clientX, y: e.clientY })}
          onContextMenu={(e) => {
            e.preventDefault();
            openParticipantMenu(MUSIC_BOT_ID, { x: e.clientX, y: e.clientY });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              openParticipantMenu(MUSIC_BOT_ID, { x: rect.right, y: rect.top });
            }
          }}
          className={`${tileClass(music.playing && music.queue.length > 0)} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 bg-violet-700`}
        >
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          {music.queue[0] && (
            <p className="absolute top-2 inset-x-2 text-center text-[10px] font-semibold text-white/90 line-clamp-2 leading-tight">
              {music.queue[0].title}
            </p>
          )}
          <div className="absolute left-2 bottom-2 max-w-[calc(100%-1rem)] px-2 py-1 rounded-md bg-black/55 flex items-center gap-2 text-white z-10">
            <span className="text-xs font-bold truncate ">Mesa DJ (bot)</span>
            <Equalizer playing={music.playing && music.queue.length > 0} className="h-3" />
          </div>
        </div>
      )}

      {/* Você */}
      {!meFocused && (
        <div
          data-testid="local-tile"
          role="button"
          tabIndex={0}
          title={`Dar foco em ${currentUser.name}`}
          onClick={() => focusOn(currentUser.id, isScreenSharing)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              focusOn(currentUser.id, isScreenSharing);
            }
          }}
          className={`${tileClass(localSpeaking)} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}
          style={{ backgroundColor: isCameraOn ? '#000000' : '#17203a' }}
        >
          {soundFlash[currentUser.id] && (
            <span data-testid="sound-flash-self" className="absolute top-2 left-1/2 -translate-x-1/2 z-10 max-w-[90%] truncate px-2 py-0.5 rounded-md bg-violet-600/90 text-[11px] font-bold text-white">
              {soundFlash[currentUser.id].emoji} {soundFlash[currentUser.id].name}
            </span>
          )}
          {isCameraOn && localCameraStream ? (
            <StreamVideo stream={localCameraStream} mirrored className="w-full h-full object-cover" />
          ) : currentUser.avatarUrl ? (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 ring-white/20 ">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold "
              style={{ backgroundColor: currentUser.avatarColor || '#2563eb' }}
            >
              {currentUser.avatarLetter}
            </div>
          )}

          {isScreenSharing && (
            <span className="absolute right-2 bottom-2 z-10 px-2 py-1 rounded-md bg-[#ffd027] text-slate-950 text-[10px] font-extrabold flex items-center gap-1">
              <Monitor className="w-3 h-3" /> Tela
            </span>
          )}

          <div className={`absolute left-2 bottom-2 ${isScreenSharing ? 'max-w-[calc(100%-4.5rem)]' : 'max-w-[calc(100%-1rem)]'} px-2 py-1 rounded-md bg-black/55 flex items-center gap-2 text-white z-10`}>
            <span className="text-xs font-bold truncate flex items-center gap-1 min-w-0">
              <RoleBadge role={myRole} className="flex-shrink-0" />
              <span className="truncate">{currentUser.name} (Você)</span>
            </span>
            <div className="flex items-center gap-1.5">
              {isMicOn ? (
                <Mic className={`w-3.5 h-3.5 ${localSpeaking ? 'text-emerald-400' : 'text-slate-300'}`} />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-rose-400" />
              )}
              {!isCameraOn && <VideoOff className="w-3 h-3 text-slate-400" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
