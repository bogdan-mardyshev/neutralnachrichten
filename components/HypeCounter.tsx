import React, { useEffect, useRef, useState } from 'react';
import { translations, Language } from '../translations';
import { CoverageDistribution, SpectrumKey } from '../types';

interface Props {
  lang: Language;
  coverage: CoverageDistribution;
  topic: string;
}

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) return;
    startRef.current = null;
    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]);
  return value;
}

function computeHype(cd: CoverageDistribution): number {
  // Use total article count (RSS-based) on a log scale.
  // Fallback to percent-based average for legacy non-RSS data.
  const hasRealCounts = SPECTRUM_ORDER.some(s => typeof cd[s]?.count === 'number');

  if (hasRealCounts) {
    const total = SPECTRUM_ORDER.reduce((acc, s) => acc + (cd[s]?.count ?? 0), 0);
    if (total === 0) return 0;
    // log10 scale: 1→~15, 5→~39, 10→~52, 20→~66, 43→~82, 100→100
    return Math.min(100, Math.round(Math.log10(total + 1) * 50));
  }

  // Legacy path: Gemini estimated percent as absolute intensity (0-100 per spectrum)
  const vals = SPECTRUM_ORDER.map(s => cd[s]?.percent ?? 0);
  return Math.min(100, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
}

function hypeLabel(score: number, lang: Language) {
  if (lang === 'de') {
    if (score >= 75) return 'Mega-Hype';
    if (score >= 55) return 'Heiß';
    if (score >= 35) return 'Im Gespräch';
    return 'Ruhig';
  }
  if (lang === 'ru') {
    if (score >= 75) return 'Максимальный хайп';
    if (score >= 55) return 'Горячая тема';
    if (score >= 35) return 'Обсуждается';
    return 'Тихо';
  }
  if (score >= 75) return 'Mega Hype';
  if (score >= 55) return 'Hot Topic';
  if (score >= 35) return 'In Discussion';
  return 'Low Buzz';
}

function hypeIcon(score: number) {
  if (score >= 75) return '▲▲▲';
  if (score >= 55) return '▲▲';
  if (score >= 35) return '▲';
  return '—';
}

function hypeAccent(score: number) {
  if (score >= 75) return { bg: 'bg-rose-600',   bar: 'bg-rose-500',   text: 'text-rose-600'   };
  if (score >= 55) return { bg: 'bg-orange-500',  bar: 'bg-orange-400', text: 'text-orange-600' };
  if (score >= 35) return { bg: 'bg-amber-500',   bar: 'bg-amber-400',  text: 'text-amber-600'  };
  return            { bg: 'bg-slate-500',   bar: 'bg-slate-400',  text: 'text-slate-500'  };
}

export const HypeCounter: React.FC<Props> = ({ lang, coverage, topic }) => {
  const score = computeHype(coverage);
  const animated = useCountUp(score);
  const label = hypeLabel(score, lang);
  const icon = hypeIcon(score);
  const accent = hypeAccent(score);
  const titleMap = { de: 'Hype-Niveau', en: 'Hype Level', ru: 'Хайп-уровень' };

  return (
    <div className="border-2 border-[#1a1a1a] dark:border-[#2d2d2d] flex items-stretch overflow-hidden bg-[#FFF8F0] dark:bg-[#141414]">
      {/* Left — colored score box */}
      <div className={`${accent.bg} text-white px-5 py-4 flex flex-col items-center justify-center shrink-0 w-24`}>
        <span className="font-sans text-2xl font-black tabular-nums leading-none">{animated}</span>
        <span className="font-sans text-[10px] text-white/50 mt-0.5">/100</span>
        <span className="font-sans text-sm mt-1 text-white/70">{icon}</span>
      </div>

      {/* Vertical rule */}
      <div className="w-px bg-[#1a1a1a] dark:bg-[#2d2d2d]" />

      {/* Right — details */}
      <div className="flex-1 px-5 py-4 flex flex-col justify-center gap-1.5">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">{titleMap[lang]}</p>
        <p className="font-serif font-bold text-base text-[#1a1a1a] dark:text-[#f0ece4] leading-tight">
          <span className={`${accent.text}`}>{label}</span> · {topic}
        </p>

        {/* Progress bar */}
        <div className="h-1.5 bg-[#e8e0d5] dark:bg-[#252525] overflow-hidden mt-1">
          <div
            className={`h-full ${accent.bar} transition-all duration-700`}
            style={{ width: `${animated}%` }}
          />
        </div>
        <div className="flex justify-between font-sans text-[9px] text-gray-300 dark:text-gray-600 uppercase tracking-widest">
          <span>0</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
};
