import React, { useEffect, useState } from 'react';
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
        if (s <= 1) { window.location.reload(); return 0; }
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

// ── Brand spectrum strip ──────────────────────────────────────────────────────
const SpectrumStrip = () => (
  <div className="h-[3px] flex w-full">
    <div className="flex-1 bg-rose-600" />
    <div className="flex-1 bg-orange-400" />
    <div className="flex-1 bg-slate-400" />
    <div className="flex-1 bg-sky-500" />
    <div className="flex-1 bg-blue-700" />
  </div>
);

// ── Spectrum progress bar (fills left→right across 5 colors) ─────────────────
const SpectrumProgress = ({ pct }: { pct: number }) => (
  <div className="relative w-full h-[5px] bg-[#e0d8cf] overflow-hidden">
    <div
      className="absolute inset-y-0 left-0 transition-all duration-700"
      style={{
        width: `${pct}%`,
        background: 'linear-gradient(to right, #e11d48, #fb923c, #94a3b8, #0ea5e9, #1d4ed8)',
      }}
    />
  </div>
);

// ── Copy ──────────────────────────────────────────────────────────────────────
const T = {
  de: {
    remaining:  (n: number, limit: number) => `${n} von ${limit} Analysen heute`,
    limitHit:   'Tageslimit erreicht',
    resetsIn:   'Neue Analysen in',
    proHead:    'Unbegrenzt analysieren',
    proBenefits: ['Kein Tageslimit', 'Priorität', 'Tiefenanalyse+'],
    proBtn:     'Jetzt Pro werden — kostenlos testen',
    lowHead:    (n: number) => `Nur noch ${n} Analyse${n === 1 ? '' : 'n'}`,
    lowSub:     'Mit Pro analysierst du ohne Unterbrechung',
    lowBtn:     'Pro freischalten',
    freeLabel:  'Kostenloses Kontingent',
    upgradeNudge: 'Mit Pro: kein Limit, mehr Tiefe.',
    upgradeBtn: 'Upgrade — lohnt sich',
  },
  en: {
    remaining:  (n: number, limit: number) => `${n} of ${limit} analyses today`,
    limitHit:   'Daily limit reached',
    resetsIn:   'New analyses in',
    proHead:    'Unlimited analyses',
    proBenefits: ['No daily limit', 'Priority', 'Deep analysis+'],
    proBtn:     'Go Pro — try for free',
    lowHead:    (n: number) => `Only ${n} left`,
    lowSub:     'Pro lets you keep going without interruption',
    lowBtn:     'Unlock Pro',
    freeLabel:  'Free daily quota',
    upgradeNudge: 'Pro: no limits, deeper insights.',
    upgradeBtn: 'Upgrade — worth it',
  },
  ru: {
    remaining:  (n: number, limit: number) => `${n} из ${limit} анализов сегодня`,
    limitHit:   'Дневной лимит исчерпан',
    resetsIn:   'Новые анализы через',
    proHead:    'Анализы без ограничений',
    proBenefits: ['Без лимитов', 'Приоритет', 'Глубокий анализ+'],
    proBtn:     'Перейти на Pro — попробовать бесплатно',
    lowHead:    (n: number) => `Осталось ${n} ${n === 1 ? 'анализ' : n < 5 ? 'анализа' : 'анализов'}`,
    lowSub:     'Pro — анализируй без остановок',
    lowBtn:     'Открыть Pro',
    freeLabel:  'Бесплатный лимит',
    upgradeNudge: 'Pro: без лимитов, глубже.',
    upgradeBtn: 'Апгрейд — стоит того',
  },
};

export function UsageBar({ remaining, limit, lang, tier, onUpgradeClick }: Props) {
  const t = T[lang] ?? T.de;
  const countdown = useCountdownToMidnightUTC();
  const used = limit - remaining;
  const pct  = Math.min(100, (used / limit) * 100);
  const low  = remaining <= 2 && remaining > 0;
  const out  = remaining === 0;

  if (tier === 'pro' || tier === 'enterprise') return null;

  // ── LIMIT REACHED ─────────────────────────────────────────────────────────
  if (out) {
    return (
      <div className="mt-3 border-2 border-[#1a1a1a] bg-[#FFF8F0] overflow-hidden">
        <SpectrumStrip />
        <div className="px-4 pt-3 pb-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              <span className="font-sans text-[10px] uppercase tracking-widest font-bold text-[#1a1a1a]">
                {t.limitHit}
              </span>
            </div>
            <div className="font-sans text-[11px] text-gray-500 tabular-nums">
              {t.resetsIn}{' '}
              <span className="font-black text-[#1a1a1a] font-mono">{countdown}</span>
            </div>
          </div>

          {/* Full spectrum bar */}
          <SpectrumProgress pct={100} />

          {/* Pro upsell block */}
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-serif font-black text-base text-[#1a1a1a] leading-tight mb-1">
                {t.proHead}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {t.proBenefits.map(b => (
                  <span key={b} className="font-sans text-[10px] text-gray-500 flex items-center gap-1">
                    <span className="text-rose-500">✦</span> {b}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={onUpgradeClick}
              className="shrink-0 bg-[#1a1a1a] text-[#FFF8F0] font-sans text-[10px] uppercase tracking-widest px-4 py-2.5 hover:bg-rose-600 transition-colors whitespace-nowrap border-2 border-transparent hover:border-rose-600"
            >
              {t.proBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOW (≤ 2 remaining) ───────────────────────────────────────────────────
  if (low) {
    return (
      <div className="mt-3 border-2 border-orange-400 bg-[#FFF8F0] overflow-hidden">
        <SpectrumStrip />
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-serif font-black text-sm text-[#1a1a1a]">
              {t.lowHead(remaining)}
            </span>
            <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
              {t.remaining(remaining, limit)}
            </span>
          </div>

          <SpectrumProgress pct={pct} />

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-sans text-[11px] text-gray-500">{t.lowSub}</p>
            <button
              onClick={onUpgradeClick}
              className="shrink-0 bg-orange-400 text-white font-sans text-[10px] uppercase tracking-widest px-3 py-2 hover:bg-orange-500 transition-colors whitespace-nowrap"
            >
              {t.lowBtn} ↗
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── NORMAL ────────────────────────────────────────────────────────────────
  return (
    <div className="mt-3 border border-[#1a1a1a] bg-[#FFF8F0] overflow-hidden">
      <SpectrumStrip />
      <div className="px-4 pt-3 pb-3">
        {/* Count + label */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-sans text-[10px] uppercase tracking-widest font-bold text-[#1a1a1a]">
            {t.remaining(remaining, limit)}
          </span>
          <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
            {t.freeLabel}
          </span>
        </div>

        {/* Spectrum progress */}
        <SpectrumProgress pct={pct} />

        {/* Dot grid */}
        <div className="flex gap-[3px] mt-2 mb-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 transition-all duration-300 ${
                i < used
                  ? 'bg-[#1a1a1a]'
                  : 'bg-[#e0d8cf]'
              }`}
            />
          ))}
        </div>

        {/* Upgrade nudge */}
        <div className="flex items-center justify-between gap-3 border-t border-[#e0d8cf] pt-2.5">
          <p className="font-sans text-[10px] text-gray-400">{t.upgradeNudge}</p>
          <button
            onClick={onUpgradeClick}
            className="shrink-0 bg-[#1a1a1a] text-[#FFF8F0] font-sans text-[10px] uppercase tracking-widest px-3 py-1.5 hover:bg-rose-600 transition-colors whitespace-nowrap"
          >
            {t.upgradeBtn} ↗
          </button>
        </div>
      </div>
    </div>
  );
}
