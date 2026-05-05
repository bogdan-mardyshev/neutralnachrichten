import React, { useState } from 'react';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (token: string, user: AuthUser) => void;
  initialMode?: 'login' | 'register';
}

export interface AuthUser {
  id: number;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  daily_limit: number;
}

type Mode = 'login' | 'register';

export default function AuthModal({ onClose, onSuccess, initialMode = 'login' }: AuthModalProps) {
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

      if (!res.ok) {
        setError(data.error || 'Fehler aufgetreten');
        return;
      }

      onSuccess(data.token, data.user);
    } catch (err) {
      setError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#1a1a1a]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#FFF8F0] border-2 border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]">
        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/60 mb-0.5">
              NeutralNachrichten
            </p>
            <h2 className="font-serif font-black text-xl text-[#FFF8F0]">
              {mode === 'login' ? 'Anmelden' : 'Registrieren'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#FFF8F0]/60 hover:text-[#FFF8F0] transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Spectrum bar */}
        <div className="h-1 flex">
          <div className="flex-1 bg-rose-600" />
          <div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" />
          <div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>

        {/* Mode switcher */}
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
              {m === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60 mb-1">
              E-Mail
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
              Passwort {mode === 'register' && <span className="text-[#1a1a1a]/40">(min. 8 Zeichen)</span>}
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
            {loading
              ? 'Bitte warten…'
              : mode === 'login' ? 'Anmelden' : 'Konto erstellen'
            }
          </button>

          {/* Benefits note for register */}
          {mode === 'register' && (
            <div className="border-t border-[#e0d8cf] pt-4">
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 mb-2">
                Vorteile eines Kontos
              </p>
              <ul className="space-y-1">
                {[
                  'Suchverlauf über Geräte hinweg',
                  'Höheres tägliches Limit',
                  'Früher Zugang zu neuen Funktionen',
                ].map(item => (
                  <li key={item} className="font-serif text-sm text-[#1a1a1a]/70 flex items-start gap-2">
                    <span className="text-[#1a1a1a]/40 mt-0.5">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Switch mode link */}
          <p className="text-center font-serif text-sm text-[#1a1a1a]/60">
            {mode === 'login' ? 'Noch kein Konto?' : 'Bereits registriert?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-[#1a1a1a] underline hover:no-underline"
            >
              {mode === 'login' ? 'Jetzt registrieren' : 'Anmelden'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
