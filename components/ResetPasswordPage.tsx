import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthUser } from './AuthModal';

interface Props {
  onAuthSuccess: (token: string, user: AuthUser) => void;
}

export default function ResetPasswordPage({ onAuthSuccess }: Props) {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token') || '';

  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] dark:bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
        <p className="font-sans text-sm text-rose-600">Kein Reset-Token gefunden.</p>
        <Link to="/" className="mt-4 font-sans text-[11px] uppercase tracking-widest text-gray-500 underline">Zurück</Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== password2) { setError('Die Passwörter stimmen nicht überein.'); return; }
    if (password.length < 8)    { setError('Passwort muss mindestens 8 Zeichen lang sein.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fehler beim Zurücksetzen.'); return; }
      setDone(true);
      if (data.token && data.user) {
        onAuthSuccess(data.token, data.user);
        setTimeout(() => navigate('/profile'), 1500);
      }
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] dark:bg-[#0a0a0a] flex flex-col">
      <div className="h-[3px] flex">
        <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
        <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
        <div className="flex-1 bg-blue-700" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <Link to="/" className="font-serif font-black text-2xl tracking-tight text-[#1a1a1a] dark:text-[#f0ece4] mb-12 hover:opacity-70 transition-opacity">
          NeutralNachrichten
        </Link>

        <div className="w-full max-w-sm border-2 border-[#1a1a1a] dark:border-[#2d2d2d] bg-[#FFF8F0] dark:bg-[#141414] p-8">
          {done ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-600 flex items-center justify-center mx-auto mb-5">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-serif font-black text-xl text-[#1a1a1a] dark:text-[#f0ece4] mb-2">Passwort gesetzt</h1>
              <p className="font-sans text-[12px] text-gray-500 dark:text-gray-400">Du wirst weitergeleitet…</p>
            </div>
          ) : (
            <>
              <h1 className="font-serif font-black text-xl text-[#1a1a1a] dark:text-[#f0ece4] mb-1">Neues Passwort</h1>
              <p className="font-sans text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Passwort zurücksetzen</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Neues Passwort</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Mindestens 8 Zeichen"
                    className="w-full border-b-2 border-[#1a1a1a] dark:border-[#2d2d2d] bg-transparent py-2 font-sans text-sm text-[#1a1a1a] dark:text-[#f0ece4] focus:outline-none focus:border-rose-500 dark:focus:border-rose-500 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Passwort wiederholen</label>
                  <input
                    type="password"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    required
                    placeholder="Gleich wie oben"
                    className="w-full border-b-2 border-[#1a1a1a] dark:border-[#2d2d2d] bg-transparent py-2 font-sans text-sm text-[#1a1a1a] dark:text-[#f0ece4] focus:outline-none focus:border-rose-500 dark:focus:border-rose-500 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  />
                </div>

                {error && (
                  <p className="font-sans text-[11px] text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] font-sans text-[10px] uppercase tracking-widest py-3 mt-2 hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {loading ? 'Wird gesetzt…' : 'Passwort speichern'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
