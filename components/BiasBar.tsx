import React from 'react';
import { Language, translations } from '../translations';
import { CoverageDistribution, SpectrumKey } from '../types';

interface BiasBarProps {
  coverage: CoverageDistribution;
  lang: Language;
}

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const COLORS: Record<SpectrumKey, { bar: string; hex: string; text: string }> = {
  left:         { bar: 'bg-rose-600',   hex: '#e11d48', text: 'text-rose-600'   },
  center_left:  { bar: 'bg-orange-400', hex: '#fb923c', text: 'text-orange-500' },
  center:       { bar: 'bg-slate-500',  hex: '#64748b', text: 'text-slate-500'  },
  center_right: { bar: 'bg-sky-500',    hex: '#0ea5e9', text: 'text-sky-600'    },
  right:        { bar: 'bg-blue-700',   hex: '#1d4ed8', text: 'text-blue-700'   },
};

const SILENCE_COPY: Record<Language, string> = {
  de: 'Keine Berichterstattung — möglicherweise bewusstes Schweigen',
  en: 'No coverage found — possible deliberate silence',
  ru: 'Нет материалов — возможное намеренное замалчивание',
};

const ARTICLE_COPY: Record<Language, (n: number) => string> = {
  de: n => n === 1 ? '1 Artikel' : `${n} Artikel`,
  en: n => n === 1 ? '1 article' : `${n} articles`,
  ru: n => n === 1 ? '1 статья' : n < 5 ? `${n} статьи` : `${n} статей`,
};

export const BiasBar: React.FC<BiasBarProps> = ({ coverage, lang }) => {
  const t = translations[lang];

  const labelMap: Record<SpectrumKey, string> = {
    left:         t.biasBar.left,
    center_left:  t.biasBar.center_left,
    center:       t.biasBar.center,
    center_right: t.biasBar.center_right,
    right:        t.biasBar.right,
  };

  // Use count if available (RSS phase), otherwise fall back to percent-based bar
  const hasRealCounts = SPECTRUM_ORDER.some(s => typeof coverage[s]?.count === 'number');
  const totalCount    = hasRealCounts
    ? SPECTRUM_ORDER.reduce((acc, s) => acc + (coverage[s]?.count ?? 0), 0)
    : SPECTRUM_ORDER.reduce((acc, s) => acc + (coverage[s]?.percent ?? 0), 0);

  const silentSpectra = SPECTRUM_ORDER.filter(s => coverage[s]?.silence === true);

  return (
    <div className="border-2 border-[#1a1a1a] dark:border-[#2d2d2d] overflow-hidden animate-slide-up stagger-2 bg-[#FFF8F0] dark:bg-[#141414]">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
        <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">
          {t.biasBar.title}
        </p>
        {hasRealCounts && totalCount > 0 && (
          <span className="font-sans text-[9px] text-white/40 uppercase tracking-widest shrink-0">
            {ARTICLE_COPY[lang]?.(totalCount) ?? `${totalCount}`}
          </span>
        )}
      </div>

      <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4">
        {/* Stacked proportional bar */}
        <div>
          <div className="flex overflow-hidden h-3 sm:h-4 gap-px rounded-sm">
            {SPECTRUM_ORDER.map((spectrum) => {
              const entry = coverage[spectrum];
              if (!entry) return null;
              const value = hasRealCounts ? (entry.count ?? 0) : (entry.percent ?? 0);
              const pct   = totalCount > 0 ? (value / totalCount) * 100 : 0;
              if (pct === 0) return (
                // Tiny sliver to indicate silence
                <div
                  key={spectrum}
                  className="bg-[#e0d8cf] dark:bg-[#252525] opacity-60 h-full"
                  style={{ width: '2px' }}
                  title={`${labelMap[spectrum]}: 0`}
                />
              );
              return (
                <div
                  key={spectrum}
                  className={`${COLORS[spectrum].bar} h-full transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                  title={`${labelMap[spectrum]}: ${Math.round(pct)}%${entry.count != null ? ` (${entry.count})` : ''}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
            <span>{t.leaningLeft}</span>
            <span>{t.leaningCenter}</span>
            <span>{t.leaningRight}</span>
          </div>
        </div>

        {/* Row bars */}
        <div className="space-y-2.5 sm:space-y-3">
          {SPECTRUM_ORDER.map((spectrum) => {
            const entry = coverage[spectrum];
            if (!entry) return null;
            const value   = hasRealCounts ? (entry.count ?? 0) : (entry.percent ?? 0);
            const pct     = totalCount > 0 ? Math.round((value / totalCount) * 100) : 0;
            const isSilent = entry.silence === true;
            const c = COLORS[spectrum];

            return (
              <div key={spectrum} className="flex items-center gap-2 sm:gap-3">
                {/* Dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${isSilent ? 'bg-[#e0d8cf] dark:bg-[#252525]' : c.bar}`} />

                {/* Label */}
                <span className="font-sans text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600 dark:text-gray-400 w-20 sm:w-24 shrink-0 leading-tight">
                  {labelMap[spectrum]}
                </span>

                {/* Bar track */}
                <div className="flex-1 bg-[#e8e0d5] dark:bg-[#252525] h-1.5 overflow-hidden">
                  {isSilent ? (
                    <div className="h-full w-full flex items-center">
                      <div className="h-[1px] w-full bg-[#d0c8bf] dark:bg-[#2d2d2d] border-dashed" />
                    </div>
                  ) : (
                    <div
                      className={`${c.bar} h-full transition-all duration-700 ease-out`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>

                {/* Value */}
                {isSilent ? (
                  <span className="font-sans text-[9px] text-gray-300 dark:text-gray-600 w-10 sm:w-12 text-right shrink-0 italic">—</span>
                ) : (
                  <div className="flex items-center gap-1 w-10 sm:w-16 justify-end shrink-0">
                    <span className={`font-sans text-xs font-bold ${c.text}`}>{pct}%</span>
                    {hasRealCounts && entry.count != null && (
                      <span className="font-sans text-[8px] text-gray-300 dark:text-gray-600 hidden sm:inline">
                        ({entry.count})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Silence warning banner */}
        {silentSpectra.length > 0 && (
          <div className="border border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex items-start gap-2 mt-1">
            <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 mb-0.5">
                {silentSpectra.map(s => labelMap[s]).join(', ')}
              </p>
              <p className="font-sans text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                {SILENCE_COPY[lang]}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
