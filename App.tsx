import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import * as Sentry from "@sentry/react";
import posthog from 'posthog-js';

import { SearchBar } from './components/SearchBar';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { CookieBanner } from './components/CookieBanner';
import { LegalPage } from './components/LegalPages';

import { analyzeTopic } from './services/geminiService';
import { NewsAnalysisResult, FetchStatus } from './types';
import { translations, Language } from './translations';

// Initialize Sentry
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN });
}

function MainApp() {
  const [lang, setLang] = useState<Language>('de');
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [data, setData] = useState<NewsAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  const t = translations[lang];

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowCookieBanner(true);
    } else if (consent === 'accepted') {
      initPostHog();
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'loading') {
      setLoadingStage(0);
      interval = setInterval(() => {
        setLoadingStage((prev) => (prev < t.loadingStages.length - 1 ? prev + 1 : prev));
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [status, t.loadingStages.length]);

  const initPostHog = () => {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    const host = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
    if (key && !posthog.isFeatureEnabled('any')) {
      posthog.init(key, { api_host: host });
    }
  };

  const handleAcceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowCookieBanner(false);
    initPostHog();
    posthog.capture('cookie_consent_accepted');
  };

  const handleEssentialCookies = () => {
    localStorage.setItem('cookie-consent', 'essential');
    setShowCookieBanner(false);
  };

  const handleSearch = async (query: string) => {
    setStatus('loading');
    setError(null);
    setData(null);
    
    const startTime = Date.now();
    posthog.capture('analysis_started', { topic: query, lang });

    try {
      const result = await analyzeTopic(query, lang);
      setData(result);
      setStatus('success');
      posthog.capture('analysis_completed', { 
        topic: query, 
        duration: Date.now() - startTime 
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || t.errorDefault);
      setStatus('error');
      posthog.capture('analysis_failed', { topic: query, error: err.message });
      Sentry.captureException(err);
    }
  };

  const handleLanguageSwitch = (newLang: Language) => {
    const oldLang = lang;
    setLang(newLang);
    posthog.capture('language_switched', { from: oldLang, to: newLang });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white font-serif font-bold text-xl">
              {t.title.charAt(0)}
            </div>
            <span className="font-serif font-bold text-xl tracking-tight text-slate-900">
              {t.title}
            </span>
          </Link>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(['de', 'en', 'ru'] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLanguageSwitch(l)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <Routes>
          <Route path="/" element={
            <>
              {status === 'idle' && (
                <div className="text-center mb-10">
                  <h1 className="serif text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                    {t.subtitle}
                  </h1>
                  <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                    {t.description}
                  </p>
                </div>
              )}

              <SearchBar onSearch={handleSearch} status={status} lang={lang} />

              {status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-600 font-medium">{t.loadingStages[loadingStage]}</p>
                  <p className="text-slate-400 text-sm mt-2">{t.loadingSubtext}</p>
                </div>
              )}

              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg text-center max-w-2xl mx-auto">
                  <p className="font-bold mb-1">{t.errorTitle}</p>
                  <p>{error}</p>
                </div>
              )}

              {status === 'success' && data && (
                <AnalysisDashboard data={data} lang={lang} />
              )}
            </>
          } />
          <Route path="/imprint" element={<LegalPage lang={lang} type="imprint" />} />
          <Route path="/privacy" element={<LegalPage lang={lang} type="privacy" />} />
          <Route path="/terms" element={<LegalPage lang={lang} type="terms" />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} {t.footerText}</p>
            <div className="flex gap-6">
              <Link to="/imprint" className="hover:text-slate-600">{t.imprint}</Link>
              <Link to="/privacy" className="hover:text-slate-600">{t.privacy}</Link>
              <Link to="/terms" className="hover:text-slate-600">{t.terms}</Link>
            </div>
          </div>
        </div>
      </footer>

      {showCookieBanner && (
        <CookieBanner 
          lang={lang} 
          onAccept={handleAcceptCookies} 
          onEssential={handleEssentialCookies} 
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <MainApp />
    </Router>
  );
}

export default App;
