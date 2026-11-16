'use client';

import React, { useState, useEffect } from 'react';
import { useMesa } from '@/context/MesaContext';
import { X, FileText, Download, ZoomIn, ZoomOut, ExternalLink, Link2, Image as ImageIcon, Copy } from 'lucide-react';
import { copyImage } from '@/utils/clipboardImage';

export function DocumentViewerModal() {
  const { activeDocument, setActiveDocument, downloadStudyMaterial, notify } = useMesa();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    setZoom(100);
  }, [activeDocument?.id]);

  if (!activeDocument) return null;

  const hasUrl = !!activeDocument.url && activeDocument.url !== '#';
  const isImage = activeDocument.type === 'image' && hasUrl;
  const isPdf = activeDocument.type === 'pdf' && hasUrl;
  const isLink = activeDocument.type === 'link';
  const Icon = isLink ? Link2 : isImage ? ImageIcon : FileText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0b0f19]/80 animate-fadeIn">
      <div className="relative w-full max-w-4xl h-[88vh] bg-[#0b0f19] rounded-3xl flex flex-col overflow-hidden shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)]">
        {/* Cabeçalho */}
        <div className="h-[72px] px-4 sm:px-6 bg-[#3044f0] text-white flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#ffd027] text-slate-950 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-white truncate">{activeDocument.title}</h3>
              <p className="text-xs text-white/80 truncate">
                Enviado por {activeDocument.uploadedBy}
                {activeDocument.size ? ` • ${activeDocument.size}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isImage && (
              <button
                data-testid="viewer-copy"
                onClick={async () => {
                  const result = await copyImage(activeDocument.url);
                  if (!result.ok) return notify(result.error);
                  notify(result.method === 'image' ? 'Imagem copiada. Cole com Ctrl+V onde quiser.' : 'O navegador não deixou copiar a imagem, então copiei o link dela.');
                }}
                className="h-10 px-4 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5"
                title="Copiar a imagem para colar em outro lugar"
              >
                <Copy className="w-4 h-4" />
                <span>Copiar</span>
              </button>
            )}
            {hasUrl && (
              <button
                onClick={() => downloadStudyMaterial(activeDocument)}
                className="h-10 px-4 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-all active:scale-95"
              >
                {isLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>{isLink ? 'Abrir link' : 'Baixar'}</span>
              </button>
            )}
            <button
              onClick={() => setActiveDocument(null)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0 bg-[#0b0f19] p-3 sm:p-6 overflow-auto flex items-center justify-center">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeDocument.url}
              alt={activeDocument.title}
              className="max-h-full max-w-full object-contain rounded-xl transition-transform"
              style={{ transform: `scale(${zoom / 100})` }}
            />
          ) : isPdf ? (
            <div className="w-full h-full rounded-xl overflow-hidden bg-white">
              <iframe src={activeDocument.url} title={activeDocument.title} className="w-full h-full border-none" />
            </div>
          ) : (
            <div className="max-w-sm text-center space-y-3">
              <Icon className="w-12 h-12 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-white break-words">{activeDocument.title}</p>
              <p className="text-xs text-slate-400 break-all">
                {isLink
                  ? activeDocument.url
                  : 'Esse tipo de arquivo não tem pré-visualização. Baixe para abrir no seu computador.'}
              </p>
              {hasUrl && (
                <button
                  onClick={() => downloadStudyMaterial(activeDocument)}
                  className="h-11 px-6 rounded-full bg-[#ffd027] hover:bg-[#ffdd55] text-slate-950 font-extrabold text-sm inline-flex items-center gap-2"
                >
                  {isLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  <span>{isLink ? 'Abrir link em nova aba' : 'Baixar arquivo'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Zoom (só para imagens) */}
        {isImage && (
          <div className="h-14 px-6 bg-[#0f1524] flex items-center justify-end gap-2 flex-shrink-0 text-xs text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              title="Reduzir zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono w-10 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
