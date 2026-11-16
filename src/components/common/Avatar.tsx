'use client';

import React from 'react';
import { mediaTransformStyle } from '@/utils/mediaTransform';

interface AvatarProps {
  letter: string;
  avatarUrl?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  className?: string;
}

export function Avatar({
  letter,
  avatarUrl,
  color = '#2563eb',
  size = 'md',
  isSpeaking = false,
  className = '',
}: AvatarProps) {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs font-semibold',
    md: 'w-9 h-9 text-sm font-bold',
    lg: 'w-12 h-12 text-base font-bold',
    xl: 'w-16 h-16 text-2xl font-bold',
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-full text-white flex-shrink-0 select-none transition-transform overflow-hidden ${
        sizeClasses[size]
      } ${isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0b0f19] animate-pulse-subtle' : ''} ${className}`}
      style={{ backgroundColor: avatarUrl ? 'transparent' : color }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={letter || 'Avatar'}
          style={mediaTransformStyle(avatarUrl)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{letter}</span>
      )}
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'subject' | 'private' | 'amber' | 'emerald';
  className?: string;
}

export function Badge({ children, variant = 'primary', className = '' }: BadgeProps) {
  const variantStyles = {
    primary: 'bg-[#ffd027]/20 text-[#ffd027] border border-[#ffd027]/30',
    secondary: 'bg-slate-800 text-slate-300 border border-slate-700',
    subject: 'bg-[#1e293b]/90 text-slate-200 border border-slate-700/80 font-medium',
    private: 'bg-slate-900/80 text-slate-300 border border-slate-700/60',
    amber: 'bg-amber-400/20 text-amber-300 border border-amber-400/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
