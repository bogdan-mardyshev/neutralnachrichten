import React, { useState, useEffect, useRef } from 'react';
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
import { TopCharts } from './components/TopCharts';
import { ComparePage } from './components/ComparePage';
import { DailyNews } from './components/DailyNews';
import { CategoryBrowser } from './components/CategoryBrowser';
import { DesignPreview } from './components/DesignPreview';
import AuthModal, { AuthUser } from './components/AuthModal';
import AdminPage from './components/AdminPage';
import UserProfilePage from './components/UserProfilePage';

import { analyzeTopic, fetchDeepAnalysis } from './services/geminiService';
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
    if (p === 'en' || p === 'ru' || p === 'de') return p;
    const saved = localStorage.getItem('lang') as Language | null;
    return (saved === 'en' || saved === 'ru' || saved === 'de') ? saved : 'de';
  });
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [data, setData] = useState<NewsAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const DAILY_LIMIT = 10;
  const [loadingStage, setLoadingStage] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [stageVisible, setStageVisible] = useState(true);

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  // Auth state
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch { return null; }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const t = translations[lang];
  const { history, addToHistory, clearHistory } = useSearchHistory();

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  // Auto-trigger analysis from shared URL (?topic=...&lang=...)
  // Also handle Google OAuth callback (?auth_token=...)
  useEffect(() => {
    // Google OAuth: pick up token from URL and clear it
    const authTokenParam = searchParams.get('auth_token');
    if (authTokenParam) {
      try {
        // Decode payload to get user info (no verify needed — server already verified with Google)
        const payload = JSON.parse(atob(authTokenParam.split('.')[1]));
        const user: AuthUser = { id: payload.id, email: payload.email, tier: payload.tier ?? 'free', daily_limit: payload.daily_limit ?? 10 };
        handleAuthSuccess(authTokenParam, user);
      } catch { /* malformed token — ignore */ }
      setSearchParams({}, { replace: true });
      return;
    }

    const authErrorParam = searchParams.get('auth_error');
    if (authErrorParam) {
      setError(lang === 'de' ? 'Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.' : 'Google sign-in failed. Please try again.');
      setSearchParams({}, { replace: true });
      return;
    }

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

  const handleAuthSuccess = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
  };

  const handleSearch = async (query: string, overrideLang?: Language) => {
    const activeLang = overrideLang ?? lang;
    setStatus('loading');
    setError(null);
    setData(null);

    const startTime = Date.now();
    posthog.capture('analysis_started', { topic: query, lang: activeLang });

    try {
      const result = await analyzeTopic(query, activeLang, authToken ?? undefined);
      setData(result);
      setLastQuery(query);
      // Track daily remaining from server response
      if (typeof result._usage?.remaining === 'number') {
        setDailyRemaining(result._usage.remaining);
      }
      setStatus('success');
      setSearchParams({ topic: query, lang: activeLang }, { replace: true });
      addToHistory(query, activeLang);
      posthog.capture('analysis_completed', {
        topic: query,
        duration: Date.now() - startTime
      });

      // If main result has no deep_analysis and Gemini actually found content, fetch it in background
      if (!result.deep_analysis && !result._meta?.degraded) {
        setDeepLoading(true);
        fetchDeepAnalysis(query, activeLang).then((deep) => {
          setDeepLoading(false);
          if (deep) {
            setData(prev => prev ? { ...prev, deep_analysis: deep } : prev);
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      // Handle daily limit error
      if (err.status === 429 || err.message?.includes('daily_limit')) {
        setDailyRemaining(0);
        setError(lang === 'de'
          ? `Tageslimit erreicht. Du hast heute ${DAILY_LIMIT} Analysen genutzt. Das Limit wird um Mitternacht (UTC) zurückgesetzt.`
          : `Daily limit reached. You've used ${DAILY_LIMIT} analyses today. Resets at midnight UTC.`);
      } else {
        setError(err.message || t.errorDefault);
      }
      setStatus('error');
      posthog.capture('analysis_failed', { topic: query, error: err.message });
      Sentry.captureException(err);
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setData(null);
    setError(null);
    setDeepLoading(false);
    setLastQuery(null);
    setSearchParams({}, { replace: true });
  };

  const handleLanguageSwitch = (newLang: Language) => {
    const oldLang = lang;
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    posthog.capture('language_switched', { from: oldLang, to: newLang });
    if (lastQuery && status === 'success') {
      handleSearch(lastQuery, newLang);
    }
  };

  // Newspaper date string
  const dateStr = new Date().toLocaleDateString(
    lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-[#1a1a1a] flex flex-col font-serif">

      {/* Top info strip */}
      <div className="bg-[#1a1a1a] text-white text-center py-1.5 font-sans text-[10px] uppercase tracking-widest">
        {t.heroSub}
      </div>

      {/* Navbar */}
      <nav className="bg-[#FFF8F0] border-b-2 border-[#1a1a1a] sticky top-0 z-50" ref={menuRef}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

          {/* Left: hamburger (mobile) / date (desktop) */}
          <div className="flex items-center gap-3 w-28 sm:w-auto">
            {/* Hamburger — mobile only */}
            <button
              className="sm:hidden flex flex-col justify-center gap-[5px] w-6 h-6 shrink-0"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Menu"
            >
              <span className={`block h-0.5 bg-[#1a1a1a] transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block h-0.5 bg-[#1a1a1a] transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 bg-[#1a1a1a] transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
            {/* Date — desktop only */}
            <span className="font-sans text-[10px] uppercase tracking-widest text-gray-500 hidden sm:block">{dateStr}</span>
          </div>

          {/* Logo — centered */}
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="absolute left-1/2 -translate-x-1/2 font-serif font-black text-xl tracking-tight text-[#1a1a1a] whitespace-nowrap hover:opacity-80 transition-opacity">
            {t.title}
          </Link>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <Link
              to="/compare"
              className="hidden sm:block font-sans text-[10px] uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] transition-colors"
            >
              ⚖ {t.nav.compare}
            </Link>

            {/* Auth — desktop only */}
            {authUser ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link
                  to="/profile"
                  className="font-sans text-[10px] text-gray-500 hover:text-[#1a1a1a] transition-colors max-w-[100px] truncate"
                  title={authUser.email}
                >
                  {authUser.email.split('@')[0]}
                </Link>
                <button
                  onClick={handleLogout}
                  className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-rose-600 transition-colors leading-none"
                  title={t.auth.logoutBtn}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
                className="hidden sm:flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-widest bg-rose-600 text-white px-3 py-1.5 hover:bg-rose-700 transition-colors"
              >
                <span className="text-[9px]">↗</span>
                {t.auth.loginBtn}
              </button>
            )}

            {/* Language switcher — always visible */}
            <div className="flex gap-0 border border-[#1a1a1a]">
              {(['de', 'en', 'ru'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageSwitch(l)}
                  className={`px-2 sm:px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    lang === l ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:bg-[#1a1a1a] hover:text-white'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t-2 border-[#1a1a1a] bg-[#FFF8F0] px-4 py-4 space-y-0 divide-y divide-[#e0d8cf]">
            <div className="pb-3">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300 mb-2">{dateStr}</p>
            </div>
            {authUser ? (
              <div className="py-3 space-y-2">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {authUser.email.split('@')[0]}
                </Link>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="font-sans text-[10px] uppercase tracking-widest text-rose-600 pl-3.5"
                >
                  {t.auth.logoutBtn}
                </button>
              </div>
            ) : (
              <div className="py-3">
                <button
                  onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); setMobileMenuOpen(false); }}
                  className="w-full font-sans text-[10px] font-bold uppercase tracking-widest bg-rose-600 text-white px-4 py-3 hover:bg-rose-700 transition-colors"
                >
                  ↗ {t.auth.loginBtn}
                </button>
              </div>
            )}
            <div className="pt-3 space-y-2.5">
              {[
                { to: '/compare', label: `⚖ ${t.nav.compare}` },
                { to: '/about', label: t.nav.about },
                { to: '/methodology', label: t.nav.methodology },
                { to: '/suggest', label: t.nav.suggest },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block font-sans text-[10px] uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      {/* Spectrum gradient strip under nav */}
      <div className="h-[3px] flex">
        <div className="flex-1 bg-rose-600" />
        <div className="flex-1 bg-orange-400" />
        <div className="flex-1 bg-slate-400" />
        <div className="flex-1 bg-sky-500" />
        <div className="flex-1 bg-blue-700" />
      </div>

      {/* Main Content */}
      <main className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full">
        <Routes>
          <Route path="/" element={
            <>
              {status === 'idle' && (
                <div className="mb-10">
                  <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gray-400 mb-4">Medienanalyse</p>
                  <h1 className="font-serif font-black text-3xl sm:text-4xl md:text-5xl text-[#1a1a1a] leading-[1.05] mb-5">
                    {t.subtitle}
                  </h1>
                  {/* Spectrum accent rule */}
                  <div className="flex gap-0.5 mb-5">
                    <div className="w-6 h-[3px] bg-rose-600" />
                    <div className="w-6 h-[3px] bg-orange-400" />
                    <div className="w-6 h-[3px] bg-slate-400" />
                    <div className="w-6 h-[3px] bg-sky-500" />
                    <div className="w-6 h-[3px] bg-blue-700" />
                  </div>
                  <p className="font-sans text-gray-500 text-base">{t.description}</p>
                </div>
              )}

              {status === 'idle' ? (
                <div className="flex gap-6 items-start">
                  {/* Main column */}
                  <div className="flex-1 min-w-0">
                    <SearchBar onSearch={handleSearch} status={status} lang={lang} />

                    {/* Daily usage indicator */}
                    {dailyRemaining !== null && (
                      <div className={`mt-2 flex items-center gap-2 px-1 ${dailyRemaining === 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        <div className="flex gap-0.5">
                          {Array.from({ length: DAILY_LIMIT }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2.5 h-1.5 ${i < (DAILY_LIMIT - dailyRemaining) ? 'bg-[#1a1a1a]' : 'bg-[#e0d8cf]'}`}
                            />
                          ))}
                        </div>
                        <span className="font-sans text-[9px] uppercase tracking-widest">
                          {dailyRemaining === 0
                            ? (lang === 'de' ? 'Tageslimit erreicht — Reset um Mitternacht UTC' : 'Daily limit reached — resets midnight UTC')
                            : (lang === 'de' ? `${dailyRemaining} von ${DAILY_LIMIT} Analysen heute verbleibend` : `${dailyRemaining} of ${DAILY_LIMIT} analyses remaining today`)}
                        </span>
                      </div>
                    )}

                    <SearchHistory
                      history={history}
                      onSelect={(topic) => handleSearch(topic)}
                      onClear={clearHistory}
                      lang={lang}
                    />
                    <CategoryBrowser lang={lang} onSelect={(topic) => handleSearch(topic)} />
                    <TrendingTopics lang={lang} onSelect={(topic) => handleSearch(topic)} />
                    <TopCharts lang={lang} onSelect={(topic) => handleSearch(topic)} />
                  </div>

                  {/* Sidebar */}
                  <div className="hidden lg:block w-72 shrink-0 sticky top-24">
                    <DailyNews lang={lang} onSelect={(topic) => handleSearch(topic)} />
                  </div>
                </div>
              ) : (
                <>
                  <SearchBar onSearch={handleSearch} status={status} lang={lang} />
                  <SearchHistory
                    history={history}
                    onSelect={(topic) => handleSearch(topic)}
                    onClear={clearHistory}
                    lang={lang}
                  />
                </>
              )}

              {status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-20 max-w-sm mx-auto w-full">
                  {/* Newspaper-style spinner */}
                  <div className="w-12 h-12 mb-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />

                  {/* Stage text */}
                  <div className="h-7 mb-6 flex items-center justify-center">
                    <p
                      className="font-sans text-[#1a1a1a] text-sm text-center transition-opacity duration-300"
                      style={{ opacity: stageVisible ? 1 : 0 }}
                    >
                      {t.loadingStages[loadingStage]}
                    </p>
                  </div>

                  {/* Progress bar — flat like a rule */}
                  <div className="w-full bg-[#e8e0d5] h-0.5 mb-4 overflow-hidden">
                    <div
                      className="bg-[#1a1a1a] h-0.5 transition-all duration-200 ease-out"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>

                  {/* Step dots */}
                  <div className="flex gap-1.5">
                    {t.loadingStages.map((_, i) => (
                      <div
                        key={i}
                        className="transition-all duration-300"
                        style={{
                          width: i === loadingStage ? '20px' : '6px',
                          height: '3px',
                          backgroundColor: i <= loadingStage ? '#1a1a1a' : '#d5ccbf',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div className="border-l-4 border-red-700 bg-red-50 px-6 py-4 max-w-2xl mx-auto">
                  <p className="font-serif font-bold text-red-800 mb-1">{t.errorTitle}</p>
                  <p className="font-sans text-sm text-red-600">{error}</p>
                </div>
              )}

              {status === 'success' && data && (
                <>
                  <div className="mb-6">
                    <button
                      onClick={handleReset}
                      className="font-sans text-[10px] uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] transition-colors flex items-center gap-2"
                    >
                      ← {t.backToHome}
                    </button>
                  </div>
                  <AnalysisDashboard data={data} lang={lang} deepLoading={deepLoading} />
                </>
              )}
            </>
          } />
          <Route path="/imprint" element={<LegalPage lang={lang} type="imprint" />} />
          <Route path="/privacy" element={<LegalPage lang={lang} type="privacy" />} />
          <Route path="/terms" element={<LegalPage lang={lang} type="terms" />} />
          <Route path="/about" element={<AboutPage lang={lang} />} />
          <Route path="/methodology" element={<MethodologyPage lang={lang} />} />
          <Route path="/suggest" element={<SuggestPage lang={lang} />} />
          <Route path="/compare" element={<ComparePage lang={lang} />} />
          <Route path="/preview" element={<DesignPreview lang={lang} />} />
          <Route path="/profile" element={
            <UserProfilePage
              lang={lang}
              authToken={authToken}
              authUser={authUser}
              onLogout={handleLogout}
            />
          } />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#1a1a1a] bg-[#FFF8F0] py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-sans text-xs uppercase tracking-widest text-gray-500">
              <Link to="/about" className="hover:text-[#1a1a1a] transition-colors">{t.nav.about}</Link>
              <Link to="/methodology" className="hover:text-[#1a1a1a] transition-colors">{t.nav.methodology}</Link>
              <Link to="/compare" className="hover:text-[#1a1a1a] transition-colors">{t.nav.compare}</Link>
              <Link to="/suggest" className="hover:text-[#1a1a1a] transition-colors">{t.nav.suggest}</Link>
              <span className="text-gray-300">·</span>
              <Link to="/imprint" className="hover:text-[#1a1a1a] transition-colors">{t.imprint}</Link>
              <Link to="/privacy" className="hover:text-[#1a1a1a] transition-colors">{t.privacy}</Link>
              <Link to="/terms" className="hover:text-[#1a1a1a] transition-colors">{t.terms}</Link>
            </div>
            <div className="h-px bg-[#1a1a1a] opacity-10" />
            <p className="text-center font-sans text-[10px] uppercase tracking-widest text-gray-400">
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

      {showAuthModal && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          lang={lang}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;
