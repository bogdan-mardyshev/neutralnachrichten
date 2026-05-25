import React, { useState } from 'react';
import { translations, Language } from '../translations';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (token: string, user: AuthUser) => void;
  initialMode?: 'login' | 'register';
  lang?: Language;
}

export interface AuthUser {
  id: number;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  daily_limit: number;
  email_verified?: boolean;
}

type Mode = 'login' | 'register' | 'forgot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ── Password strength checker ─────────────────────────────────────────────────
function pwChecks(pw: string) {
  return {
    len:   pw.length >= 8,
    num:   /\d/.test(pw),
    upper: /[A-Z]/.test(pw),
  };
}
function pwStrength(pw: string): number {
  const c = pwChecks(pw);
  return [c.len, c.num, c.upper].filter(Boolean).length;
}

// ── Google icon ───────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ── Check icon ────────────────────────────────────────────────────────────────
const Check = ({ ok }: { ok: boolean }) => (
  <span className={`inline-block w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
    ok ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-transparent'
  }`}>
    {ok && (
      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )}
  </span>
);

// ── Strength bar ──────────────────────────────────────────────────────────────
const StrengthBar = ({ score }: { score: number }) => {
  const colors = ['bg-rose-500', 'bg-orange-400', 'bg-emerald-500'];
  return (
    <div className="flex gap-1 mt-1.5">
      {[0, 1, 2].map(i => (
        <div key={i} className={`flex-1 h-1 transition-all duration-300 ${i < score ? colors[score - 1] : 'bg-[#e0d8cf]'}`} />
      ))}
    </div>
  );
};

