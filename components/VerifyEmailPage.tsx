import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus]   = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); setMessage('Kein Token gefunden.'); return; }

    fetch(`${import.meta.env.VITE_API_BASE || ''}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          // Auto-login: store JWT and user, then redirect home
          if (data.token && data.user) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('authUser', JSON.stringify(data.user));
          }
          setStatus('success');
          setMessage(data.message || 'E-Mail bestätigt!');
          setTimeout(() => navigate('/'), 1500);
        } else {
          setStatus('error');
          setMessage(data.error || 'Ungültiger Link.');
        }
      })
      .catch(() => { setStatus('error'); setMessage('Verbindungsfehler. Bitte versuche es erneut.'); });
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col">
      {/* Header strip */}
      <div className="h-[3px] flex">
        <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
        <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
        <div className="flex-1 bg-blue-700" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <Link to="/" className="font-serif font-black text-2xl tracking-tight text-[#1a1a1a] mb-12 hover:opacity-70 transition-opacity">
          NeutralNachrichten
        </Link>

        <div className="w-full max-w-sm border-2 border-[#1a1a1a] bg-[#FFF8F0] p-8">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />
              <p className="font-sans text-[11px] uppercase tracking-widest text-gray-500">Wird überprüft…</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-600 flex items-center justify-center mx-auto mb-5">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-serif font-black text-xl text-[#1a1a1a] mb-2">E-Mail bestätigt</h1>
              <p className="font-sans text-[12px] text-gray-500 mb-6">{message}</p>
              <Link
                to="/"
                className="inline-block bg-[#1a1a1a] text-white font-sans text-[10px] uppercase tracking-widest px-6 py-3 hover:opacity-80 transition-opacity"
              >
                Zur Startseite
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-12 h-12 bg-rose-600 flex items-center justify-center mx-auto mb-5">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="font-serif font-black text-xl text-[#1a1a1a] mb-2">Link ungültig</h1>
              <p className="font-sans text-[12px] text-gray-500 mb-6">{message}</p>
              <Link
                to="/"
                className="inline-block bg-[#1a1a1a] text-white font-sans text-[10px] uppercase tracking-widest px-6 py-3 hover:opacity-80 transition-opacity"
              >
                Zurück
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
