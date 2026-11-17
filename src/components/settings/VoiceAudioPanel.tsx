'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Mic, Volume2, RefreshCw, AudioLines, Play, Square } from 'lucide-react';

interface DeviceOption {
  deviceId: string;
  label: string;
}

/**
 * Seção "Voz e Áudio" das Configurações:
 * escolha do microfone (entrada), saída de áudio (fone/caixa), redução de ruído e teste ao vivo.
 */
export function VoiceAudioPanel() {
  const {
    audioInputId,
    setAudioInputId,
    audioOutputId,
    setAudioOutputId,
    noiseSuppression,
    toggleNoiseSuppression,
    isMicOn,
    toggleMic,
  } = useMesa();

  const [inputs, setInputs] = useState<DeviceOption[]>([]);
  const [outputs, setOutputs] = useState<DeviceOption[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [testing, setTesting] = useState(false);
  const [listenSelf, setListenSelf] = useState(true);
  const [level, setLevel] = useState(0);

  const testCleanupRef = useRef<(() => void) | null>(null);
  const loopbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const mutedForTestRef = useRef(false);

  const canSelectOutput =
    typeof window !== 'undefined' &&
    typeof HTMLMediaElement !== 'undefined' &&
    typeof (HTMLMediaElement.prototype as any).setSinkId === 'function';

  const loadDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const ins = list
        .filter((d) => d.kind === 'audioinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microfone ${idx + 1}`,
        }));
      const outs = list
        .filter((d) => d.kind === 'audiooutput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Saída de áudio ${idx + 1}`,
        }));
      setInputs(ins);
      setOutputs(outs);
      setNeedsPermission(list.some((d) => (d.kind === 'audioinput' || d.kind === 'audiooutput') && !d.label));
    } catch {
      setDeviceError('Não foi possível listar os dispositivos de áudio.');
    }
  };

  useEffect(() => {
    void loadDevices();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void loadDevices();
    md.addEventListener('devicechange', onChange);
    return () => {
      md.removeEventListener('devicechange', onChange);
      testCleanupRef.current?.();
    };
  }, []);

  // Atualiza saída do retorno durante o teste ao vivo
  useEffect(() => {
    const el = loopbackAudioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el) return;
    el.muted = !listenSelf;
    if (typeof el.setSinkId === 'function') {
      el.setSinkId(audioOutputId || '').catch(() => {});
    }
  }, [listenSelf, audioOutputId, testing]);

  const askMicPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    setDeviceError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      await loadDevices();
    } catch {
      setDeviceError('Permissão do microfone negada. Libere o microfone no cadeado da barra de endereço do navegador.');
    }
  };

  const stopTest = () => {
    testCleanupRef.current?.();
    testCleanupRef.current = null;
    setTesting(false);
    setLevel(0);
  };

  const startTest = async () => {
    if (testing) {
      stopTest();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceError('Seu navegador não liberou acesso ao microfone.');
      return;
    }
    setDeviceError('');
    try {
      const base: MediaTrackConstraints = { echoCancellation: true, noiseSuppression, autoGainControl: true };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioInputId ? { ...base, deviceId: { exact: audioInputId } } : base,
      });
      await loadDevices();

      const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
      let raf = 0;
      let ctx: AudioContext | null = null;
      if (Ctx) {
        ctx = new Ctx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          setLevel(Math.min(100, Math.round((avg / 90) * 100)));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioEl.srcObject = stream;
      audioEl.muted = !listenSelf;
      if (typeof (audioEl as any).setSinkId === 'function') {
        (audioEl as any).setSinkId(audioOutputId || '').catch(() => {});
      }
      audioEl.play().catch(() => {});
      loopbackAudioRef.current = audioEl;

      if (isMicOn) {
        mutedForTestRef.current = true;
        void toggleMic();
      }

      testCleanupRef.current = () => {
        cancelAnimationFrame(raf);
        audioEl.pause();
        audioEl.srcObject = null;
        loopbackAudioRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        ctx?.close().catch(() => {});
        if (mutedForTestRef.current) {
          mutedForTestRef.current = false;
          void toggleMic();
        }
      };
      setTesting(true);
    } catch {
      setDeviceError('Não foi possível abrir esse microfone. Verifique a permissão no navegador ou escolha outro dispositivo.');
    }
  };

  return (
    <div data-testid="voice-audio-panel" className="space-y-5">
      <div>
        <h2 className="landing-display text-2xl text-slate-950 flex items-center gap-2">
          <Mic className="w-5 h-5 text-[#3044f0]" /> Voz e Áudio
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Escolha qual microfone e qual fone/caixa de som usar nas chamadas.
        </p>
      </div>

      {needsPermission && (
        <div className="p-3 rounded-2xl bg-[#3044f0]/[0.07] border border-[#3044f0]/20 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-700">
            Para mostrar o nome exato dos seus microfones, libere a permissão no navegador.
          </p>
          <button
            type="button"
            onClick={() => void askMicPermission()}
            className="px-3 py-1.5 rounded-xl bg-[#3044f0] hover:bg-[#2334c9] text-white text-xs font-bold flex-shrink-0"
          >
            Liberar
          </button>
        </div>
      )}

      {deviceError && (
        <p className="text-xs font-semibold text-rose-600 bg-rose-500/10 px-3 py-2 rounded-xl">{deviceError}</p>
      )}

      {/* Entrada: Microfone */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="voice-input-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-[#3044f0]" /> Dispositivo de entrada (Microfone)
          </label>
          <button
            type="button"
            onClick={() => void loadDevices()}
            title="Atualizar lista de dispositivos"
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Atualizar
          </button>
        </div>
        <select
          id="voice-input-select"
          value={audioInputId}
          onChange={async (e) => {
            const id = e.target.value;
            if (testing) stopTest();
            await setAudioInputId(id);
          }}
          className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-900/15 text-sm text-slate-900 focus:outline-none focus:border-[#3044f0]"
        >
          <option value="">Padrão do sistema</option>
          {inputs.map((dev) => (
            <option key={dev.deviceId} value={dev.deviceId}>
              {dev.label}
            </option>
          ))}
        </select>
      </div>

      {/* Saída: Alto-falante / Fone */}
      <div className="space-y-1.5">
        <label htmlFor="voice-output-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-[#3044f0]" /> Dispositivo de saída (Fone / Caixa de som)
        </label>
        {canSelectOutput ? (
          <select
            id="voice-output-select"
            value={audioOutputId}
            onChange={(e) => setAudioOutputId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-900/15 text-sm text-slate-900 focus:outline-none focus:border-[#3044f0]"
          >
            <option value="">Padrão do sistema</option>
            {outputs.map((dev) => (
              <option key={dev.deviceId} value={dev.deviceId}>
                {dev.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-slate-500 bg-white px-3 py-2.5 rounded-xl border border-slate-900/10">
            Este navegador usa automaticamente a saída de áudio padrão do aparelho.
          </p>
        )}
      </div>

      {/* Teste de microfone */}
      <div className="p-4 rounded-2xl bg-white border border-slate-900/10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-950">Testar microfone</p>
            <p className="text-[11px] text-slate-500">Fale algo para ver se o som está chegando.</p>
          </div>
          <button
            type="button"
            onClick={() => void startTest()}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              testing ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-[#3044f0] hover:bg-[#2334c9] text-white'
            }`}
          >
            {testing ? (
              <>
                <Square className="w-3.5 h-3.5" /> Parar teste
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Vamos testar
              </>
            )}
          </button>
        </div>

        {/* Barra de nível */}
        <div className="h-2.5 w-full rounded-full bg-slate-900/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-75"
            style={{ width: `${level}%` }}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={listenSelf}
            onChange={(e) => setListenSelf(e.target.checked)}
            className="rounded border-slate-300 text-[#3044f0] focus:ring-[#3044f0]"
          />
          Ouvir minha própria voz no retorno durante o teste
        </label>
      </div>

      {/* Supressão de ruído */}
      <button
        type="button"
        onClick={() => void toggleNoiseSuppression()}
        className="w-full p-3.5 rounded-2xl bg-white border border-slate-900/10 hover:border-slate-900/25 flex items-center justify-between gap-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AudioLines className="w-4 h-4 text-[#3044f0] flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-950">Redução de ruído (RNNoise)</p>
            <p className="text-[11px] text-slate-500">Filtra teclado, ventilador e barulho de fundo.</p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${
            noiseSuppression ? 'bg-emerald-500/15 text-emerald-700' : 'bg-slate-900/10 text-slate-600'
          }`}
        >
          {noiseSuppression ? 'Ligada' : 'Desligada'}
        </span>
      </button>
    </div>
  );
}
