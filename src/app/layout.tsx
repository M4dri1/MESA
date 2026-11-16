import type { Metadata } from "next";
import { Archivo, Figtree } from "next/font/google";
import "./globals.css";
import "./modo-escuro.css";
// Fontes de acessibilidade (Configurações > Acessibilidade). Só são baixadas quando alguém escolhe uma delas.
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/opendyslexic/latin-400.css";
import "@fontsource/opendyslexic/latin-700.css";

// Aplica as preferências guardadas antes de pintar a tela, para o site não "pular" de tamanho, fonte ou idioma
const PREFS_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('mesa_prefs')||'{}');var d=document.documentElement;
if(p.fontScale&&p.fontScale!==1)d.style.setProperty('--mesa-scale',String(p.fontScale));
if(p.font&&p.font!=='default')d.setAttribute('data-mesa-font',p.font);
if(p.colorBlind&&p.colorBlind!=='none')d.setAttribute('data-mesa-cb',p.colorBlind);
if(p.reduceMotion)d.setAttribute('data-mesa-motion','reduce');
var t=JSON.parse(localStorage.getItem('mesa_theme')||'{}');if(t&&t.mode==='dark')d.setAttribute('data-mesa-mode','dark');
if(p.lang&&p.lang!=='pt'&&/^[a-z]{2}(-[a-z]{2})?$/.test(p.lang)){d.setAttribute('data-mesa-lang',p.lang);d.lang=({zh:'zh-CN','zh-tw':'zh-TW'})[p.lang]||p.lang;setTimeout(function(){d.setAttribute('data-mesa-ready','1')},4000)}
}catch(e){}})();`;

// Fontes da tela inicial: Archivo (largura variável) nos títulos, Figtree no texto
const displayFont = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mesa · A sala de estudo online",
  description: "Estude junto com os amigos, mesmo de longe. Chat, voz, câmera, tela e materiais na mesma sala.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${displayFont.variable} ${bodyFont.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[#0b0f19] text-slate-100 antialiased selection:bg-amber-400 selection:text-slate-900">
        {children}
      </body>
    </html>
  );
}

