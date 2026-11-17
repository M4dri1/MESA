'use client';

import React from 'react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import { StreamAudio, StreamVideo } from '@/components/common/StreamVideo';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

/**
 * Janela flutuante de ligação privada 1-a-1 entre amigos (voz e vídeo).
 */
export function DmCallOverlay() {
  const {
    dmCall,
    acceptDmCall,
    declineDmCall,
    endDmCall,
    toggleDmCallMic,
    toggleDmCallCam,
  } = useMesa();

  if (!dmCall) return null;

  const hasRemoteVideo = !!dmCall.remoteStream?.getVideoTracks().some((t) => t.enabled);

  return (
    <div
      data-testid="dm-call-overlay"
      className="fixed bottom-4 right-4 z-[60] w-72 rounded-3xl bg-[#171e33] text-white border border-white/15 shadow-2xl overflow-hidden animate-fadeIn"
    >
      {dmCall.remoteStream && <StreamAudio stream={dmCall.remoteStream} muted={false} />}

      {dmCall.status === 'active' && hasRemoteVideo && (
        <div className="relative aspect-video bg-black">
          <StreamVideo stream={dmCall.remoteStream} className="w-full h-full object-cover" />
          {dmCall.camOn && dmCall.localStream && (
            <div className="absolute bottom-2 right-2 w-20 aspect-video rounded-lg overflow-hidden border border-white/30 bg-black">
              <StreamVideo stream={dmCall.localStream} mirrored className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}

      <div className="p-4 flex flex-col items-center text-center gap-3">
        {(!hasRemoteVideo || dmCall.status !== 'active') && (
          <Avatar letter={dmCall.peer.avatarLetter} avatarUrl={dmCall.peer.avatarUrl} color={dmCall.peer.avatarColor} size="md" />
        )}
        <div>
          <p className="text-sm font-extrabold truncate max-w-[220px]">{dmCall.peer.name}</p>
          <p className="text-xs text-white/70">
            {dmCall.status === 'calling'
              ? 'Chamando...'
              : dmCall.status === 'ringing'
              ? dmCall.video
                ? 'Chamada de vídeo privada...'
                : 'Ligação de voz privada...'
              : 'Em ligação privada'}
          </p>
        </div>

        {dmCall.status === 'ringing' ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void acceptDmCall()}
              title="Atender"
              className="w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-colors"
            >
              <Phone className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={declineDmCall}
              title="Recusar"
              className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {dmCall.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={toggleDmCallMic}
                  title={dmCall.micOn ? 'Silenciar' : 'Ativar microfone'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${dmCall.micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-rose-500 text-white'}`}
                >
                  {dmCall.micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleDmCallCam()}
                  title={dmCall.camOn ? 'Desligar câmera' : 'Ligar câmera'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${dmCall.camOn ? 'bg-[#3044f0]' : 'bg-white/15 hover:bg-white/25'}`}
                >
                  {dmCall.camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={endDmCall}
              title="Desligar"
              className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
