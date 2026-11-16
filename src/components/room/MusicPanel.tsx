'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { MusicSearchItem } from '@/types';
import { Music2, Play, Pause, SkipForward, Trash2, Search, Upload, Loader2, Volume2, VolumeX, Plus, Power, ChevronsUp, Maximize2, Fullscreen, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Player do YouTube (API oficial de embed)                            */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => {
        ytApiPromise = null;
        reject(new Error('player do YouTube indisponível'));
      };
      document.head.appendChild(tag);
    });
  }
  return ytApiPromise;
}

const EQUALIZER_DELAYS = [0, 0.25, 0.5, 0.15];

export function Equalizer({ playing, className = 'h-4' }: { playing: boolean; className?: string }) {
  return (
    <span className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {EQUALIZER_DELAYS.map((delay) => (
        <span
          key={delay}
          className={`w-[3px] rounded-full bg-emerald-400 ${playing ? 'voice-wave-bar' : ''}`}
          style={{ height: playing ? undefined : 4, animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Faixa "tocando agora", visível em qualquer aba do painel            */
/* ------------------------------------------------------------------ */

export function MusicStrip({ blocked, onResume, onOpen }: { blocked: boolean; onResume: () => void; onOpen: () => void }) {
  const { music, currentUser, myRole, musicControl } = useMesa();
  const current = music.queue[0];
  if (!music.on || !current) return null;
  const canControl = myRole !== 'member' || current.addedById === currentUser.id;

  return (
    <div
      data-testid="music-strip"
      className="px-3 py-2 border-t border-slate-900/10 bg-[#f6f5f0] flex items-center gap-2"
    >
      <button type="button" onClick={onOpen} title="Abrir o bot de música" className="flex items-center gap-2 min-w-0 flex-1 text-left">
        <Music2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-slate-900 truncate">{current.title}</span>
          <span className="block text-[10px] text-slate-500 truncate">pedida por {current.addedBy}</span>
        </span>
      </button>
      {blocked && (
        <button
          type="button"
          data-testid="music-unblock"
          onClick={onResume}
          className="px-2 py-1 rounded-lg bg-[#ffd027] text-slate-950 text-[11px] font-black flex-shrink-0"
        >
          Ouvir
        </button>
      )}
      {canControl && (
        <>
          <button
            type="button"
            title={music.playing ? 'Pausar para todos' : 'Continuar para todos'}
            onClick={() => musicControl(music.playing ? 'pause' : 'resume')}
            className="p-1.5 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 text-slate-900"
          >
            {music.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            title="Pular para a próxima"
            onClick={() => musicControl('skip')}
            className="p-1.5 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 text-slate-900"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aba "Música": toca, controla e mostra a fila                        */
/* ------------------------------------------------------------------ */

/**
 * Este componente fica montado enquanto a pessoa está na sala (mesmo com outra aba aberta),
 * porque é ele que toca a música. O servidor só diz "esta música, neste ponto, tocando ou
 * pausada"; aqui cada navegador se alinha a isso. Se passar de 1,5 s de diferença, corrige sozinho.
 */
export function MusicPanel({
  active,
  onBlocked,
  resumeRef,
}: {
  active: boolean;
  onBlocked: (blocked: boolean) => void;
  resumeRef: React.MutableRefObject<(() => void) | null>;
}) {
  const {
    music,
    currentUser,
    myRole,
    isDeafened,
    musicSummon,
    musicDismiss,
    musicAdd,
    musicSearch,
    musicControl,
    musicEnded,
    musicFailed,
    uploadRealFile,
    isUploading,
    uploadProgress,
    notify,
    musicVolume: volume,
    setMusicVolume: setVolume,
    musicMuted: localMuted,
    setMusicMuted: setLocalMuted,
  } = useMesa();

  const current = music.queue[0] || null;
  const musicRef = useRef(music);
  musicRef.current = music;
  const currentRef = useRef(current);
  currentRef.current = current;

  // Vídeo do YouTube em tamanho grande (só para quem pediu; não afeta os outros)
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);
  const [blocked, setBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytLoadedRef = useRef<string | null>(null);
  const ytBlockTimerRef = useRef<number | null>(null);
  const [ytReady, setYtReady] = useState(false);

  const isYoutube = current?.kind === 'youtube';

  // Se a música deixar de ser vídeo, ou se a aba for fechada, a visão ampliada fecha
  useEffect(() => {
    if (!isYoutube || !active) setExpanded(false);
  }, [isYoutube, active]);

  const expectedSeconds = () => {
    const m = musicRef.current;
    return (m.playing ? m.positionMs + (performance.now() - m.receivedAt) : m.positionMs) / 1000;
  };

  useEffect(() => {
    onBlocked(blocked);
  }, [blocked, onBlocked]);

  /* ---------- Arquivos enviados: <audio> ---------- */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!current || current.kind !== 'file') {
      el.pause();
      if (el.getAttribute('data-song')) {
        el.removeAttribute('data-song');
        el.removeAttribute('src');
        el.load();
      }
      return;
    }
    if (el.getAttribute('data-song') !== current.id) {
      el.setAttribute('data-song', current.id);
      el.src = current.ref;
      el.load();
    }
    const apply = () => {
      const target = expectedSeconds();
      if (Math.abs(el.currentTime - target) > 1.2) {
        try {
          el.currentTime = target;
        } catch {}
      }
      if (musicRef.current.playing) {
        el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      } else {
        el.pause();
      }
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener('loadedmetadata', apply, { once: true });
    return () => el.removeEventListener('loadedmetadata', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.kind, music.seq, music.playing]);

  /* ---------- YouTube: player oficial ---------- */
  useEffect(() => {
    if (!isYoutube || ytPlayerRef.current) return;
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !ytHostRef.current || ytPlayerRef.current) return;
        const holder = document.createElement('div');
        ytHostRef.current.appendChild(holder);
        ytPlayerRef.current = new YT.Player(holder, {
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, rel: 0, playsinline: 1, modestbranding: 1, origin: window.location.origin },
          events: {
            onReady: () => setYtReady(true),
            onStateChange: (event: { data: number }) => {
              const song = currentRef.current;
              if (event.data === 0 && song && song.kind === 'youtube') musicEnded(song.id);
              if (event.data === 1) {
                setBlocked(false);
                if (ytBlockTimerRef.current) window.clearTimeout(ytBlockTimerRef.current);
              }
            },
            onError: () => {
              const song = currentRef.current;
              if (song && song.kind === 'youtube') musicFailed(song.id);
            },
          },
        });
      })
      .catch(() => notify('Não foi possível carregar o player do YouTube. Verifique a conexão.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYoutube]);

  useEffect(() => {
    const player = ytPlayerRef.current;
    if (!player || !ytReady) return;
    if (!current || current.kind !== 'youtube') {
      try {
        player.stopVideo();
      } catch {}
      ytLoadedRef.current = null;
      return;
    }
    const target = expectedSeconds();
    if (ytLoadedRef.current !== current.id) {
      ytLoadedRef.current = current.id;
      if (music.playing) player.loadVideoById({ videoId: current.ref, startSeconds: target });
      else player.cueVideoById({ videoId: current.ref, startSeconds: target });
    } else {
      const now = player.getCurrentTime ? player.getCurrentTime() : 0;
      if (Math.abs(now - target) > 1.5) player.seekTo(target, true);
      if (music.playing) player.playVideo();
      else player.pauseVideo();
    }
    // Se o navegador barrar o som automático, avisa em vez de ficar mudo sem explicação
    if (ytBlockTimerRef.current) window.clearTimeout(ytBlockTimerRef.current);
    if (music.playing) {
      ytBlockTimerRef.current = window.setTimeout(() => {
        const state = player.getPlayerState ? player.getPlayerState() : 1;
        if (musicRef.current.playing && state !== 1 && state !== 3) setBlocked(true);
      }, 4500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytReady, current?.id, music.seq, music.playing]);

  /* ---------- Volume (só meu) ---------- */
  useEffect(() => {
    const silent = isDeafened || localMuted;
    const el = audioRef.current;
    if (el) {
      el.volume = silent ? 0 : volume;
      el.muted = silent;
    }
    const player = ytPlayerRef.current;
    if (player && ytReady) {
      player.setVolume(Math.round(volume * 100));
      if (silent) player.mute();
      else player.unMute();
    }
  }, [volume, localMuted, isDeafened, ytReady, current?.id]);

  /* ---------- Corrige diferença de tempo entre os navegadores ---------- */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const m = musicRef.current;
      const song = currentRef.current;
      if (!m.playing || !song) return;
      const target = expectedSeconds();
      if (song.kind === 'file') {
        const el = audioRef.current;
        if (el && !el.paused && Math.abs(el.currentTime - target) > 1.5) el.currentTime = target;
      } else {
        const player = ytPlayerRef.current;
        if (player && player.getCurrentTime && ytLoadedRef.current === song.id && Math.abs(player.getCurrentTime() - target) > 2) {
          player.seekTo(target, true);
        }
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  // Sair da sala (o painel desmonta) para a música
  useEffect(
    () => () => {
      try {
        ytPlayerRef.current?.destroy();
      } catch {}
      ytPlayerRef.current = null;
      audioRef.current?.pause();
      if (ytBlockTimerRef.current) window.clearTimeout(ytBlockTimerRef.current);
    },
    []
  );

  useEffect(() => {
    resumeRef.current = () => {
      setBlocked(false);
      if (currentRef.current?.kind === 'file') audioRef.current?.play().catch(() => setBlocked(true));
      else ytPlayerRef.current?.playVideo?.();
    };
  });

  /* ---------- Interface ---------- */
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MusicSearchItem[] | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = myRole !== 'member';
  const canControl = isAdmin || current?.addedById === currentUser.id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    setNeedsKey(false);
    if (/^https?:\/\//i.test(value)) {
      const result = await musicAdd(value);
      if (result.ok) {
        setText('');
        setResults(null);
      } else {
        setError(result.error || 'Não foi possível adicionar.');
      }
    } else {
      const result = await musicSearch(value);
      if (result.ok) setResults(result.items);
      else if (result.needsKey) setNeedsKey(true);
      else setError(result.error || 'Não foi possível buscar agora.');
    }
    setBusy(false);
  };

  const addResult = async (item: MusicSearchItem) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await musicAdd(`https://www.youtube.com/watch?v=${item.id}`);
    setBusy(false);
    if (result.ok) {
      setResults(null);
      setText('');
    } else {
      setError(result.error || 'Não foi possível adicionar.');
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file) uploadRealFile(file, { music: true });
  };

  return (
    <div className={active ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'hidden'} data-testid="music-panel">
      {/* Só existe enquanto toca um arquivo enviado; o YouTube usa o player próprio */}
      {current?.kind === 'file' && (
        <audio
          ref={audioRef}
          preload="auto"
          className="hidden"
          onEnded={() => {
            const song = currentRef.current;
            if (song && song.kind === 'file') musicEnded(song.id);
          }}
          onError={() => {
            const el = audioRef.current;
            const song = currentRef.current;
            if (el && song && song.kind === 'file' && el.getAttribute('data-song') === song.id) musicFailed(song.id);
          }}
        />
      )}
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.flac,.ogg,.wav" onChange={handleFile} className="hidden" data-testid="music-file" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!music.on ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center ">
              <Music2 className="w-7 h-7 text-slate-900" />
            </div>
            <h3 className="text-sm font-black text-slate-900">Mesa DJ</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[16rem] mx-auto">
              Chame o bot para a sala e escolham músicas juntos. Todo mundo ouve ao mesmo tempo, cada um com o próprio volume.
            </p>
            <button
              type="button"
              data-testid="music-summon"
              onClick={musicSummon}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs"
            >
              Chamar o bot de música
            </button>
          </div>
        ) : (
          <>
            {/* Tocando agora */}
            <div className="rounded-xl bg-[#f6f5f0] border border-slate-900/10 overflow-hidden">
              {expanded && isYoutube && (
                <>
                  <div className="fixed inset-0 z-[65] bg-black/85" onClick={() => setExpanded(false)} />
                  <div className="fixed z-[75] top-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="music-fullscreen"
                      onClick={() => ytHostRef.current?.requestFullscreen?.()}
                      className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-slate-900 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Fullscreen className="w-4 h-4" /> Tela cheia
                    </button>
                    <button
                      type="button"
                      data-testid="music-collapse"
                      onClick={() => setExpanded(false)}
                      className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-slate-900 text-xs font-bold flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Fechar
                    </button>
                  </div>
                </>
              )}
              <div
                ref={ytHostRef}
                data-testid="music-video"
                className={`bg-black [&_iframe]:w-full [&_iframe]:h-full ${
                  !isYoutube
                    ? 'hidden'
                    : expanded
                    ? 'fixed z-[70] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,calc(88vh*16/9),1100px)] aspect-video rounded-xl  overflow-hidden'
                    : 'relative w-full aspect-video min-h-[200px]'
                }`}
              />
              {!isYoutube && (
                <div className="px-4 py-6 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0">
                    <Music2 className="w-7 h-7 text-slate-900" />
                  </div>
                  <p className="text-xs text-slate-500">
                    {current ? 'Tocando um arquivo enviado pelo grupo.' : 'Nada tocando. Cole um link ou envie um arquivo abaixo.'}
                  </p>
                </div>
              )}

              {current && (
                <div className="p-3 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Equalizer playing={music.playing} className="h-4 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p data-testid="music-now-title" className="text-sm font-bold text-slate-900 leading-snug break-words">
                        {current.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {current.author ? `${current.author} · ` : ''}pedida por {current.addedBy}
                      </p>
                    </div>
                    {isYoutube && (
                      <button
                        type="button"
                        data-testid="music-expand"
                        onClick={() => setExpanded(true)}
                        title="Abrir o vídeo em tamanho grande"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 text-slate-900 text-[11px] font-bold flex items-center gap-1.5 flex-shrink-0"
                      >
                        <Maximize2 className="w-3.5 h-3.5" /> Ampliar
                      </button>
                    )}
                  </div>

                  {blocked && (
                    <button
                      type="button"
                      data-testid="music-unblock-panel"
                      onClick={() => resumeRef.current?.()}
                      className="w-full py-2 rounded-xl bg-[#ffd027] hover:bg-amber-300 text-slate-950 font-black text-xs"
                    >
                      O navegador bloqueou o som. Clique para ouvir
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {canControl ? (
                      <>
                        <button
                          type="button"
                          data-testid="music-toggle"
                          onClick={() => musicControl(music.playing ? 'pause' : 'resume')}
                          className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          {music.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {music.playing ? 'Pausar' : 'Tocar'}
                        </button>
                        <button
                          type="button"
                          data-testid="music-skip"
                          onClick={() => musicControl('skip')}
                          className="px-3 py-1.5 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 text-slate-900 text-xs font-bold flex items-center gap-1.5"
                        >
                          <SkipForward className="w-3.5 h-3.5" /> Pular
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500 flex-1">Quem controla: adm, dono e quem pediu esta música.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="music-mute"
                      onClick={() => setLocalMuted(!localMuted)}
                      title={localMuted ? 'Voltar a ouvir a música' : 'Silenciar a música só para mim'}
                      className={`p-1.5 rounded-lg flex-shrink-0 ${localMuted ? 'bg-rose-600 text-white' : 'bg-slate-900/5 text-slate-800 hover:bg-slate-900/10'}`}
                    >
                      {localMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(volume * 100)}
                      data-testid="music-volume"
                      onChange={(e) => {
                        setVolume(Number(e.target.value) / 100);
                        setLocalMuted(false);
                      }}
                      aria-label="Volume da música (só para você)"
                      className="w-full accent-violet-500"
                    />
                    <span className="text-[11px] font-mono text-slate-700 w-9 text-right">{Math.round(volume * 100)}%</span>
                  </div>
                  <p className="text-[10px] text-slate-500">O volume da música é só seu. Pausar e pular valem para todos.</p>
                </div>
              )}
            </div>

            {/* Adicionar música */}
            <div className="space-y-2">
              <form onSubmit={submit} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f6f5f0] border border-slate-900/10 focus-within:border-violet-500">
                  <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <input
                    type="text"
                    data-testid="music-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Cole um link do YouTube ou busque pelo nome"
                    className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  data-testid="music-submit"
                  disabled={busy || !text.trim()}
                  className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40"
                  title="Adicionar ou buscar"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </form>

              <button
                type="button"
                data-testid="music-upload"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 border border-slate-900/10"
              >
                <Upload className="w-3.5 h-3.5" /> Enviar música do computador
              </button>

              {isUploading && (
                <div className="h-1.5 rounded-full bg-slate-900/10 overflow-hidden" role="status">
                  <div className="h-full bg-violet-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              {error && (
                <p data-testid="music-error" className="text-xs text-rose-700 leading-relaxed">
                  {error}
                </p>
              )}
              {needsKey && (
                <p data-testid="music-needs-key" className="text-[11px] text-slate-500 leading-relaxed">
                  A busca por nome ainda não foi ligada neste servidor. Abra a música no YouTube, copie o link e cole aqui em cima.
                </p>
              )}

              {results && (
                <div className="space-y-1.5" data-testid="music-results">
                  {results.length === 0 && <p className="text-xs text-slate-500 text-center py-2">Nenhum resultado.</p>}
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid="music-result"
                      disabled={busy}
                      onClick={() => addResult(item)}
                      className="w-full flex items-center gap-2.5 p-1.5 rounded-xl bg-white hover:bg-slate-900/5 border border-slate-900/10 text-left disabled:opacity-60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumb} alt="" loading="lazy" className="w-16 h-9 rounded-md object-cover flex-shrink-0 bg-black" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 line-clamp-2">{item.title}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{item.author}</span>
                      </span>
                      <Plus className="w-4 h-4 text-violet-700 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fila */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                Fila ({Math.max(0, music.queue.length - 1)})
              </p>
              {music.queue.length <= 1 ? (
                <p className="text-xs text-slate-500">Nenhuma música esperando.</p>
              ) : (
                <div className="space-y-1.5" data-testid="music-queue">
                  {music.queue.slice(1).map((song) => {
                    const mine = song.addedById === currentUser.id;
                    return (
                      <div key={song.id} data-testid="music-queue-item" className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-900/10">
                        <Music2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-slate-900 truncate">{song.title}</span>
                          <span className="block text-[10px] text-slate-500 truncate">{song.addedBy}</span>
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            title="Tocar agora"
                            onClick={() => musicControl('playnow', song.id)}
                            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-900/10"
                          >
                            <ChevronsUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(isAdmin || mine) && (
                          <button
                            type="button"
                            title="Tirar da fila"
                            data-testid="music-remove"
                            onClick={() => musicControl('remove', song.id)}
                            className="p-1.5 rounded-lg text-rose-700 hover:text-white hover:bg-rose-600/70"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isAdmin && (
              <button
                type="button"
                data-testid="music-dismiss"
                onClick={musicDismiss}
                className="w-full py-2 rounded-xl text-rose-700 hover:bg-rose-600/20 text-xs font-bold flex items-center justify-center gap-2 border border-rose-500/30"
              >
                <Power className="w-3.5 h-3.5" /> Mandar o bot embora
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
