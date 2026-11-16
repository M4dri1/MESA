'use client';

/**
 * Sons do Mesa, sintetizados na hora com a Web Audio API (nenhum arquivo de áudio).
 *
 * Cada ação tem um desenho próprio para dar para reconhecer de ouvido:
 *  - entrar/sair: arpejo subindo / descendo (quem entra e quem sai soam diferentes de você)
 *  - microfone: "bloop" curto, para baixo ao mutar e para cima ao desmutar
 *  - mensagens: estalo leve ao enviar, duas notas de marimba ao receber
 *  - câmera e tela: clique + nota, varredura de ar
 *  - moderação: sons graves e secos, bem distintos dos sons do dia a dia
 */

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let soundEnabled = true;

function getContext(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined' || !soundEnabled) return null;
  try {
    if (!audioCtx) {
      const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();

      // Saída: compressor suave + um eco curto e baixinho, que dá "sala" aos sons
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;
      compressor.connect(audioCtx.destination);

      master = audioCtx.createGain();
      master.gain.value = 0.9;
      master.connect(compressor);

      const delay = audioCtx.createDelay(0.5);
      delay.delayTime.value = 0.11;
      const feedback = audioCtx.createGain();
      feedback.gain.value = 0.22;
      const wet = audioCtx.createGain();
      wet.gain.value = 0.16;
      const damp = audioCtx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2400;
      master.connect(delay);
      delay.connect(damp);
      damp.connect(feedback);
      feedback.connect(delay);
      damp.connect(wet);
      wet.connect(compressor);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return master ? { ctx: audioCtx, out: master } : null;
  } catch {
    return null;
  }
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

interface ToneOptions {
  /** Frequência em Hz */
  freq: number;
  /** Atraso em segundos a partir de agora */
  at?: number;
  /** Duração total em segundos */
  dur?: number;
  vol?: number;
  type?: OscillatorType;
  /** Desliza a nota até essa frequência */
  glideTo?: number;
  /** Tempo de ataque em segundos */
  attack?: number;
  /** Corte do filtro passa-baixa */
  cutoff?: number;
  /** Soma um harmônico uma oitava acima (timbre de sino/marimba) */
  shimmer?: number;
}

function tone({
  freq,
  at = 0,
  dur = 0.25,
  vol = 0.2,
  type = 'sine',
  glideTo,
  attack = 0.008,
  cutoff = 5200,
  shimmer = 0,
}: ToneOptions) {
  const audio = getContext();
  if (!audio) return;
  const { ctx, out } = audio;
  const start = ctx.currentTime + at;
  const end = start + dur;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, start);
  filter.connect(gain);
  gain.connect(out);

  const voices: Array<[number, number, OscillatorType]> = [[1, 1, type]];
  if (shimmer > 0) voices.push([2, shimmer, 'sine'], [3.01, shimmer * 0.35, 'sine']);

  for (const [ratio, level, wave] of voices) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq * ratio, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo * ratio, start + dur * 0.85);
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = level;
    osc.connect(voiceGain);
    voiceGain.connect(filter);
    osc.start(start);
    osc.stop(end + 0.03);
  }
}

/** Ruído filtrado: cliques, sopros e varreduras */
function noise({
  at = 0,
  dur = 0.08,
  vol = 0.12,
  from = 1800,
  to,
  q = 1.2,
}: {
  at?: number;
  dur?: number;
  vol?: number;
  from?: number;
  to?: number;
  q?: number;
}) {
  const audio = getContext();
  if (!audio) return;
  const { ctx, out } = audio;
  const start = ctx.currentTime + at;

  const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, start);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, start + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.02, dur / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(start);
  source.stop(start + dur + 0.02);
}

// Notas usadas (Hz)
const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, E6: 1318.5, G6: 1567.98,
};

/* ------------------------------------------------------------------ */
/* Entrar e sair                                                       */
/* ------------------------------------------------------------------ */

/** Você entrou na sala: três notas subindo, timbre de sino */
export function playJoinRoomSound() {
  tone({ freq: N.E5, dur: 0.22, vol: 0.16, shimmer: 0.25 });
  tone({ freq: N.G5, at: 0.09, dur: 0.24, vol: 0.16, shimmer: 0.25 });
  tone({ freq: N.C6, at: 0.18, dur: 0.5, vol: 0.18, shimmer: 0.3 });
}

/** Você saiu da sala: três notas descendo, mais abafadas */
export function playLeaveRoomSound() {
  tone({ freq: N.C6, dur: 0.2, vol: 0.14, shimmer: 0.2, cutoff: 3200 });
  tone({ freq: N.G5, at: 0.09, dur: 0.22, vol: 0.14, shimmer: 0.2, cutoff: 2800 });
  tone({ freq: N.C5, at: 0.18, dur: 0.45, vol: 0.15, shimmer: 0.15, cutoff: 2200 });
}

