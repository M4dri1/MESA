import React from 'react';

/** A estrelinha de quatro pontas da marca (a mesma da tela inicial). Posicione com `className` (ex.: "left-10 top-6 h-5 w-5 text-[#ffd027]") */
const SPARKLE_PATH = 'M12 0c.8 7 5 11.2 12 12-7 .8-11.2 5-12 12-.8-7-5-11.2-12-12 7-.8 11.2-5 12-12z';

export function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`absolute pointer-events-none ${className}`}>
      <path d={SPARKLE_PATH} fill="currentColor" />
    </svg>
  );
}
