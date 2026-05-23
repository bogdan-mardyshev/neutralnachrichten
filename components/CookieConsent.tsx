import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ChevronUp, ChevronDown } from 'lucide-react';
import { Language, translations } from '../translations';

export type ConsentLevel = 'necessary' | 'analytics' | 'all';

const STORAGE_KEY = 'nn-cookie-consent';

export function getConsentLevel(): ConsentLevel | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY) as ConsentLevel | null;
    if (val === 'necessary' || val === 'analytics' || val === 'all') return val;
  } catch {}
  return null;
}

export function hasAnalyticsConsent(): boolean {
  const c = getConsentLevel();
  return c === 'analytics' || c === 'all';
}

interface Props {
  lang: Language;
  onConsentChange?: (level: ConsentLevel) => void;
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 ${
      checked
        ? 'bg-emerald-500'
        : 'bg-gray-300 dark:bg-gray-600'
    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

export const CookieConsent: React.FC<Props> = ({ lang, onConsentChange }) => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const t = translations[lang];
  const c = t.cookie;

  useEffect(() => {
    // Show banner only if no consent has been given yet
    if (!getConsentLevel()) {
      // Small delay so page loads first
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const save = (level: ConsentLevel) => {
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {}
    setVisible(false);
    onConsentChange?.(level);
  };

  const handleAcceptAll = () => save('all');
  const handleNecessaryOnly = () => save('necessary');
  const handleSaveSelection = () => save(analyticsOn ? 'analytics' : 'necessary');

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200] animate-slide-up"
      role="dialog"
      aria-label={c.title}
    >
      <div className="bg-white dark:bg-[#141414] border-t-2 border-[#1a1a1a] dark:border-gray-700 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
        {/* Settings panel (expandable) */}
        {expanded && (
          <div className="border-b border-[#e0d8cf] dark:border-gray-700 bg-[#faf9f7] dark:bg-[#0f0f0f] px-4 py-4 max-w-3xl mx-auto w-full">
            <div className="space-y-3">
              {/* Necessary */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4]">
                    {c.necessary}
                  </p>
                  <p className="font-sans text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {lang === 'de'
                      ? 'Für grundlegende Funktionen der Website. Immer aktiv.'
                      : lang === 'ru'
                        ? 'Для базовых функций сайта. Всегда активны.'
                        : 'Required for basic site functionality. Always active.'}
                  </p>
                </div>
                <Toggle checked={true} onChange={() => {}} disabled={true} />
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4]">
                    {c.analytics}
                  </p>
                  <p className="font-sans text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {lang === 'de'
                      ? 'PostHog-Nutzungsanalyse — hilft uns, die App zu verbessern.'
                      : lang === 'ru'
                        ? 'Аналитика PostHog — помогает нам улучшить приложение.'
                        : 'PostHog usage analytics — helps us improve the app.'}
                  </p>
                </div>
                <Toggle checked={analyticsOn} onChange={setAnalyticsOn} />
              </div>

              {/* Marketing — always off / not used */}
              <div className="flex items-center justify-between gap-4 opacity-50">
                <div className="min-w-0">
                  <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4]">
                    {c.marketing}
                  </p>
                  <p className="font-sans text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {lang === 'de'
                      ? 'Wird von uns nicht verwendet.'
                      : lang === 'ru'
                        ? 'Мы не используем.'
                        : 'Not used by us.'}
                  </p>
                </div>
                <Toggle checked={false} onChange={() => {}} disabled={true} />
              </div>
            </div>

            {/* Save selection button */}
            <button
              onClick={handleSaveSelection}
              className="mt-4 font-sans text-[10px] font-bold uppercase tracking-widest border-2 border-[#1a1a1a] dark:border-gray-600 dark:text-[#f0ece4] px-4 py-2 hover:bg-[#1a1a1a] dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              {c.saveSelection}
            </button>
          </div>
        )}

        {/* Main bar */}
        <div className="max-w-3xl mx-auto w-full px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Left: icon + text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Cookie size={18} className="text-[#1a1a1a] dark:text-gray-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4] mb-0.5">
                  {c.title}
                </p>
                <p className="font-sans text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {c.body}{' '}
                  <Link
                    to="/privacy"
                    className="underline hover:text-[#1a1a1a] dark:hover:text-white"
                  >
                    {c.privacyLink}
                  </Link>
                </p>
              </div>
            </div>

            {/* Right: buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {/* Settings toggle */}
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 px-3 py-2 hover:border-[#1a1a1a] dark:hover:border-gray-400 hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
              >
                {c.settings}
                {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              </button>

              {/* Necessary only */}
              <button
                onClick={handleNecessaryOnly}
                className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4] border border-[#1a1a1a] dark:border-gray-600 px-3 py-2 hover:bg-[#1a1a1a] dark:hover:bg-gray-700 hover:text-white transition-colors"
              >
                {c.necessaryOnly}
              </button>

              {/* Accept all */}
              <button
                onClick={handleAcceptAll}
                className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-emerald-700 text-white px-4 py-2 hover:bg-rose-600 dark:hover:bg-emerald-600 transition-colors"
              >
                {c.acceptAll}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