/** Outra pessoa entrou: duas notas subindo, curtas */
export function playPeerJoinSound() {
  tone({ freq: N.G5, dur: 0.16, vol: 0.13, type: 'triangle' });
  tone({ freq: N.D5 * 2, at: 0.08, dur: 0.3, vol: 0.14, type: 'triangle', shimmer: 0.15 });
}

/** Alguém começou a ver a sua tela: dois toques claros subindo (diferente do som de entrar na sala) */
export function playViewerJoinSound() {
  tone({ freq: N.G5, dur: 0.1, vol: 0.11, shimmer: 0.2 });
  tone({ freq: N.C6, at: 0.08, dur: 0.24, vol: 0.12, shimmer: 0.25 });
}

/** Alguém parou de ver a sua tela: um toque baixo e curto */
export function playViewerLeaveSound() {
  tone({ freq: N.C6, dur: 0.1, vol: 0.09, shimmer: 0.15, cutoff: 3000 });
  tone({ freq: N.G5, at: 0.08, dur: 0.2, vol: 0.09, shimmer: 0.15, cutoff: 2400 });
}

/** Outra pessoa saiu: duas notas descendo, curtas */
export function playPeerLeaveSound() {
  tone({ freq: N.G5, dur: 0.16, vol: 0.12, type: 'triangle', cutoff: 3000 });
  tone({ freq: N.D5, at: 0.08, dur: 0.3, vol: 0.13, type: 'triangle', cutoff: 2400 });
}

/* ------------------------------------------------------------------ */
/* Microfone e áudio                                                   */
/* ------------------------------------------------------------------ */

/** Mutar: "bloop" para baixo */
export function playMuteSound() {
  noise({ dur: 0.02, vol: 0.05, from: 2600 });
  tone({ freq: 620, glideTo: 300, dur: 0.13, vol: 0.2, type: 'sine', cutoff: 2600 });
}

/** Desmutar: "blip" para cima */
export function playUnmuteSound() {
  noise({ dur: 0.02, vol: 0.05, from: 3200 });
  tone({ freq: 420, glideTo: 860, dur: 0.12, vol: 0.19, type: 'sine', cutoff: 4200 });
}

/** Silenciar a chamada: duas batidas graves descendo */
export function playDeafenSound() {
  tone({ freq: 400, glideTo: 240, dur: 0.11, vol: 0.2, cutoff: 1500 });
  tone({ freq: 300, glideTo: 170, at: 0.1, dur: 0.16, vol: 0.2, cutoff: 1200 });
}

/** Voltar a ouvir: duas batidas subindo */
export function playUndeafenSound() {
  tone({ freq: 240, glideTo: 380, dur: 0.11, vol: 0.19, cutoff: 2200 });
  tone({ freq: 380, glideTo: 620, at: 0.1, dur: 0.16, vol: 0.19, cutoff: 3200 });
}

/* ------------------------------------------------------------------ */
/* Câmera e tela                                                       */
/* ------------------------------------------------------------------ */

/** Câmera: clique de obturador + nota que sobe (ligar) ou desce (desligar) */
export function playCameraSound(isOn: boolean) {
  noise({ dur: 0.03, vol: 0.14, from: 4200, q: 0.8 });
  noise({ at: 0.045, dur: 0.025, vol: 0.09, from: 2600, q: 0.8 });
  if (isOn) tone({ freq: N.A5, glideTo: N.E6, at: 0.07, dur: 0.22, vol: 0.13, shimmer: 0.2 });
  else tone({ freq: N.E6, glideTo: N.A5, at: 0.07, dur: 0.2, vol: 0.11, cutoff: 3000 });
}

/** Tela: sopro de ar subindo + acorde (iniciar) ou sopro descendo (parar) */
export function playScreenShareSound(isSharing: boolean) {
  if (isSharing) {
    noise({ dur: 0.28, vol: 0.09, from: 500, to: 5200, q: 2 });
    tone({ freq: N.C5, at: 0.18, dur: 0.4, vol: 0.11, shimmer: 0.2 });
    tone({ freq: N.G5, at: 0.18, dur: 0.4, vol: 0.1, shimmer: 0.2 });
    tone({ freq: N.E6, at: 0.24, dur: 0.45, vol: 0.09, shimmer: 0.15 });
  } else {
    noise({ dur: 0.26, vol: 0.08, from: 4600, to: 420, q: 2 });
    tone({ freq: N.G5, glideTo: N.C5, at: 0.1, dur: 0.3, vol: 0.11, cutoff: 2600 });
  }
}

/* ------------------------------------------------------------------ */
/* Chat e avisos                                                       */
/* ------------------------------------------------------------------ */

/** Mensagem enviada: estalo leve para cima */
export function playMessageSentSound() {
  tone({ freq: 720, glideTo: 1180, dur: 0.07, vol: 0.13, type: 'triangle', attack: 0.004 });
}

