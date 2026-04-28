import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useSearchParams } from 'react-router-dom';
import * as Sentry from "@sentry/react";
import posthog from 'posthog-js';

import { SearchBar } from './components/SearchBar';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { TrendingTopics } from './components/TrendingTopics';
import { SearchHistory } from './components/SearchHistory';
import { useSearchHistory } from './hooks/useSearchHistory';
import { CookieBanner } from './components/CookieBanner';
import { LegalPage } from './components/LegalPages';
import { AboutPage } from './components/AboutPage';
import { MethodologyPage } from './components/MethodologyPage';
import { SuggestPage } from './components/SuggestPage';

import { analyzeTopic } from './services/geminiService';
import { NewsAnalysisResult, FetchStatus } from './types';
import { translations, Language } from './translations';

// Initialize Sentry
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN && SENTRY_DSN.startsWith('https') && !SENTRY_DSN.includes('your_sentry_dsn')) {
  Sentry.init({ dsn: SENTRY_DSN });
}

function MainApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lang, setLang] = useState<Language>(() => {
    const p = searchParams.get('lang');
    return (p === 'en' || p === 'ru' || p === 'de') ? p : 'de';
  });
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [data, setData] = useState<NewsAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [stageVisible, setStageVisible] = useState(true);

  const t = translations[lang];
  const { history, addToHistory, clearHistory } = useSearchHistory();

  // Auto-trigger analysis from shared URL (?topic=...&lang=...)
  useEffect(() => {
    const topicParam = searchParams.get('topic');
    if (topicParam) {
      handleSearch(topicParam, lang);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowCookieBanner(true);
    } else if (consent === 'accepted') {
      initPostHog();
    }
  }, []);

  useEffect(() => {
    if (status !== 'loading') return;

    setLoadingStage(0);
    setLoadingProgress(0);
    setStageVisible(true);

    const STAGE_DURATION = 3500;
    const TOTAL_EXPECTED_MS = 35000;

    // Cycle through stages with fade transition
    const stageInterval = setInterval(() => {
      setStageVisible(false);
      setTimeout(() => {
        setLoadingStage(prev => Math.min(prev + 1, t.loadingStages.length - 1));
        setStageVisible(true);
      }, 300);
    }, STAGE_DURATION);

    // Smooth progress bar (never reaches 100% until done)
    const start = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / TOTAL_EXPECTED_MS) * 95, 95);
      setLoadingProgress(pct);
    }, 200);

    return () => {
      clearInterval(stageInterval);
      clearInterval(progressInterval);
    };
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

  const handleSearch = async (query: string, overrideLang?: Language) => {
    const activeLang = overrideLang ?? lang;
    setStatus('loading');
    setError(null);
    setData(null);

    const startTime = Date.now();
    posthog.capture('analysis_started', { topic: query, lang: activeLang });

    try {
      const result = await analyzeTopic(query, activeLang);
      setData(result);
      setLastQuery(query);
      setStatus('success');
      setSearchParams({ topic: query, lang: activeLang }, { replace: true });
      addToHistory(query, activeLang);
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
    if (lastQuery && status === 'success') {
      handleSearch(lastQuery, newLang);
    }
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
                  <h1 className="serif text-3xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
                    {t.subtitle}
                  </h1>
                  <p className="text-xl text-gray-500 mb-2">{t.description}</p>
                  <p className="text-sm text-gray-400 tracking-wide">{t.heroSub}</p>
                </div>
              )}

              <SearchBar onSearch={handleSearch} status={status} lang={lang} />

              <SearchHistory
                history={history}
                onSelect={(topic) => handleSearch(topic)}
                onClear={clearHistory}
                lang={lang}
              />

              {status === 'idle' && (
                <TrendingTopics lang={lang} onSelect={(topic) => handleSearch(topic)} />
              )}

              {status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-20 max-w-sm mx-auto w-full">
                  {/* Spinner */}
                  <div className="w-14 h-14 mb-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>

                  {/* Stage text with fade */}
                  <div className="h-7 mb-6 flex items-center justify-center">
                    <p
                      className="text-slate-700 font-medium text-center transition-opacity duration-300"
                      style={{ opacity: stageVisible ? 1 : 0 }}
                    >
                      {t.loadingStages[loadingStage]}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div
                      className="bg-slate-900 h-1.5 rounded-full transition-all duration-200 ease-out"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>

                  {/* Step dots */}
                  <div className="flex gap-1.5">
                    {t.loadingStages.map((_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: i === loadingStage ? '20px' : '6px',
                          height: '6px',
                          backgroundColor: i <= loadingStage ? '#0f172a' : '#e2e8f0',
                        }}
                      />
                    ))}
                  </div>
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
          <Route path="/about" element={<AboutPage lang={lang} />} />
          <Route path="/methodology" element={<MethodologyPage lang={lang} />} />
          <Route path="/suggest" element={<SuggestPage lang={lang} />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col gap-4 text-sm text-gray-400">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link to="/about" className="hover:text-slate-600">{t.nav.about}</Link>
              <Link to="/methodology" className="hover:text-slate-600">{t.nav.methodology}</Link>
              <Link to="/suggest" className="hover:text-slate-600">{t.nav.suggest}</Link>
              <span className="text-gray-200">·</span>
              <Link to="/imprint" className="hover:text-slate-600">{t.imprint}</Link>
              <Link to="/privacy" className="hover:text-slate-600">{t.privacy}</Link>
              <Link to="/terms" className="hover:text-slate-600">{t.terms}</Link>
            </div>
            <p className="text-center text-xs text-gray-300">
              &copy; {new Date().getFullYear()} {t.footerText}
            </p>
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
