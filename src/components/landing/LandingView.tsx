'use client';

import React from 'react';
import { useMesa } from '@/context/MesaContext';
import {
  ArrowRight,
  Download,
  FileText,
  Globe,
  Headphones,
  Lock,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Volume2,
} from 'lucide-react';

/* ---------------------------------------------------------------------------
   Peças pequenas reutilizadas pela página
   --------------------------------------------------------------------------- */

const SPARKLE_PATH =
  'M12 0c.8 7 5 11.2 12 12-7 .8-11.2 5-12 12-.8-7-5-11.2-12-12 7-.8 11.2-5 12-12z';

function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`absolute ${className}`}>
      <path d={SPARKLE_PATH} fill="currentColor" />
    </svg>
  );
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffd027] text-base font-black text-[#0b0f19]">
        M
      </span>
      <span className={`text-xl font-extrabold tracking-tight ${dark ? 'text-[#0b0f19]' : 'text-white'}`}>
        Mesa
      </span>
    </span>
  );
}

function Face({
  letter,
  color,
  size = 'h-8 w-8 text-xs',
  speaking = false,
}: {
  letter: string;
  color: string;
  size?: string;
  speaking?: boolean;
}) {
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${size} ${
        speaking ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0f1524]' : ''
      }`}
      style={{ backgroundColor: color }}
    >
      {letter}
    </span>
  );
}

function WaveBars() {
  return (
    <span className="flex h-[18px] items-center gap-[3px]">
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className="voice-wave-bar w-[3px] rounded-full bg-emerald-400"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

type Person = { letter: string; color: string; name: string };

const PEOPLE: Record<'ana' | 'beto' | 'carla' | 'voce', Person> = {
  ana: { letter: 'A', color: '#3b82f6', name: 'Ana' },
  beto: { letter: 'B', color: '#ec4899', name: 'Beto' },
  carla: { letter: 'C', color: '#8b5cf6', name: 'Carla' },
  voce: { letter: 'V', color: '#10b981', name: 'Você' },
};

/* ---------------------------------------------------------------------------
   Mockup grande do app (decorativo)
   --------------------------------------------------------------------------- */

function AppMockup() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none overflow-hidden rounded-2xl bg-[#0f1524] text-left shadow-[0_40px_80px_-24px_rgba(11,15,25,0.6)] sm:rounded-3xl"
    >
      <div className="flex h-[400px] sm:h-[500px]">
        {/* Lista de salas */}
        <aside className="hidden w-60 flex-col bg-[#080c14] md:flex">
          <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffd027] text-xs font-black text-[#0b0f19]">
              M
            </span>
            <span className="truncate text-sm font-bold text-white">Engenharia 2026</span>
          </div>

          <div className="flex-1 space-y-0.5 px-2 py-3">
            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Salas de voz
            </p>

            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1.5 text-sm font-semibold text-white">
              <Volume2 className="h-4 w-4 text-slate-300" />
              Cálculo 2
            </div>
            <div className="space-y-1.5 py-1.5 pl-8">
              {[PEOPLE.ana, PEOPLE.beto, PEOPLE.carla, PEOPLE.voce].map((p, i) => (
                <div key={p.name} className="flex items-center gap-2 text-[13px] text-slate-300">
                  <Face letter={p.letter} color={p.color} size="h-5 w-5 text-[10px]" />
                  <span className={i === 0 ? 'font-semibold text-white' : ''}>{p.name}</span>
                </div>
              ))}
            </div>

            {['Biologia ENEM', 'Programação Web', 'Física 1'].map((room) => (
              <div key={room} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400">
                <Volume2 className="h-4 w-4" />
                {room}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-[#060910] px-3 py-2.5">
            <span className="flex items-center gap-2">
              <Face letter="V" color={PEOPLE.voce.color} size="h-7 w-7 text-xs" />
              <span className="text-[13px] font-semibold text-white">Você</span>
            </span>
            <span className="flex items-center gap-2.5 text-slate-400">
              <Mic className="h-4 w-4" />
              <Headphones className="h-4 w-4" />
            </span>
          </div>
        </aside>

        {/* Chamada */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-white/5 px-4">
            <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
              <Volume2 className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span className="truncate">Cálculo 2</span>
            </span>
            <span className="flex-shrink-0 rounded-full bg-[#ffd027] px-3 py-1 text-xs font-bold text-[#0b0f19]">
              Foco · 18:42
            </span>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-2.5 p-3 sm:gap-3 sm:p-4">
            <div className="relative flex items-center justify-center rounded-xl bg-[#17203a] ring-2 ring-emerald-400">
              <Face letter="A" color={PEOPLE.ana.color} size="h-14 w-14 text-xl sm:h-16 sm:w-16" />
              <span className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-black/50 px-2 py-1 text-xs font-semibold text-white">
                Ana <WaveBars />
              </span>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-[#f6f5f0] p-3 sm:p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Lista 3</p>
              <p className="mt-2 font-mono text-xs text-slate-500">1) ∫ (3x² + 2x) dx</p>
              <p className="mt-1.5 rounded-md bg-[#ffd027]/50 px-1.5 py-1 font-mono text-xs font-bold text-[#0b0f19]">
                2) ∫ 2x · e^(x²) dx
              </p>
              <p className="mt-1.5 font-mono text-xs text-slate-500">u = x² → du = 2x dx</p>
              <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                <Monitor className="h-3.5 w-3.5" /> Tela do Beto
              </span>
            </div>

            <div className="relative flex items-center justify-center rounded-xl bg-[#17203a]">
              <Face letter="C" color={PEOPLE.carla.color} size="h-14 w-14 text-xl sm:h-16 sm:w-16" />
              <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-xs font-semibold text-white">
                Carla <MicOff className="h-3.5 w-3.5 text-rose-400" />
              </span>
            </div>

            <div className="relative flex items-center justify-center rounded-xl bg-[#17203a]">
              <Face letter="V" color={PEOPLE.voce.color} size="h-14 w-14 text-xl sm:h-16 sm:w-16" />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 text-xs font-semibold text-white">
                Você
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pb-4">
            {[Mic, Headphones, Monitor].map((Icon, i) => (
              <span key={i} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            ))}
            <span className="flex h-10 w-14 items-center justify-center rounded-full bg-rose-500 text-white">
              <PhoneOff className="h-[18px] w-[18px]" />
            </span>
          </div>
        </div>

        {/* Chat */}
        <aside className="hidden w-72 flex-col border-l border-white/5 bg-[#0b0f19] lg:flex">
          <div className="flex h-14 items-center border-b border-white/5 px-4 text-sm font-bold text-white">
            Chat da sala
          </div>
          <div className="flex-1 space-y-4 p-4">
            <ChatLine person={PEOPLE.ana} time="20:14" text="alguém tem o PDF da lista 3?" />
            <ChatLine person={PEOPLE.beto} time="20:15" text="mandei aqui 👇">
              <PdfCard name="lista-3-integrais.pdf" meta="1,2 MB" />
            </ChatLine>
            <ChatLine person={PEOPLE.carla} time="20:15" text="salvou minha noite, valeu" />
          </div>
          <div className="p-3">
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-[13px] text-slate-500">
              Conversar em Cálculo 2
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ChatLine({
  person,
  time,
  text,
  children,
}: {
  person: { letter: string; color: string; name: string };
  time: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <Face letter={person.letter} color={person.color} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">
          <span className="font-bold" style={{ color: person.color }}>
            {person.name}
          </span>
          <span className="ml-2 text-[11px] text-slate-500">{time}</span>
        </p>
        <p className="text-[13px] leading-snug text-slate-200">{text}</p>
        {children}
      </div>
    </div>
  );
}

function PdfCard({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-white/5 p-2.5">
      <FileText className="h-7 w-7 flex-shrink-0 text-[#ffd027]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white">{name}</p>
        <p className="text-[11px] text-slate-400">{meta}</p>
      </div>
      <Download className="h-4 w-4 flex-shrink-0 text-slate-300" />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Ilustrações das seções (decorativas)
   --------------------------------------------------------------------------- */

function RoomsVisual() {
  const rooms: Array<{ name: string; people: Person[]; locked?: boolean }> = [
    { name: 'Cálculo 2', people: [PEOPLE.ana, PEOPLE.beto, PEOPLE.carla] },
    { name: 'Biologia ENEM', people: [PEOPLE.carla, PEOPLE.voce] },
    { name: 'TCC · grupo 4', people: [], locked: true },
    { name: 'Programação Web', people: [] },
  ];

  return (
    <div className="space-y-2.5 rounded-2xl bg-[#0b0f19] p-4 sm:p-5">
      <p className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Minhas salas</p>
      {rooms.map((room) => (
        <div key={room.name} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3.5 py-3">
          <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-white">
            {room.locked ? (
              <Lock className="h-4 w-4 flex-shrink-0 text-slate-400" />
            ) : (
              <Volume2 className="h-4 w-4 flex-shrink-0 text-slate-400" />
            )}
            <span className="truncate">{room.name}</span>
          </span>
          {room.people.length > 0 ? (
            <span className="flex flex-shrink-0 items-center gap-2">
              <span className="flex -space-x-2">
                {room.people.map((p) => (
                  <span key={p.name} className="rounded-full ring-2 ring-[#161c2a]">
                    <Face letter={p.letter} color={p.color} size="h-6 w-6 text-[10px]" />
                  </span>
                ))}
              </span>
              <span className="text-xs font-semibold text-emerald-400">estudando</span>
            </span>
          ) : (
            <span className="flex-shrink-0 text-xs text-slate-500">{room.locked ? 'só convidados' : 'vazia'}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function VoiceVisual() {
  const rows: Array<Person & { note: string; speaking?: boolean; muted?: boolean }> = [
    { ...PEOPLE.ana, note: 'explicando o passo 2', speaking: true },
    { ...PEOPLE.beto, note: 'compartilhando a tela' },
    { ...PEOPLE.carla, note: 'no mudo', muted: true },
    { ...PEOPLE.voce, note: 'acabou de chegar' },
  ];

  return (
    <div className="rounded-2xl bg-[#0f1524] p-4 sm:p-5">
      <p className="flex items-center gap-2 px-1 pb-3 text-sm font-bold text-white">
        <Volume2 className="h-4 w-4 text-slate-400" /> Cálculo 2
      </p>
      <div className="space-y-1">
        {rows.map((p) => (
          <div
            key={p.name}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${p.speaking ? 'bg-white/10' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Face letter={p.letter} color={p.color} size="h-9 w-9 text-sm" speaking={p.speaking} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{p.name}</span>
                <span className="block truncate text-xs text-slate-400">{p.note}</span>
              </span>
            </span>
            {p.speaking ? (
              <WaveBars />
            ) : p.muted ? (
              <MicOff className="h-4 w-4 flex-shrink-0 text-rose-400" />
            ) : (
              <Mic className="h-4 w-4 flex-shrink-0 text-slate-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesVisual() {
  return (
    <div className="space-y-4 rounded-2xl bg-[#0b0f19] p-4 sm:p-5">
      <ChatLine person={PEOPLE.ana} time="20:14" text="alguém tem o PDF da lista 3?" />
      <ChatLine person={PEOPLE.beto} time="20:15" text="tá na mão, e o resumo da prova também">
        <PdfCard name="lista-3-integrais.pdf" meta="1,2 MB" />
        <PdfCard name="resumo-formulas-prova.pdf" meta="850 KB" />
      </ChatLine>
    </div>
  );
}

function PomodoroVisual() {
  return (
    <div className="rounded-2xl bg-[#0b0f19] p-6 text-center sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Foco · ciclo 2 de 4</p>
      <p className="landing-display mt-3 text-6xl text-white sm:text-7xl">18:42</p>
      <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[26%] rounded-full bg-[#ffd027]" />
      </div>
      <div className="mt-6 flex items-center justify-center gap-3">
        <span className="flex -space-x-2">
          {[PEOPLE.ana, PEOPLE.beto, PEOPLE.carla, PEOPLE.voce].map((p) => (
            <span key={p.name} className="rounded-full ring-2 ring-[#0b0f19]">
              <Face letter={p.letter} color={p.color} size="h-7 w-7 text-xs" />
            </span>
          ))}
        </span>
        <span className="text-sm text-slate-300">4 no mesmo cronômetro</span>
      </div>
    </div>
  );
}

function Feature({
  id,
  tone,
  panel,
  flip = false,
  title,
  text,
  visual,
}: {
  id: string;
  tone: string;
  panel: string;
  flip?: boolean;
  title: string;
  text: string;
  visual: React.ReactNode;
}) {
  return (
    <section id={id} className={tone}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-20">
        <div
          aria-hidden="true"
          className={`pointer-events-none select-none rounded-[2rem] p-5 sm:p-10 ${panel} ${flip ? 'lg:order-2' : ''}`}
        >
          {visual}
        </div>
        <div>
          <h2 className="landing-display text-[1.75rem] text-[#0b0f19] sm:text-4xl lg:text-[2.6rem]">{title}</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#444b5c]">{text}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Página
   --------------------------------------------------------------------------- */

const NAV_LINKS = [
  { href: '#salas', label: 'Salas' },
  { href: '#voz', label: 'Voz' },
  { href: '#materiais', label: 'Materiais' },
  { href: '#pomodoro', label: 'Pomodoro' },
];

const MARQUEE = ['Estudar', 'Tirar dúvida', 'Revisar', 'Focar', 'Passar'];

export function LandingView() {
  const { openAuthModal, openSettings } = useMesa();

  return (
    <div className="landing h-full w-full flex-1 overflow-y-auto scroll-smooth bg-[#f6f5f0] text-[#0b0f19]">
      {/* ===================== HERO ===================== */}
      <header className="relative">
        {/* Fundo azul que termina no meio do mockup */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-28 top-0 overflow-hidden bg-[#3044f0] sm:bottom-44">
          {/* As estrelas da altura do título só aparecem quando há margem lateral */}
          <Sparkle className="left-[6%] top-[22%] hidden h-7 w-7 text-white sm:block" />
          <Sparkle className="left-[14%] top-[46%] hidden h-4 w-4 text-white/60 sm:block" />
          <Sparkle className="right-[8%] top-[18%] hidden h-10 w-10 text-[#ffd027] sm:block" />
          <Sparkle className="right-[16%] top-[40%] hidden h-5 w-5 text-white/70 sm:block" />
          <Sparkle className="left-[30%] top-[9%] h-3 w-3 text-white/60" />
          <Sparkle className="right-[34%] top-[6%] h-4 w-4 text-white/50" />
          <Sparkle className="left-[4%] top-[70%] h-5 w-5 text-[#ffd027]" />
          <Sparkle className="right-[5%] top-[66%] h-6 w-6 text-white/70" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Logo />
          <div className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[15px] font-semibold text-white underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              data-testid="landing-settings"
              onClick={() => openSettings('language')}
              title="Idioma e acessibilidade"
              aria-label="Idioma e acessibilidade"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/15"
            >
              <Globe className="h-5 w-5" />
            </button>
            <button
              onClick={() => openAuthModal('login')}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0b0f19] transition hover:text-[#3044f0] hover:shadow-lg"
            >
              Entrar
            </button>
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-5xl px-5 pt-10 text-center sm:pt-16">
          <h1 className="landing-display text-[2.1rem] text-white sm:text-6xl lg:text-[4.75rem]">
            A mesa de estudo que cabe a turma inteira
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white sm:text-xl">
            O Mesa é onde a sua turma se encontra pra estudar: sala de voz sempre aberta, o PDF da
            lista no chat e um Pomodoro no mesmo ritmo pra todo mundo.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => openAuthModal('signup')}
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-white px-8 py-4 text-lg font-semibold text-[#0b0f19] transition hover:text-[#3044f0] hover:shadow-xl sm:w-auto"
            >
              Criar conta grátis
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => openAuthModal('login')}
              className="w-full rounded-full bg-[#0b0f19] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#1a2238] hover:shadow-xl sm:w-auto"
            >
              Já tenho conta
            </button>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-14 max-w-6xl px-4 pb-6 sm:mt-16 sm:px-8">
          <AppMockup />
        </div>
      </header>

      {/* ===================== RECURSOS ===================== */}
      <Feature
        id="salas"
        tone="bg-[#f6f5f0]"
        panel="bg-[#3044f0]"
        title="Uma sala pra cada matéria"
        text="Crie uma sala pra Cálculo, outra pro ENEM, outra só pro grupo do TCC. Cada uma guarda a conversa e os materiais dela, e dá pra ver de longe quem já sentou pra estudar."
        visual={<RoomsVisual />}
      />

      <Feature
        id="voz"
        tone="bg-white"
        panel="bg-[#ffd027]"
        flip
        title="Entrar na chamada é puxar uma cadeira"
        text="Nada de link que expira ou de esperar alguém te aceitar. A sala de voz fica aberta: você vê quem está lá, clica e já está conversando. Câmera e tela compartilhada ficam a um clique."
        visual={<VoiceVisual />}
      />

      <Feature
        id="materiais"
        tone="bg-[#f6f5f0]"
        panel="bg-[#23c58b]"
        title="O PDF da lista não se perde mais"
        text="Mande a lista, o resumo ou a foto do caderno direto no chat da sala. Fica tudo guardado lá, e qualquer colega abre ou baixa na hora, sem pedir permissão."
        visual={<FilesVisual />}
      />

      <Feature
        id="pomodoro"
        tone="bg-white"
        panel="bg-[#ff6a4d]"
        flip
        title="Todo mundo no mesmo cronômetro"
        text="O Pomodoro é da sala inteira: 25 minutos de foco, 5 de pausa, e o aviso toca pra todo mundo junto. Fica bem mais difícil abrir o celular quando a turma toda está focada."
        visual={<PomodoroVisual />}
      />

      {/* ===================== FAIXA ANIMADA ===================== */}
      <div aria-hidden="true" className="overflow-hidden bg-[#0b0f19] py-6 sm:py-8">
        <div className="landing-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex flex-shrink-0 items-center">
              {MARQUEE.map((word) => (
                <span key={word} className="flex items-center">
                  <span className="landing-display px-6 text-4xl text-[#ffd027] sm:px-10 sm:text-6xl">{word}</span>
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white sm:h-9 sm:w-9">
                    <path d={SPARKLE_PATH} fill="currentColor" />
                  </svg>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ===================== CHAMADA FINAL ===================== */}
      <section className="relative overflow-hidden bg-[#3044f0] px-5 py-24 text-center sm:py-32">
        <Sparkle className="left-[8%] top-[20%] hidden h-8 w-8 text-[#ffd027] sm:block" />
        <Sparkle className="left-[20%] bottom-[18%] hidden h-4 w-4 text-white/70 sm:block" />
        <Sparkle className="right-[10%] top-[28%] hidden h-5 w-5 text-white/70 sm:block" />
        <Sparkle className="right-[18%] bottom-[16%] hidden h-9 w-9 text-white sm:block" />

        <h2 className="landing-display relative mx-auto max-w-4xl text-[2rem] text-white sm:text-5xl lg:text-6xl">
          Acabou a página. Bora estudar?
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-lg text-white">
          Crie a conta, abra uma sala e mande o código pra turma. Funciona direto no navegador.
        </p>
        <button
          onClick={() => openAuthModal('signup')}
          className="relative mt-9 inline-flex items-center gap-2.5 rounded-full bg-[#ffd027] px-9 py-4 text-lg font-bold text-[#0b0f19] transition hover:bg-[#ffdb57] hover:shadow-xl"
        >
          Criar conta grátis
          <ArrowRight className="h-5 w-5" />
        </button>
      </section>

      {/* ===================== RODAPÉ ===================== */}
      <footer className="bg-[#0b0f19] text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="underline-offset-4 hover:text-white hover:underline">
                {link.label}
              </a>
            ))}
            <button
              onClick={() => openAuthModal('login')}
              className="underline-offset-4 hover:text-white hover:underline"
            >
              Entrar
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="font-semibold text-[#ffd027] underline-offset-4 hover:underline"
            >
              Criar conta
            </button>
          </div>

          <span className="text-sm text-slate-500">© 2026 Mesa</span>
        </div>
      </footer>
    </div>
  );
}