/** Mensagem recebida: duas notas de marimba */
export function playMessageReceivedSound() {
  tone({ freq: N.G5, dur: 0.18, vol: 0.17, type: 'triangle', shimmer: 0.35, attack: 0.004, cutoff: 3600 });
  tone({ freq: N.C6, at: 0.1, dur: 0.32, vol: 0.17, type: 'triangle', shimmer: 0.35, attack: 0.004, cutoff: 3600 });
}

/** Convite ou aviso importante: três toques claros */
export function playNotificationSound() {
  tone({ freq: N.E6, dur: 0.14, vol: 0.14, shimmer: 0.3 });
  tone({ freq: N.E6, at: 0.16, dur: 0.14, vol: 0.14, shimmer: 0.3 });
  tone({ freq: N.G6, at: 0.32, dur: 0.45, vol: 0.15, shimmer: 0.3 });
}

/** Ação concluída (copiar, criar sala, salvar): acorde maior rápido */
export function playSuccessSound() {
  tone({ freq: N.C5, dur: 0.16, vol: 0.13, type: 'triangle' });
  tone({ freq: N.E5, at: 0.06, dur: 0.18, vol: 0.13, type: 'triangle' });
  tone({ freq: N.G5, at: 0.12, dur: 0.36, vol: 0.15, type: 'triangle', shimmer: 0.2 });
}

/** Algo deu errado ou foi negado: duas notas graves e secas */
export function playErrorSound() {
  tone({ freq: 220, dur: 0.12, vol: 0.2, type: 'square', cutoff: 900 });
  tone({ freq: 174.6, at: 0.14, dur: 0.22, vol: 0.2, type: 'square', cutoff: 800 });
}

/* ------------------------------------------------------------------ */
/* Pomodoro e lousa                                                    */
/* ------------------------------------------------------------------ */

/** Fim do ciclo: três badaladas longas */
export function playPomodoroChime() {
  [N.C5, N.E5, N.G5].forEach((freq, i) => {
    tone({ freq, at: i * 0.38, dur: 1.4, vol: 0.2, shimmer: 0.45, attack: 0.006 });
  });
  tone({ freq: N.C6, at: 1.14, dur: 2.2, vol: 0.2, shimmer: 0.5, attack: 0.006 });
}

/** Lousa limpa: varredura de apagador */
export function playBoardClearSound() {
  noise({ dur: 0.32, vol: 0.1, from: 3200, to: 700, q: 0.7 });
}

/* ------------------------------------------------------------------ */
/* Moderação                                                           */
/* ------------------------------------------------------------------ */

/** Expulsão: batida grave + queda */
export function playKickSound() {
  noise({ dur: 0.05, vol: 0.2, from: 300, q: 0.6 });
  tone({ freq: 196, glideTo: 82, dur: 0.42, vol: 0.26, type: 'sawtooth', cutoff: 700 });
  tone({ freq: 98, glideTo: 55, at: 0.05, dur: 0.5, vol: 0.2, cutoff: 500 });
}

/** Castigo: campainha grave em duas batidas */
export function playPunishSound() {
  tone({ freq: 146.8, dur: 0.16, vol: 0.22, type: 'square', cutoff: 700 });
  tone({ freq: 146.8, at: 0.2, dur: 0.3, vol: 0.22, type: 'square', cutoff: 650 });
}

/** Castigo retirado: sobe e resolve */
export function playPardonSound() {
  tone({ freq: N.D4, glideTo: N.A4, dur: 0.2, vol: 0.15, type: 'triangle' });
  tone({ freq: N.D5, at: 0.18, dur: 0.4, vol: 0.15, type: 'triangle', shimmer: 0.2 });
}

/** Virou adm: pequena fanfarra */
export function playPromoteSound() {
  tone({ freq: N.G4, dur: 0.12, vol: 0.14, type: 'triangle' });
  tone({ freq: N.C5, at: 0.11, dur: 0.12, vol: 0.14, type: 'triangle' });
  tone({ freq: N.E5, at: 0.22, dur: 0.12, vol: 0.14, type: 'triangle' });
  tone({ freq: N.G5, at: 0.33, dur: 0.6, vol: 0.17, type: 'triangle', shimmer: 0.35 });
  tone({ freq: N.C6, at: 0.33, dur: 0.6, vol: 0.12, shimmer: 0.3 });
}

/** Perdeu o cargo de adm: fanfarra invertida e curta */
export function playDemoteSound() {
  tone({ freq: N.G5, dur: 0.12, vol: 0.13, type: 'triangle', cutoff: 2800 });
  tone({ freq: N.E5, at: 0.11, dur: 0.12, vol: 0.13, type: 'triangle', cutoff: 2600 });
  tone({ freq: N.C5, at: 0.22, dur: 0.4, vol: 0.14, type: 'triangle', cutoff: 2200 });
}
