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
}

type Mode = 'login' | 'register';

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function AuthModal({ onClose, onSuccess, initialMode = 'login', lang = 'de' }: AuthModalProps) {
  const t = translations[lang].auth;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL || '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || t.errorNetwork); return; }
      onSuccess(data.token, data.user);
    } catch {
      setError(t.errorNetwork);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    // Redirect to Google OAuth — server returns JWT via /?auth_token=...
    window.location.href = `${API_BASE}/api/auth/google`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1a1a1a]/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#FFF8F0] border-2 border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]">

        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/60 mb-0.5">
              {t.brand}
            </p>
            <h2 className="font-serif font-black text-xl text-[#FFF8F0]">
              {mode === 'login' ? t.login : t.register}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#FFF8F0]/60 hover:text-[#FFF8F0] transition-colors text-2xl leading-none"
          >×</button>
        </div>

        {/* Spectrum bar */}
        <div className="h-1 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>

        {/* Mode tabs */}
        <div className="flex border-b-2 border-[#1a1a1a]">
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 font-sans text-xs uppercase tracking-widest transition-colors ${
                mode === m
                  ? 'bg-[#1a1a1a] text-[#FFF8F0]'
                  : 'text-[#1a1a1a]/60 hover:text-[#1a1a1a] hover:bg-[#e8e0d5]'
              }`}
            >
              {m === 'login' ? t.login : t.register}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            type="button"
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

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60 mb-1">
                {t.email}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@beispiel.de"
                className="w-full border-2 border-[#1a1a1a] bg-white px-3 py-2.5 font-serif text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:ring-offset-1"
              />
            </div>

            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60 mb-1">
                {t.password}{' '}
                {mode === 'register' && <span className="text-[#1a1a1a]/40">{t.passwordMin}</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className="w-full border-2 border-[#1a1a1a] bg-white px-3 py-2.5 font-serif text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:ring-offset-1"
              />
            </div>

            {error && (
              <div className="border border-rose-400 bg-rose-50 px-3 py-2 font-serif text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a1a1a] text-[#FFF8F0] py-3 font-sans text-xs uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t.loading : mode === 'login' ? t.submitLogin : t.submitRegister}
            </button>
          </form>

          {/* Benefits (register only) */}
          {mode === 'register' && (
            <div className="border-t border-[#e0d8cf] pt-4">
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 mb-2">
                {t.benefitsTitle}
              </p>
              <ul className="space-y-1">
                {t.benefits.map((item: string) => (
                  <li key={item} className="font-serif text-sm text-[#1a1a1a]/70 flex items-start gap-2">
                    <span className="text-[#1a1a1a]/40 mt-0.5">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Switch mode */}
          <p className="text-center font-serif text-sm text-[#1a1a1a]/60">
            {mode === 'login' ? t.switchToRegister : t.switchToLogin}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-[#1a1a1a] underline hover:no-underline"
            >
              {mode === 'login' ? t.linkRegister : t.linkLogin}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
