'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMesa } from '@/context/MesaContext';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';

const SPARKLE_PATH = 'M12 0c.8 7 5 11.2 12 12-7 .8-11.2 5-12 12-.8-7-5-11.2-12-12 7-.8 11.2-5 12-12z';

const FACES = [
  { letter: 'A', color: '#3b82f6' },
  { letter: 'B', color: '#ec4899' },
  { letter: 'C', color: '#8b5cf6' },
  { letter: 'V', color: '#10b981' },
];

const inputBase =
  'w-full h-11 px-3.5 rounded-lg bg-white border text-[15px] text-[#0b0f19] placeholder:text-[#0b0f19]/40 focus:outline-none focus:ring-4 transition';
const inputOk = 'border-[#0b0f19]/20 focus:border-[#3044f0] focus:ring-[#3044f0]/15';
const inputBad = 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15';
const labelClass = 'block mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0b0f19]/70';
const primaryButton =
  'w-full h-12 rounded-full bg-[#0b0f19] hover:bg-[#3044f0] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:hover:bg-[#0b0f19]';
const switchLink = 'font-bold text-[#3044f0] underline underline-offset-4 hover:text-[#0b0f19]';

function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`absolute ${className}`}>
      <path d={SPARKLE_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * Moldura dos popups de conta, no mesmo estilo da tela inicial: painel azul com o título grande
 * e formulário claro ao lado (no celular o painel azul vira uma faixa no topo).
 */
function AuthShell({
  heading,
  lead,
  onClose,
  children,
}: {
  heading: string;
  lead?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="auth-card fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#0b0f19]/70 backdrop-blur-sm animate-fadeIn"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
        className="relative w-full sm:max-w-[800px] max-h-full overflow-y-auto sm:overflow-hidden flex flex-col sm:flex-row rounded-t-2xl sm:rounded-2xl bg-[#f6f5f0] text-[#0b0f19] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)] animate-scaleUp"
      >
        <button
          type="button"
          onClick={onClose}
          title="Fechar"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white sm:text-[#0b0f19]/60 hover:bg-white/15 sm:hover:bg-[#0b0f19]/10 sm:hover:text-[#0b0f19] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Painel azul */}
        <aside className="relative flex-shrink-0 sm:w-[300px] overflow-hidden bg-[#3044f0] text-white px-5 pt-5 pb-5 sm:p-8 flex flex-col gap-3 sm:gap-0 sm:justify-between sm:min-h-[460px]">
          <Sparkle className="right-6 top-24 hidden h-6 w-6 text-[#ffd027] sm:block" />
          <Sparkle className="right-14 top-40 hidden h-3 w-3 text-white/60 sm:block" />
          <Sparkle className="left-6 bottom-28 hidden h-4 w-4 text-white/50 sm:block" />

          <span className="flex items-center gap-2.5 pr-10 sm:pr-0">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#ffd027] text-sm sm:text-base font-black text-[#0b0f19]">
              M
            </span>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight">Mesa</span>
          </span>

          <div>
            <h2 id="auth-heading" className="landing-display text-[1.55rem] sm:text-[2.15rem]">
              {heading}
            </h2>
            {lead && <p className="hidden sm:block mt-4 text-[15px] leading-relaxed text-white/85">{lead}</p>}
          </div>

          <div aria-hidden="true" className="hidden sm:flex -space-x-2">
            {FACES.map((face) => (
              <span
                key={face.letter}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[#3044f0]"
                style={{ backgroundColor: face.color }}
              >
                {face.letter}
              </span>
            ))}
          </div>
        </aside>

        {/* Formulário */}
        <div className="flex-1 min-w-0 p-5 sm:px-9 sm:pt-14 sm:pb-9 sm:overflow-y-auto sm:max-h-[min(46rem,92vh)] sm:flex sm:flex-col sm:justify-center">
          <div className="w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="mb-4 rounded-r-lg border-l-4 border-rose-600 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">
      {message}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputBase} pr-11 ${invalid ? inputBad : inputOk}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-[#0b0f19]/50 hover:text-[#0b0f19]"
      >
        {visible ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
      </button>
    </div>
  );
}

export function AuthModal() {
  const { isAuthModalOpen, setIsAuthModalOpen, login, signup, verifySignup, resendSignupCode, forgotPassword, resetPassword, authModalMode } = useMesa();

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Depois do cadastro, o servidor manda um código para este e-mail
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  // Esqueceu a senha: 'ask' pede o e-mail; 'reset' recebe o código e a senha nova
  const [forgotStep, setForgotStep] = useState<null | 'ask' | 'reset'>(null);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authModalMode) setMode(authModalMode);
    setError(null);
    setErrorField(null);
  }, [authModalMode, isAuthModalOpen]);

  // Esc fecha o popup
  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingEmail(null);
        setForgotStep(null);
        setIsAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthModalOpen, setIsAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const switchMode = (next: 'signup' | 'login') => {
    setMode(next);
    setError(null);
    setErrorField(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Escolha um arquivo de imagem para a foto de perfil.');
      setErrorField('avatar');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => setAvatarUrl(uploadEvent.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setErrorField(null);
    const result = await signup({
      fullName: fullName.trim(),
      nickname: nickname.trim(),
      email: signupEmail.trim(),
      password: signupPassword,
      avatarUrl: avatarUrl || undefined,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Não foi possível criar a conta.');
      setErrorField(result.field || null);
    } else if (result.needsVerification) {
      setPendingEmail(result.email || signupEmail.trim());
      setCode('');
      setInfo(null);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !pendingEmail) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    const result = await verifySignup(pendingEmail, code);
    setSubmitting(false);
    if (result.success) {
      setPendingEmail(null);
      return;
    }
    setError(result.error || 'Não foi possível confirmar o código.');
    // Nickname ou e-mail foi tomado nesse meio tempo: volta para o formulário
    if (result.field) {
      setErrorField(result.field);
      setPendingEmail(null);
    }
  };

  const handleResend = async () => {
    if (submitting || !pendingEmail) return;
    setSubmitting(true);
    setError(null);
    const result = await resendSignupCode(pendingEmail);
    setSubmitting(false);
    if (result.success) setInfo('Mandamos um código novo. Confira também a caixa de spam.');
    else setError(result.error || 'Não foi possível reenviar o código.');
  };

  const backToForm = () => {
    setPendingEmail(null);
    setError(null);
    setInfo(null);
  };

  const startForgot = () => {
    setForgotStep('ask');
    setForgotIdentifier(loginIdentifier);
    setError(null);
    setErrorField(null);
    setInfo(null);
  };

  const leaveForgot = () => {
    setForgotStep(null);
    setError(null);
    setErrorField(null);
    setInfo(null);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await forgotPassword(forgotIdentifier.trim());
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Não foi possível enviar o código.');
      return;
    }
    setResetCode('');
    setNewPassword('');
    setInfo(null);
    setForgotStep('reset');
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setErrorField(null);
    const result = await resetPassword(forgotIdentifier.trim(), resetCode, newPassword);
    setSubmitting(false);
    if (result.success) {
      setForgotStep(null);
      return;
    }
    setError(result.error || 'Não foi possível redefinir a senha.');
    setErrorField(result.field || null);
  };

  const handleResetResend = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await forgotPassword(forgotIdentifier.trim());
    setSubmitting(false);
    if (result.success) setInfo('Se a conta existir, mandamos um código novo. Confira também a caixa de spam.');
    else setError(result.error || 'Não foi possível enviar o código.');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await login(loginIdentifier.trim(), loginPassword);
    setSubmitting(false);
    if (!result.success) setError(result.error || 'Não foi possível entrar.');
  };

  const inputFor = (field: string) => `${inputBase} ${errorField === field ? inputBad : inputOk}`;
  const activeLetter = (nickname.trim()[0] || fullName.trim()[0] || 'U').toUpperCase();
  const close = () => {
    backToForm();
    leaveForgot();
    setIsAuthModalOpen(false);
  };

  /* ---------- Esqueceu a senha: pedir o código ---------- */
  if (forgotStep === 'ask') {
    return (
      <AuthShell
        heading="Esqueceu a senha?"
        lead="Digite o e-mail ou o nickname da sua conta. Mandamos um código para o e-mail dela, para você criar uma senha nova."
        onClose={close}
      >
        {error && <ErrorNote message={error} />}

        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <div>
            <label htmlFor="forgot-identifier" className={labelClass}>
              E-mail ou nickname
            </label>
            <input
              id="forgot-identifier"
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={forgotIdentifier}
              onChange={(e) => setForgotIdentifier(e.target.value)}
              placeholder="seu.email@exemplo.com"
              className={`${inputBase} ${inputOk}`}
            />
          </div>

          <button type="submit" disabled={submitting} className={`${primaryButton} mt-2`}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Enviando...' : 'Enviar código'}</span>
          </button>
        </form>

        <p className="mt-5 text-sm">
          <button type="button" onClick={leaveForgot} className={switchLink}>
            Voltar para o login
          </button>
        </p>
      </AuthShell>
    );
  }

  /* ---------- Esqueceu a senha: código e senha nova ---------- */
  if (forgotStep === 'reset') {
    return (
      <AuthShell heading="Crie uma senha nova" onClose={close}>
        <p className="text-[15px] text-[#0b0f19]/75 mb-5">
          Se existe uma conta com esse e-mail ou nickname, mandamos um código de 6 dígitos para o e-mail dela.
        </p>

        {error && <ErrorNote message={error} />}
        {info && (
          <div role="status" className="mb-4 rounded-r-lg border-l-4 border-emerald-600 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
            {info}
          </div>
        )}

        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-code" className={labelClass}>
              Código de confirmação
            </label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className={`w-full h-14 text-center tracking-[0.45em] font-mono text-2xl font-bold rounded-lg bg-white border text-[#0b0f19] placeholder:text-[#0b0f19]/25 focus:outline-none focus:ring-4 transition ${errorField === 'code' ? inputBad : inputOk}`}
            />
            <p className="text-xs text-[#0b0f19]/60 mt-2">O código vale por 15 minutos. Confira também a caixa de spam.</p>
          </div>

          <div>
            <label htmlFor="reset-password" className={labelClass}>
              Senha nova
            </label>
            <PasswordInput
              id="reset-password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Pelo menos 6 caracteres"
              autoComplete="new-password"
              minLength={6}
              invalid={errorField === 'password'}
            />
          </div>

          <button type="submit" disabled={submitting || resetCode.length !== 6} className={`${primaryButton} mt-2`}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Salvando...' : 'Redefinir senha'}</span>
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setForgotStep('ask');
              setError(null);
              setErrorField(null);
              setInfo(null);
            }}
            className="text-[#0b0f19]/70 hover:text-[#0b0f19] underline underline-offset-4"
          >
            Voltar
          </button>
          <button type="button" onClick={handleResetResend} disabled={submitting} className={`${switchLink} disabled:opacity-50`}>
            Reenviar código
          </button>
        </div>
      </AuthShell>
    );
  }

  /* ---------- Confirmar o e-mail ---------- */
  if (pendingEmail) {
    return (
      <AuthShell heading="Falta só o código" onClose={close}>
        <p className="text-[15px] text-[#0b0f19]/75">Mandamos um código de 6 dígitos para</p>
        <p className="text-[15px] font-bold break-all mb-5">{pendingEmail}</p>

        {error && <ErrorNote message={error} />}
        {info && (
          <div role="status" className="mb-4 rounded-r-lg border-l-4 border-emerald-600 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
            {info}
          </div>
        )}

        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <div>
            <label htmlFor="signup-code" className={labelClass}>
              Código de confirmação
            </label>
            <input
              id="signup-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full h-14 text-center tracking-[0.45em] font-mono text-2xl font-bold rounded-lg bg-white border border-[#0b0f19]/20 text-[#0b0f19] placeholder:text-[#0b0f19]/25 focus:outline-none focus:border-[#3044f0] focus:ring-4 focus:ring-[#3044f0]/15 transition"
            />
            <p className="text-xs text-[#0b0f19]/60 mt-2">O código vale por 15 minutos. Confira também a caixa de spam.</p>
          </div>

          <button type="submit" disabled={submitting || code.length !== 6} className={primaryButton}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Confirmando...' : 'Confirmar e entrar'}</span>
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <button type="button" onClick={backToForm} className="text-[#0b0f19]/70 hover:text-[#0b0f19] underline underline-offset-4">
            Voltar e corrigir o e-mail
          </button>
          <button type="button" onClick={handleResend} disabled={submitting} className={`${switchLink} disabled:opacity-50`}>
            Reenviar código
          </button>
        </div>
      </AuthShell>
    );
  }

  /* ---------- Criar conta ---------- */
  if (mode === 'signup') {
    return (
      <AuthShell heading="Bora estudar junto?" lead="Crie sua conta em um minuto, abra uma sala e chame a turma." onClose={close}>
        {error && <ErrorNote message={error} />}

        <form onSubmit={handleSignupSubmit} className="space-y-4">
          {/* Foto de perfil */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#0b0f19]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#3044f0] flex items-center justify-center font-bold text-white text-base">
                  {activeLetter}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold block">Foto de perfil (opcional)</span>
              <div className="flex items-center gap-3 mt-0.5">
                <button type="button" onClick={() => fileInputRef.current?.click()} title="Escolher foto" className={`text-xs ${switchLink}`}>
                  Carregar foto
                </button>
                {avatarUrl && (
                  <button type="button" onClick={handleRemovePhoto} className="text-xs font-medium text-rose-700 hover:underline">
                    Remover
                  </button>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="signup-fullname" className={labelClass}>
                Nome completo
              </label>
              <input
                id="signup-fullname"
                type="text"
                required
                maxLength={80}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Lucas Silva"
                className={inputFor('fullName')}
              />
            </div>
            <div>
              <label htmlFor="signup-nickname" className={labelClass}>
                Nickname
              </label>
              <input
                id="signup-nickname"
                type="text"
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.replace(/\s/g, ''))}
                placeholder="Ex: lucas"
                className={inputFor('nickname')}
              />
            </div>
            <p className="sm:col-span-2 -mt-2 text-xs text-[#0b0f19]/60">
              É o nome que aparece nas salas. Cada nickname é único: 3 a 20 caracteres, sem espaços.
            </p>
          </div>

          <div>
            <label htmlFor="signup-email" className={labelClass}>
              E-mail
            </label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="seu.email@exemplo.com"
              className={inputFor('email')}
            />
          </div>

          <div>
            <label htmlFor="signup-password" className={labelClass}>
              Senha
            </label>
            <PasswordInput
              id="signup-password"
              value={signupPassword}
              onChange={setSignupPassword}
              placeholder="Pelo menos 6 caracteres"
              autoComplete="new-password"
              minLength={6}
              invalid={errorField === 'password'}
            />
          </div>

          <button type="submit" disabled={submitting} className={`${primaryButton} mt-2`}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Criando conta...' : 'Criar conta'}</span>
          </button>
        </form>

        <p className="mt-5 text-sm text-[#0b0f19]/70">
          Já possui conta?{' '}
          <button type="button" onClick={() => switchMode('login')} className={switchLink}>
            Fazer login
          </button>
        </p>
      </AuthShell>
    );
  }

  /* ---------- Entrar ---------- */
  return (
    <AuthShell heading="Que bom te ver de novo!" lead="Entre com seu e-mail ou nickname e volte para a sua turma." onClose={close}>
      {error && <ErrorNote message={error} />}

      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-identifier" className={labelClass}>
            E-mail ou nickname
          </label>
          <input
            id="login-identifier"
            type="text"
            required
            autoFocus
            autoComplete="username"
            value={loginIdentifier}
            onChange={(e) => setLoginIdentifier(e.target.value)}
            placeholder="seu.email@exemplo.com"
            className={`${inputBase} ${inputOk}`}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="login-password" className={labelClass}>
              Senha
            </label>
            <button type="button" onClick={startForgot} className="mb-1.5 text-xs font-semibold text-[#3044f0] hover:text-[#0b0f19] underline underline-offset-4">
              Esqueceu a senha?
            </button>
          </div>
          <PasswordInput
            id="login-password"
            value={loginPassword}
            onChange={setLoginPassword}
            placeholder="Sua senha"
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={submitting} className={`${primaryButton} mt-2`}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{submitting ? 'Entrando...' : 'Entrar no Mesa'}</span>
        </button>
      </form>

      <p className="mt-5 text-sm text-[#0b0f19]/70">
        Não tem uma conta?{' '}
        <button type="button" onClick={() => switchMode('signup')} className={switchLink}>
          Criar conta
        </button>
      </p>
    </AuthShell>
  );
}
