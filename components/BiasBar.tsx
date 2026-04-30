import React from 'react';
import { Language, translations } from '../translations';
import { CoverageDistribution, SpectrumKey } from '../types';

interface BiasBarProps {
  coverage: CoverageDistribution;
  lang: Language;
}

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const COLORS: Record<SpectrumKey, { bar: string; hex: string }> = {
  left:         { bar: 'bg-rose-600',   hex: '#e11d48' },
  center_left:  { bar: 'bg-orange-400', hex: '#fb923c' },
  center:       { bar: 'bg-slate-500',  hex: '#64748b' },
  center_right: { bar: 'bg-sky-500',    hex: '#0ea5e9' },
  right:        { bar: 'bg-blue-700',   hex: '#1d4ed8' },
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

  const total = SPECTRUM_ORDER.reduce((acc, s) => acc + (coverage[s]?.percent ?? 0), 0);

  return (
    <div className="border-2 border-[#1a1a1a] overflow-hidden">
      {/* Newspaper-style black header */}
      <div className="bg-[#1a1a1a] px-5 py-3">
        <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{t.biasBar.title}</p>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Stacked bar */}
        <div>
          <div className="flex overflow-hidden h-4 gap-px">
            {SPECTRUM_ORDER.map((spectrum) => {
              const entry = coverage[spectrum];
              if (!entry) return null;
              const pct = total > 0 ? (entry.percent / total) * 100 : 0;
              return (
                <div
                  key={spectrum}
                  className={`${COLORS[spectrum].bar} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                  title={`${labelMap[spectrum]}: ${Math.round(pct)}%`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 font-sans text-[9px] uppercase tracking-widest text-gray-400">
            <span>{t.leaningLeft}</span>
            <span>{t.leaningCenter}</span>
            <span>{t.leaningRight}</span>
          </div>
        </div>

        {/* Row bars */}
        <div className="space-y-3">
          {SPECTRUM_ORDER.map((spectrum) => {
            const entry = coverage[spectrum];
            if (!entry) return null;
            const pct = total > 0 ? Math.round((entry.percent / total) * 100) : 0;

            return (
              <div key={spectrum} className="flex items-center gap-3">
                {/* Color dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${COLORS[spectrum].bar}`} />

                {/* Label */}
                <span className="font-sans text-[10px] uppercase tracking-wider text-gray-600 w-24 shrink-0">
                  {labelMap[spectrum]}
                </span>

                {/* Bar track */}
                <div className="flex-1 bg-[#e8e0d5] h-1.5 overflow-hidden">
                  <div
                    className={`${COLORS[spectrum].bar} h-full transition-all duration-700 ease-out`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Percent */}
                <span className="font-sans text-xs font-bold text-[#1a1a1a] w-10 text-right shrink-0">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
