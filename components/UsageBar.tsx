import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Language } from '../translations';

interface Props {
  remaining: number;
  limit: number;
  lang: Language;
  tier: 'free' | 'pro' | 'enterprise';
  onUpgradeClick?: () => void;
}

// ── Midnight UTC countdown ────────────────────────────────────────────────────
function useCountdownToMidnightUTC() {
  const [seconds, setSeconds] = useState(() => {
    const now = new Date();
    const midnight = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
    ));
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  });

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          // Reload page when limit resets
          window.location.reload();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  de: {
    remaining:   (n: number, limit: number) => `${n} von ${limit} Analysen heute`,
    limitHit:    'Tageslimit erreicht',
    resetsIn:    'Reset in',
    proTeaser:   'Mit Pro unbegrenzt analysieren',
    proBtn:      '→ Pro freischalten',
    lowTeaser:   (n: number) => `Noch ${n} Analyse${n === 1 ? '' : 'n'} übrig`,
    lowSub:      'Pro gibt dir unbegrenzte Analysen',
  },
  en: {
    remaining:   (n: number, limit: number) => `${n} of ${limit} analyses today`,
    limitHit:    'Daily limit reached',
    resetsIn:    'Resets in',
    proTeaser:   'Get unlimited analyses with Pro',
    proBtn:      '→ Upgrade to Pro',
    lowTeaser:   (n: number) => `${n} analysis${n === 1 ? '' : 'es'} left`,
    lowSub:      'Pro gives you unlimited analyses',
  },
  ru: {
    remaining:   (n: number, limit: number) => `${n} из ${limit} анализов сегодня`,
    limitHit:    'Дневной лимит исчерпан',
    resetsIn:    'Сброс через',
    proTeaser:   'Pro — без ограничений',
    proBtn:      '→ Перейти на Pro',
    lowTeaser:   (n: number) => `Осталось ${n} анализ${n === 1 ? '' : n < 5 ? 'а' : 'ов'}`,
    lowSub:      'Pro снимает все лимиты',
  },
};

export function UsageBar({ remaining, limit, lang, tier, onUpgradeClick }: Props) {
  const t = T[lang] ?? T.de;
  const countdown = useCountdownToMidnightUTC();
  const used = limit - remaining;
  const pct  = Math.min(100, (used / limit) * 100);
  const low  = remaining <= 2 && remaining > 0;
  const out  = remaining === 0;
  const isPro = tier === 'pro' || tier === 'enterprise';

  // Pro/Enterprise users: don't show the bar
  if (isPro) return null;

  // ── Limit reached ──────────────────────────────────────────────────────────
  if (out) {
    return (
      <div className="mt-3 border-2 border-rose-600 bg-rose-50 px-4 py-3">
        {/* Top row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            <span className="font-sans text-[10px] uppercase tracking-widest font-bold text-rose-700">
              {t.limitHit}
            </span>
          </div>
          <div className="font-sans text-[10px] text-rose-500 tabular-nums">
            {t.resetsIn} <span className="font-bold text-rose-700">{countdown}</span>
          </div>
        </div>

        {/* Progress bar — full red */}
        <div className="w-full bg-rose-200 h-1.5 mb-3">
          <div className="bg-rose-600 h-1.5 w-full" />
        </div>

        {/* Pro upsell */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-serif font-bold text-sm text-rose-800">{t.proTeaser}</p>
            <p className="font-sans text-[10px] text-rose-500 mt-0.5">
              {lang === 'de' ? 'Kein Warten, kein Limit, sofort.' :
               lang === 'ru' ? 'Без ожидания, без лимитов.' :
               'No waiting, no limits, right now.'}
            </p>
          </div>
          <button
            onClick={onUpgradeClick}
            className="shrink-0 bg-rose-600 text-white font-sans text-[10px] uppercase tracking-widest px-4 py-2 hover:bg-rose-700 transition-colors whitespace-nowrap"
          >
            {t.proBtn}
          </button>
        </div>
      </div>
    );
  }

  // ── Low remaining (≤ 2) ────────────────────────────────────────────────────
  if (low) {
    return (
      <div className="mt-3 border border-amber-400 bg-amber-50 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[10px] uppercase tracking-widest font-bold text-amber-700">
              ⚠ {t.lowTeaser(remaining)}
            </span>
          </div>
          <span className="font-sans text-[9px] text-amber-500 uppercase tracking-widest">{t.remaining(remaining, limit)}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-amber-200 h-1 mb-2.5">
          <div className="bg-amber-500 h-1 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <p className="font-sans text-[10px] text-amber-600">{t.lowSub}</p>
          <button
            onClick={onUpgradeClick}
            className="font-sans text-[10px] uppercase tracking-widest text-amber-700 underline hover:no-underline transition-colors"
          >
            {t.proBtn}
          </button>
        </div>
      </div>
    );
  }

  // ── Normal ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-3 border border-[#e0d8cf] bg-[#fdf9f5] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-[3px]">
            {Array.from({ length: limit }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-sm transition-all duration-300 ${
                  i < used ? 'bg-[#1a1a1a]' : 'bg-[#e0d8cf]'
                }`}
              />
            ))}
          </div>
        </div>
        <span className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a] font-bold">
          {t.remaining(remaining, limit)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#e0d8cf] h-1 mb-3">
        <div
          className="bg-[#1a1a1a] h-1 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="font-sans text-[10px] text-gray-400">
          {lang === 'de' ? 'Kostenlose Analysen pro Tag' :
           lang === 'ru' ? 'Бесплатных анализов в день' :
           'Free analyses per day'}
        </p>
        <button
          onClick={onUpgradeClick}
          className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a] underline hover:no-underline transition-colors"
        >
          {t.proBtn}
        </button>
      </div>
    </div>
  );
}
