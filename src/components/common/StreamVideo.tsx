'use client';

import React, { useEffect, useRef } from 'react';
import { useMesa } from '@/context/MesaContext';

interface StreamVideoProps {
  stream: MediaStream | null | undefined;
  className?: string;
  mirrored?: boolean;
}

/** Mostra um fluxo de vídeo (câmera ou tela). O áudio da chamada toca em outro lugar, então fica mudo. */
export function StreamVideo({ stream, className = '', mirrored = false }: StreamVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    if (el.srcObject !== (stream || null)) el.srcObject = stream || null;
    if (stream) el.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={`${className} ${mirrored ? 'transform -scale-x-100' : ''}`}
    />
  );
}

/**
 * Toca o áudio de um participante remoto.
 * `volume` vai de 0 a 2 (200%). Fora de 100% o som passa por um ganho da Web Audio:
 * o elemento <audio> não amplifica, e no iPhone ele nem deixa mudar o volume.
 */
export function StreamAudio({ stream, muted, volume = 1 }: { stream: MediaStream; muted: boolean; volume?: number }) {
  const { audioOutputId } = useMesa();
  const ref = useRef<HTMLAudioElement>(null);
  const boostRef = useRef<{ ctx: AudioContext; gain: GainNode; stream: MediaStream } | null>(null);

  useEffect(() => {
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el) return;
    if (typeof el.setSinkId === 'function') {
      el.setSinkId(audioOutputId || '').catch(() => {});
    }
    const ctx = boostRef.current?.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | undefined;
    if (ctx && typeof ctx.setSinkId === 'function') {
      ctx.setSinkId(audioOutputId || '').catch(() => {});
    }
  }, [audioOutputId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});

    const closeBoost = () => {
      boostRef.current?.ctx.close().catch(() => {});
      boostRef.current = null;
    };

    if (!muted && Math.abs(volume - 1) > 0.001) {
      if (boostRef.current && boostRef.current.stream !== stream) closeBoost();
      if (!boostRef.current) {
        const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const gain = ctx.createGain();
          ctx.createMediaStreamSource(stream).connect(gain);
          gain.connect(ctx.destination);
          boostRef.current = { ctx, gain, stream };
        }
      }
      if (boostRef.current) {
        boostRef.current.gain.gain.value = volume;
        boostRef.current.ctx.resume().catch(() => {});
        // O elemento fica mudo, mas ligado ao fluxo: é isso que mantém o áudio chegando ao ganho
        el.muted = true;
        return;
      }
    }

    closeBoost();
    el.muted = muted;
  }, [stream, muted, volume]);

  useEffect(
    () => () => {
      boostRef.current?.ctx.close().catch(() => {});
      boostRef.current = null;
    },
    []
  );

  return <audio ref={ref} autoPlay />;
}