export default function AuthModal({ onClose, onSuccess, initialMode = 'login', lang = 'de' }: AuthModalProps) {
  const t = translations[lang].auth;
  const [mode, setMode] = useState<Mode>(initialMode);

  // Login / Register fields
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // "Check your email" screen after registration
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Unverified email state (login blocked)
  const [unverifiedEmail,   setUnverifiedEmail]   = useState('');
  const [resendLoading,     setResendLoading]     = useState(false);
  const [resendSent,        setResendSent]        = useState(false);

  // Forgot password
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent,    setForgotSent]    = useState(false);
  const [forgotError,   setForgotError]   = useState('');

  // Password show/hide
  const [showPw, setShowPw] = useState(false);

  const checks  = pwChecks(password);
  const score   = pwStrength(password);
  const allPass = checks.len && checks.num && checks.upper;

  // ── Switch mode ─────────────────────────────────────────────────────────────
  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setUnverifiedEmail('');
    setResendSent(false);
    setForgotSent(false);
    setForgotError('');
  }

  // ── Login / Register submit ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setUnverifiedEmail('');

    if (mode === 'register' && !allPass) {
      setError(lang === 'de' ? 'Bitte alle Passwort-Anforderungen erfüllen.' :
               lang === 'ru' ? 'Выполните все требования к паролю.' :
               'Please meet all password requirements.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res  = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Special case: email not verified
        if (data.error === 'email_not_verified') {
          setUnverifiedEmail(data.email || email.trim());
          setError('__unverified__');
          return;
        }
        // Special case: account temporarily locked
        if (data.error === 'account_locked') {
          const min = data.minutesLeft ?? 30;
          setError(
            lang === 'de' ? `Konto gesperrt — noch ${min} Min. warten oder Passwort zurücksetzen.` :
            lang === 'ru' ? `Аккаунт заблокирован — подождите ${min} мин. или сбросьте пароль.` :
            `Account locked — wait ${min} min. or reset your password.`
          );
          return;
        }
        setError(data.error || t.errorNetwork);
        return;
      }

      // Registration: no JWT returned — show "check your email" screen
      if (mode === 'register' && data.ok && !data.token) {
        setRegisteredEmail(data.email || email.trim());
        return;
      }

      onSuccess(data.token, data.user);
    } catch {
      setError(t.errorNetwork);
    } finally {
      setLoading(false);
    }
  }

  // ── Resend verification ─────────────────────────────────────────────────────
  async function handleResend() {
    setResendLoading(true);
    try {
      // Use forgot-password flow to get a new verification — actually we need a
      // public resend endpoint. Use the dedicated one if token available, otherwise
      // call forgot-password as a workaround. Here we use a public resend endpoint.
      const res = await fetch(`${API_BASE}/api/auth/resend-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      if (res.ok) setResendSent(true);
      else setError(t.errorNetwork);
    } catch {
      setError(t.errorNetwork);
    } finally {
      setResendLoading(false);
    }
  }

  // ── Forgot password submit ──────────────────────────────────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      // Always show success — server never reveals if email exists
      setForgotSent(true);
    } catch {
      setForgotError(t.errorNetwork);
    } finally {
      setForgotLoading(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = `${API_BASE}/api/auth/google`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1a1a1a]/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#FFF8F0] border-2 border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]">

        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/60 mb-0.5">{t.brand}</p>
            <h2 className="font-serif font-black text-xl text-[#FFF8F0]">
              {mode === 'login' ? t.login : mode === 'register' ? t.register : t.forgotTitle}
            </h2>
          </div>
          <button onClick={onClose} className="text-[#FFF8F0]/60 hover:text-[#FFF8F0] transition-colors text-2xl leading-none">×</button>
        </div>

        {/* Spectrum bar */}
        <div className="h-1 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>

        {/* ── CONTENT: three possible screens ── */}
        {registeredEmail ? (

          /* ── 1. REGISTERED — CHECK EMAIL ── */
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-[#1a1a1a] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="font-serif font-black text-xl text-[#1a1a1a] mb-2">
              {lang === 'de' ? 'E-Mail bestätigen' : lang === 'ru' ? 'Подтвердите почту' : 'Confirm your email'}
            </h3>
            <p className="font-sans text-sm text-gray-500 mb-1">
              {lang === 'de' ? 'Wir haben einen Bestätigungslink gesendet an:' :
               lang === 'ru' ? 'Мы отправили ссылку для подтверждения на:' :
               'We sent a confirmation link to:'}
            </p>
            <p className="font-serif font-bold text-[#1a1a1a] mb-5 break-all">{registeredEmail}</p>
            <p className="font-sans text-[11px] text-gray-400 mb-6">
              {lang === 'de' ? 'Klicke auf den Link in der E-Mail, um dein Konto zu aktivieren. Danach kannst du dich anmelden.' :
               lang === 'ru' ? 'Нажмите на ссылку в письме, чтобы активировать аккаунт. После этого вы сможете войти.' :
               'Click the link in the email to activate your account. You can then log in.'}
            </p>
            <div className="h-px bg-[#e0d8cf] mb-5" />
            <p className="font-sans text-[11px] text-gray-400 mb-3">
              {lang === 'de' ? 'Keine E-Mail erhalten?' : lang === 'ru' ? 'Не получили письмо?' : "Didn't receive an email?"}
            </p>
            <button
              onClick={async () => {
                await fetch(`${API_BASE}/api/auth/resend-public`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: registeredEmail }),
                });
                setResendSent(true);
              }}
              disabled={resendSent}
              className="font-sans text-[10px] uppercase tracking-widest text-gray-500 underline hover:no-underline hover:text-[#1a1a1a] transition-colors disabled:opacity-50"
            >
              {resendSent
                ? (lang === 'de' ? '✓ Gesendet' : lang === 'ru' ? '✓ Отправлено' : '✓ Sent')
                : (lang === 'de' ? 'Erneut senden' : lang === 'ru' ? 'Отправить повторно' : 'Resend email')}
            </button>
          </div>

        ) : mode === 'forgot' ? (

          /* ── 2. FORGOT PASSWORD ── */
          <div className="p-6 space-y-4">
            {forgotSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-serif font-bold text-[#1a1a1a] mb-1">{t.forgotSent}</p>
                <p className="font-sans text-[11px] text-gray-400 mb-5">{forgotEmail}</p>
                <button onClick={() => switchMode('login')} className="font-sans text-[10px] uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] transition-colors">
                  {t.backToLogin}
                </button>
              </div>
            ) : (
              <>
                <p className="font-sans text-sm text-gray-500">{t.forgotDesc}</p>
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60 mb-1">{t.email}</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="name@beispiel.de"
                      className="w-full border-2 border-[#1a1a1a] bg-white px-3 py-2.5 font-serif text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:ring-offset-1"
                    />
                  </div>
                  {forgotError && <div className="border border-rose-400 bg-rose-50 px-3 py-2 font-serif text-sm text-rose-700">{forgotError}</div>}
                  <button type="submit" disabled={forgotLoading} className="w-full bg-[#1a1a1a] text-[#FFF8F0] py-3 font-sans text-xs uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-50">
                    {forgotLoading ? t.loading : t.forgotSubmit}
                  </button>
                </form>
                <div className="text-center">
                  <button onClick={() => switchMode('login')} className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors">
                    {t.backToLogin}
                  </button>
                </div>
              </>
            )}
          </div>

        ) : (

          /* ── 3. LOGIN / REGISTER ── */
          <>
            <div className="flex border-b-2 border-[#1a1a1a]">
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 font-sans text-xs uppercase tracking-widest transition-colors ${
                    mode === m ? 'bg-[#1a1a1a] text-[#FFF8F0]' : 'text-[#1a1a1a]/60 hover:text-[#1a1a1a] hover:bg-[#e8e0d5]'
                  }`}
                >
                  {m === 'login' ? t.login : t.register}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-4">
              {/* Google OAuth */}
              <button onClick={handleGoogleLogin} type="button"
                className="w-full flex items-center justify-center gap-3 border-2 border-[#1a1a1a] py-2.5 font-sans text-xs uppercase tracking-widest hover:bg-[#e8e0d5] transition-colors"
              >
                <GoogleIcon />
                {t.googleBtn}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#e0d8cf]" />
                <span className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/40">{t.orDivider}</span>
                <div className="flex-1 h-px bg-[#e0d8cf]" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60 mb-1">{t.email}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                    placeholder="name@beispiel.de"
                    className="w-full border-2 border-[#1a1a1a] bg-white px-3 py-2.5 font-serif text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:ring-offset-1"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60">
                      {t.password}
                      {mode === 'register' && <span className="ml-1 text-[#1a1a1a]/40 normal-case tracking-normal">{t.passwordMin}</span>}
                    </label>
                    {mode === 'login' && (
                      <button type="button" onClick={() => switchMode('forgot')}
                        className="font-sans text-[10px] text-gray-400 hover:text-[#1a1a1a] transition-colors underline"
                      >
                        {t.forgotPassword}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••"
                      className="w-full border-2 border-[#1a1a1a] bg-white px-3 py-2.5 pr-10 font-serif text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:ring-offset-1"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1a1a1a] transition-colors"
                    >
                      {showPw ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Strength + checklist (register only) */}
                  {mode === 'register' && password.length > 0 && (
                    <div className="mt-2">
                      <StrengthBar score={score} />
                      <div className="mt-2 space-y-1">
                        <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-1">{t.pwReq}</p>
                        {([
                          { ok: checks.len,   label: t.pwLen },
                          { ok: checks.num,   label: t.pwNum },
                          { ok: checks.upper, label: t.pwUpper },
                        ] as { ok: boolean; label: string }[]).map(({ ok, label }) => (
                          <div key={label} className="flex items-center gap-2">
                            <Check ok={ok} />
                            <span className={`font-sans text-[11px] transition-colors ${ok ? 'text-emerald-700' : 'text-gray-400'}`}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && error !== '__unverified__' && (
                  <div className="border border-rose-400 bg-rose-50 px-3 py-2 font-serif text-sm text-rose-700">{error}</div>
                )}

                {error === '__unverified__' && (
                  <div className="border border-amber-400 bg-amber-50 px-3 py-3 space-y-2">
                    <p className="font-serif text-sm text-amber-800">{t.notVerifiedError}</p>
                    {resendSent ? (
                      <p className="font-sans text-[11px] text-emerald-700 font-bold">{t.notVerifiedSent}</p>
                    ) : (
                      <button type="button" onClick={handleResend} disabled={resendLoading}
                        className="font-sans text-[11px] uppercase tracking-widest text-amber-800 underline hover:no-underline disabled:opacity-50"
                      >
                        {resendLoading ? t.loading : t.notVerifiedResend}
                      </button>
                    )}
                  </div>
                )}

                <button type="submit" disabled={loading || (mode === 'register' && !allPass)}
                  className="w-full bg-[#1a1a1a] text-[#FFF8F0] py-3 font-sans text-xs uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t.loading : mode === 'login' ? t.submitLogin : t.submitRegister}
                </button>
              </form>

              {mode === 'register' && (
                <div className="border-t border-[#e0d8cf] pt-4">
                  <p className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 mb-2">{t.benefitsTitle}</p>
                  <ul className="space-y-1">
                    {t.benefits.map((item: string) => (
                      <li key={item} className="font-serif text-sm text-[#1a1a1a]/70 flex items-start gap-2">
                        <span className="text-[#1a1a1a]/40 mt-0.5">→</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-center font-serif text-sm text-[#1a1a1a]/60">
                {mode === 'login' ? t.switchToRegister : t.switchToLogin}{' '}
                <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  className="text-[#1a1a1a] underline hover:no-underline"
                >
                  {mode === 'login' ? t.linkRegister : t.linkLogin}
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
