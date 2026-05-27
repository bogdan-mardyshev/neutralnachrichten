import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import * as Sentry from "@sentry/react";
import posthog from 'posthog-js';
import { Sun, Moon, Bookmark } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';

import { SearchBar } from './components/SearchBar';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { TrendingTopics } from './components/TrendingTopics';
import { SearchHistory } from './components/SearchHistory';
import { useSearchHistory } from './hooks/useSearchHistory';
import { CookieConsent, hasAnalyticsConsent, ConsentLevel } from './components/CookieConsent';
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
import { UsageBar } from './components/UsageBar';
import { PublicAnalyses } from './components/PublicAnalyses';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileAnalyzedSheet } from './components/MobileAnalyzedSheet';
import AdminPage from './components/AdminPage';
import UserProfilePage from './components/UserProfilePage';
import VerifyEmailPage from './components/VerifyEmailPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import { AnalysisPage } from './components/AnalysisPage';
import { OnboardingModal } from './components/OnboardingModal';

import { analyzeTopicStream, fetchDeepAnalysis } from './services/geminiService';
import { NewsAnalysisResult, FetchStatus } from './types';
import { translations, Language } from './translations';

// Initialize Sentry
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN && SENTRY_DSN.startsWith('https') && !SENTRY_DSN.includes('your_sentry_dsn')) {
  Sentry.init({ dsn: SENTRY_DSN });
}

// Russian is a dev/admin-only language — hidden in production for all non-admin users
const ADMIN_EMAIL = 'bogdan.mardyshev@gmail.com';
function canUseRussian(userEmail?: string | null): boolean {
  return userEmail === ADMIN_EMAIL;
}

function MainApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lang, setLang] = useState<Language>(() => {
    // Read saved user from localStorage to check admin status at init time
    const savedUserEmail: string | null = (() => {
      try { return JSON.parse(localStorage.getItem('authUser') || 'null')?.email ?? null; }
      catch { return null; }
    })();
    const adminUser = canUseRussian(savedUserEmail);
    const p = searchParams.get('lang');
    if (p === 'en' || p === 'de') return p;
    if (p === 'ru') return adminUser ? 'ru' : 'de';
    const saved = localStorage.getItem('lang') as Language | null;
    if (saved === 'en' || saved === 'de') return saved;
    if (saved === 'ru') return adminUser ? 'ru' : 'de';
    return 'de';
  });
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [data, setData] = useState<NewsAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cookie consent is handled by CookieConsent component itself via localStorage
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

  // Mobile bottom nav / sheet
  const [analyzedSheetOpen, setAnalyzedSheetOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Streaming: true while waiting for the AI result after RSS already shown
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // Abort any in-flight stream when the component unmounts
  useEffect(() => () => { streamCleanupRef.current?.(); }, []);

  const handleSearchTabPress = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => searchInputRef.current?.focus(), 300);
  }, []);

  // Auth state
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch { return null; }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Onboarding modal — show once for new visitors who are not logged in
  const [showOnboarding, setShowOnboarding] = useState(false);

  const t = translations[lang];
  const { history, addToHistory, clearHistory } = useSearchHistory();
  const { theme, toggleTheme } = useTheme();

  // Bookmark state
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const API_BASE = import.meta.env.VITE_API_BASE || '';

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
  // Also handle Google OAuth callback (?oauth_code=...)
  useEffect(() => {
    // Google OAuth: exchange one-time code for JWT — code is never the JWT itself
    const oauthCode = searchParams.get('oauth_code');
    if (oauthCode) {
      // Strip from URL immediately so it never sits in history
      setSearchParams({}, { replace: true });
      fetch('/api/auth/google/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCode }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok && data.token && data.user) {
            handleAuthSuccess(data.token, data.user as AuthUser);
          } else {
            setError(lang === 'de' ? 'Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.' : 'Google sign-in failed. Please try again.');
          }
        })
        .catch(() => {
          setError(lang === 'de' ? 'Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.' : 'Google sign-in failed. Please try again.');
        });
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
    // Initialize PostHog if analytics consent was already given
    if (hasAnalyticsConsent()) {
      initPostHog();
    }
  }, []);

  // Show onboarding modal once for new visitors (not logged in)
  useEffect(() => {
    if (authToken) return; // experienced/logged-in users skip onboarding
    if (localStorage.getItem('nn-onboarded')) return;
    const timer = setTimeout(() => setShowOnboarding(true), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch daily usage on mount so UsageBar shows immediately
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE || '';
    fetch(`${API_BASE}/api/usage`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.remaining != null) setDailyRemaining(d.remaining); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    // Only animate while waiting for the first RSS event (data is still null)
    if (status !== 'loading' || data !== null) return;

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
  }, [status, data, t.loadingStages.length]);

  const initPostHog = () => {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    const host = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
    if (key && !posthog.isFeatureEnabled('any')) {
      posthog.init(key, { api_host: host });
    }
  };

  const handleConsentChange = (level: ConsentLevel) => {
    if (level === 'analytics' || level === 'all') {
      initPostHog();
      posthog.capture('cookie_consent_given', { level });
    }
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

  const handleSearch = (query: string, overrideLang?: Language) => {
    const activeLang = overrideLang ?? lang;

    // Cancel any in-flight stream from a previous search
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;

    setStatus('loading');
    setError(null);
    setData(null);
    setAnalysisLoading(false);
    setLastQuery(query); // set early so language switch works during streaming

    const startTime = Date.now();
    posthog.capture('analysis_started', { topic: query, lang: activeLang });

    const cleanup = analyzeTopicStream(
      query,
      activeLang,
      authToken ?? undefined,
      (event) => {
        if (event.type === 'rss') {
          // Phase 1 (~2s): show real article links + coverage immediately
          setData(event.data as NewsAnalysisResult);
          setAnalysisLoading(true); // AI analysis still loading
          // Keep status='loading' so progress bar stays visible
        } else if (event.type === 'result') {
          // Phase 2 (~15-35s): full AI analysis ready
          setData(event.data);
          setAnalysisLoading(false);

          if (typeof event.data._usage?.remaining === 'number') {
            setDailyRemaining(event.data._usage.remaining);
          }
          setStatus('success');
          setSearchParams({ topic: query, lang: activeLang }, { replace: true });
          addToHistory(query, activeLang);
          // lastQuery already set at search start; no need to re-set here

          if (authToken && event.data.coverage_distribution) {
            fetch(`${import.meta.env.VITE_API_BASE || ''}/api/history`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ topic: query, lang: activeLang, coverage: event.data.coverage_distribution }),
            }).catch(() => {});
          }
          posthog.capture('analysis_completed', { topic: query, duration: Date.now() - startTime });

          if (!event.data.deep_analysis && !event.data._meta?.degraded) {
            setDeepLoading(true);
            fetchDeepAnalysis(query, activeLang).then((deep) => {
              setDeepLoading(false);
              if (deep) setData(prev => prev ? { ...prev, deep_analysis: deep } : prev);
            });
          }
        } else if (event.type === 'error') {
          setAnalysisLoading(false);
          if (event.status === 429 || event.message?.includes('daily_limit')) {
            setDailyRemaining(0);
            setError('');
          } else {
            setError(event.message || t.errorDefault);
          }
          setStatus('error');
          posthog.capture('analysis_failed', { topic: query, error: event.message });
          Sentry.captureException(new Error(event.message));
        }
      },
    );

    streamCleanupRef.current = cleanup;
  };

  const handleReset = () => {
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;
    setStatus('idle');
    setData(null);
    setError(null);
    setDeepLoading(false);
    setAnalysisLoading(false);
    setLastQuery(null);
    setIsSaved(false);
    setSearchParams({}, { replace: true });
  };

  // Check if current topic is saved (when analysis is shown)
  useEffect(() => {
    if (!lastQuery) { setIsSaved(false); return; }
    const norm = lastQuery.toLowerCase().trim();
    if (authToken) {
      // Check server
      fetch(`${API_BASE}/api/saved-topics`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.saved) setIsSaved(d.saved.some((s: { topic_norm: string }) => s.topic_norm === norm));
        })
        .catch(() => {});
    } else {
      // Check localStorage for guests
      try {
        const ls: string[] = JSON.parse(localStorage.getItem('nn-saved-topics') || '[]');
        setIsSaved(ls.includes(norm));
      } catch { setIsSaved(false); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastQuery, authToken]);

  const handleToggleSave = async () => {
    if (!lastQuery) return;
    const norm = lastQuery.toLowerCase().trim();

    if (!authToken) {
      // Guest: use localStorage, prompt login
      try {
        const ls: string[] = JSON.parse(localStorage.getItem('nn-saved-topics') || '[]');
        if (isSaved) {
          localStorage.setItem('nn-saved-topics', JSON.stringify(ls.filter(t => t !== norm)));
          setIsSaved(false);
        } else {
          localStorage.setItem('nn-saved-topics', JSON.stringify([...ls, norm]));
          setIsSaved(true);
        }
      } catch { /* ignore */ }
      return;
    }

    setSaveLoading(true);
    try {
      if (isSaved) {
        setIsSaved(false); // optimistic
        await fetch(`${API_BASE}/api/saved-topics/${encodeURIComponent(norm)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } else {
        setIsSaved(true); // optimistic
        await fetch(`${API_BASE}/api/saved-topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ topic: lastQuery, topicNorm: norm, lang }),
        });
      }
    } catch {
      setIsSaved(prev => !prev); // revert on error
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLanguageSwitch = (newLang: Language) => {
    if (newLang === 'ru' && !canUseRussian(authUser?.email)) return;
    const oldLang = lang;
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    posthog.capture('language_switched', { from: oldLang, to: newLang });
    // Re-search when a result is shown (success) OR when we're mid-stream (RSS data arrived)
    if (lastQuery && (status === 'success' || (status === 'loading' && data !== null))) {
      handleSearch(lastQuery, newLang);
    }
  };

  const handleOnboardingSelect = (topic: string) => {
    localStorage.setItem('nn-onboarded', '1');
    setShowOnboarding(false);
    handleSearch(topic);
  };

  const handleOnboardingDismiss = () => {
    localStorage.setItem('nn-onboarded', '1');
    setShowOnboarding(false);
  };

  // Newspaper date string
  const dateStr = new Date().toLocaleDateString(
    lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  // Dynamic Helmet meta based on analysis state
  const helmetTitle = lastQuery && (status === 'success' || (status === 'loading' && data))
    ? `${lastQuery} – Medienspektrum-Analyse | NeutralNachrichten`
    : 'NeutralNachrichten – KI-Analyse der deutschen Medien';
  const helmetDescription = lastQuery && (status === 'success' || (status === 'loading' && data))
    ? `Wie berichten deutsche Medien über "${lastQuery}"? KI-Analyse von taz, Spiegel, FAZ, Bild und 14 weiteren Quellen.`
    : 'Analysiere wie deutsche Medien über jedes Thema berichten. Echtzeit-Vergleich von 18 Quellen quer durch das politische Spektrum – links bis rechts.';

  return (
    <div className="min-h-screen bg-[#FFF8F0] dark:bg-[#0f0f0f] text-[#1a1a1a] dark:text-[#f0ece4] flex flex-col font-serif">

      <Helmet>
        <title>{helmetTitle}</title>
        <meta name="description" content={helmetDescription} />
        <link rel="canonical" href="https://www.neutralenachrichten.com/" />
        <meta property="og:title" content={helmetTitle} />
        <meta property="og:description" content={helmetDescription} />
        <meta property="og:url" content="https://www.neutralenachrichten.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.neutralenachrichten.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={helmetTitle} />
        <meta name="twitter:description" content={helmetDescription} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "NeutralNachrichten",
          "description": "KI-gestützte Analyse des deutschen Medienspektrums",
          "url": "https://www.neutralenachrichten.com",
          "applicationCategory": "NewsApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
        })}</script>
      </Helmet>

      {/* Top info strip */}
      <div className="bg-[#1a1a1a] dark:bg-[#0a0a0a] text-white text-center py-1.5 font-sans text-[10px] uppercase tracking-widest">
        {t.heroSub}
      </div>

      {/* Navbar */}
      <nav className="bg-[#FFF8F0] dark:bg-[#141414] border-b-2 border-[#1a1a1a] dark:border-gray-700 sticky top-0 z-50" ref={menuRef}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

          {/* Left: hamburger (mobile) / date (desktop) */}
          <div className="flex items-center gap-3 w-28 sm:w-auto">
            {/* Hamburger — mobile only */}
            <button
              className="sm:hidden flex flex-col justify-center gap-[5px] w-6 h-6 shrink-0"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Menu"
            >
              <span className={`block h-0.5 bg-[#1a1a1a] dark:bg-[#f0ece4] transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block h-0.5 bg-[#1a1a1a] dark:bg-[#f0ece4] transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 bg-[#1a1a1a] dark:bg-[#f0ece4] transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
            {/* Date — desktop only */}
            <span className="font-sans text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 hidden sm:block">{dateStr}</span>
          </div>

          {/* Logo — centered, always navigates home */}
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            title={lang === 'de' ? 'Zur Hauptseite' : lang === 'ru' ? 'На главную' : 'Go to home'}
            className="absolute left-1/2 -translate-x-1/2 group flex items-center gap-1.5 whitespace-nowrap"
          >
            <span className="font-serif font-black text-xl tracking-tight text-[#1a1a1a] dark:text-[#f0ece4] group-hover:text-rose-600 transition-colors duration-200">
              {t.title}
            </span>
            <span className="font-sans text-[10px] text-gray-300 dark:text-gray-600 group-hover:text-rose-400 transition-colors duration-200 hidden sm:inline">⌂</span>
          </Link>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <Link
              to="/compare"
              className="hidden sm:block font-sans text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
            >
              ⚖ {t.nav.compare}
            </Link>

            {/* Auth — desktop only */}
            {authUser ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link
                  to="/profile"
                  className="font-sans text-[10px] text-gray-500 dark:text-gray-400 hover:text-[#1a1a1a] dark:hover:text-white transition-colors max-w-[100px] truncate"
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

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center w-7 h-7 text-gray-500 dark:text-gray-400 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Language switcher — ru only for admin */}
            <div className="flex gap-0 border border-[#1a1a1a] dark:border-gray-600">
              {(canUseRussian(authUser?.email) ? ['de', 'en', 'ru'] as Language[] : ['de', 'en'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageSwitch(l)}
                  className={`px-2 sm:px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    lang === l ? 'bg-[#1a1a1a] dark:bg-gray-700 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-[#1a1a1a] dark:hover:bg-gray-700 hover:text-white'
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
          <div className="sm:hidden border-t-2 border-[#1a1a1a] dark:border-gray-700 bg-[#FFF8F0] dark:bg-[#141414] px-4 py-4 space-y-0 divide-y divide-[#e0d8cf] dark:divide-gray-700">
            <div className="pb-3">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-600 mb-2">{dateStr}</p>
            </div>
            {authUser ? (
              <div className="py-3 space-y-2">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4]"
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
              {/* Theme toggle — mobile */}
              <button
                onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
              >
                {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
                {theme === 'dark' ? (lang === 'de' ? 'Helles Design' : lang === 'ru' ? 'Светлая тема' : 'Light mode') : (lang === 'de' ? 'Dunkles Design' : lang === 'ru' ? 'Тёмная тема' : 'Dark mode')}
              </button>
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
                  className="block font-sans text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
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
      <main className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full pb-24 sm:pb-10">
        <Routes>
          <Route path="/" element={
            <>
              {status === 'idle' && (
                <div className="mb-6 sm:mb-10 animate-slide-down">
                  <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500 mb-3 sm:mb-4">Medienanalyse</p>
                  <h1 className="font-serif font-black text-2xl sm:text-4xl md:text-5xl text-[#1a1a1a] dark:text-white leading-[1.05] mb-4 sm:mb-5">
                    {t.subtitle}
                  </h1>
                  {/* Spectrum accent rule */}
                  <div className="flex gap-0.5 mb-4 sm:mb-5">
                    <div className="w-5 sm:w-6 h-[3px] bg-rose-600" />
                    <div className="w-5 sm:w-6 h-[3px] bg-orange-400" />
                    <div className="w-5 sm:w-6 h-[3px] bg-slate-400" />
                    <div className="w-5 sm:w-6 h-[3px] bg-sky-500" />
                    <div className="w-5 sm:w-6 h-[3px] bg-blue-700" />
                  </div>
                  <p className="font-sans text-gray-500 dark:text-gray-400 text-sm sm:text-base">{t.description}</p>
                </div>
              )}

              {status === 'idle' ? (
                <div className="flex gap-6 items-start">
                  {/* Main column */}
                  <div className="flex-1 min-w-0">
                    <SearchBar onSearch={handleSearch} status={status} lang={lang} inputRef={searchInputRef} />

                    {/* Beliebte Themen — shown for returning visitors (onboarded) */}
                    {typeof window !== 'undefined' && localStorage.getItem('nn-onboarded') && (
                      <div className="mt-4 mb-2 animate-fade-in">
                        <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                          {lang === 'de' ? 'Beliebte Themen' : lang === 'ru' ? 'Популярные темы' : 'Popular Topics'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {['AfD Umfragewerte', 'Klimawandel Deutschland', 'Migration 2025', 'Bürgergeld', 'Ukraine Krieg', 'Wirtschaftskrise'].map((topic) => (
                            <button
                              key={topic}
                              onClick={() => handleSearch(topic)}
                              className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-[#2a2a2a] text-xs font-sans text-slate-600 dark:text-gray-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950 dark:hover:border-rose-800 dark:hover:text-rose-300 transition-colors press-scale"
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Daily usage indicator */}
                    {dailyRemaining !== null && (
                      <UsageBar
                        remaining={dailyRemaining}
                        limit={authUser?.daily_limit ?? DAILY_LIMIT}
                        lang={lang}
                        tier={authUser?.tier ?? 'free'}
                        onUpgradeClick={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
                      />
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

                  {/* Right sidebar — Daily News + Already Analyzed */}
                  <div className="hidden lg:flex lg:flex-col gap-6 w-72 shrink-0 sticky top-24">
                    <DailyNews lang={lang} onSelect={(topic) => handleSearch(topic)} />
                    <PublicAnalyses
                      lang={lang}
                      onSelect={(topic, l) => handleSearch(topic, l)}
                      recentSearches={history.map(h => h.topic)}
                      authToken={authToken}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <SearchBar onSearch={handleSearch} status={status} lang={lang} inputRef={searchInputRef} />
                  <SearchHistory
                    history={history}
                    onSelect={(topic) => handleSearch(topic)}
                    onClear={clearHistory}
                    lang={lang}
                  />
                </>
              )}

              {/* Loading screen — only shown while waiting for the first RSS event */}
              {status === 'loading' && !data && (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20 max-w-sm mx-auto w-full animate-fade-in">
                  {/* Newspaper-style spinner */}
                  <div className="w-12 h-12 mb-8 border-2 border-[#1a1a1a] dark:border-gray-400 border-t-transparent rounded-full animate-spin" />

                  {/* Stage text */}
                  <div className="h-7 mb-6 flex items-center justify-center">
                    <p
                      className="font-sans text-[#1a1a1a] dark:text-[#f0ece4] text-sm text-center transition-opacity duration-300"
                      style={{ opacity: stageVisible ? 1 : 0 }}
                    >
                      {t.loadingStages[loadingStage]}
                    </p>
                  </div>

                  {/* Progress bar — flat like a rule */}
                  <div className="w-full bg-[#e8e0d5] dark:bg-gray-700 h-0.5 mb-4 overflow-hidden">
                    <div
                      className="bg-[#1a1a1a] dark:bg-gray-300 h-0.5 transition-all duration-200 ease-out"
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
                          backgroundColor: i <= loadingStage ? (document.documentElement.classList.contains('dark') ? '#d1d5db' : '#1a1a1a') : (document.documentElement.classList.contains('dark') ? '#374151' : '#d5ccbf'),
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {status === 'error' && error && (
                <div className="border-l-4 border-red-700 bg-red-50 px-6 py-4 max-w-2xl mx-auto">
                  <p className="font-serif font-bold text-red-800 mb-1">{t.errorTitle}</p>
                  <p className="font-sans text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Dashboard shown as soon as RSS data arrives (~2s) and after full result */}
              {(status === 'success' || (status === 'loading' && data)) && data && (
                <div className="animate-slide-up">
                  <div className="mb-6 flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleReset}
                      className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 animate-fade-in"
                    >
                      <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
                      {t.backToHome}
                    </button>
                    {/* Bookmark button */}
                    <button
                      onClick={handleToggleSave}
                      disabled={saveLoading}
                      title={isSaved ? t.saved.unsave : (authToken ? t.saved.save : t.saved.loginPrompt)}
                      className={`inline-flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-widest px-4 py-3 border-2 transition-colors duration-200 disabled:opacity-50 ${
                        isSaved
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                          : 'border-[#1a1a1a] dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      <Bookmark size={12} fill={isSaved ? 'currentColor' : 'none'} />
                      {isSaved ? t.saved.saved : t.saved.save}
                    </button>
                  </div>
                  <AnalysisDashboard
                    data={data}
                    lang={lang}
                    deepLoading={deepLoading}
                    analysisLoading={analysisLoading}
                  />
                </div>
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
              onAuthUpdate={handleAuthSuccess}
              onNavigateToTopic={(topic: string) => handleSearch(topic)}
            />
          } />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={
            <ResetPasswordPage onAuthSuccess={handleAuthSuccess} />
          } />
          <Route path="/a/:slug" element={<AnalysisPage lang={lang} />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#1a1a1a] dark:border-gray-700 bg-[#FFF8F0] dark:bg-[#141414] py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-sans text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
              <Link to="/about" className="hover:text-[#1a1a1a] dark:hover:text-white transition-colors">{t.nav.about}</Link>
              <Link to="/methodology" className="hover:text-[#1a1a1a] dark:hover:text-white transition-colors">{t.nav.methodology}</Link>
              <Link to="/compare" className="hover:text-[#1a1a1a] dark:hover:text-white transition-colors">{t.nav.compare}</Link>
              <Link to="/suggest" className="hover:text-[#1a1a1a] dark:hover:text-white transition-colors">{t.nav.suggest}</Link>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <Link to="/imprint" className="hover:text-[#1a1a1a] dark:hover:text-white transition-colors">{t.imprint}</Link>
              <Link to="/privacy" className="hover:text-[#1a1a1a] dark:hover:text-white transition-colors">{t.privacy}</Link>
              <Link to="/terms" className="hover:text-[#1a1a1a] dark:hover:text-white transition-colors">{t.terms}</Link>
            </div>
            <div className="h-px bg-[#1a1a1a] dark:bg-gray-600 opacity-10 dark:opacity-100" />
            <p className="text-center font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
              &copy; {new Date().getFullYear()} {t.footerText}
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <MobileBottomNav
        lang={lang}
        authUser={authUser}
        onSearchTab={handleSearchTabPress}
        onAnalyzed={() => setAnalyzedSheetOpen(true)}
      />

      {/* Mobile PublicAnalyses bottom sheet */}
      <MobileAnalyzedSheet
        open={analyzedSheetOpen}
        onClose={() => setAnalyzedSheetOpen(false)}
        lang={lang}
        onSelect={(topic, l) => { handleSearch(topic, l); setAnalyzedSheetOpen(false); }}
        recentSearches={history.map(h => h.topic)}
        authToken={authToken}
      />

      <CookieConsent lang={lang} onConsentChange={handleConsentChange} />

      {showAuthModal && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          lang={lang}
        />
      )}

      {showOnboarding && (
        <OnboardingModal
          lang={lang}
          onSelectTopic={handleOnboardingSelect}
          onDismiss={handleOnboardingDismiss}
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
