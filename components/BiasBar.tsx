import React from 'react';
import { Language, translations } from '../translations';
import { CoverageDistribution, SpectrumKey } from '../types';

interface BiasBarProps {
  coverage: CoverageDistribution;
  lang: Language;
}

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const COLORS: Record<SpectrumKey, { bar: string; text: string }> = {
  left:         { bar: 'bg-rose-600',  text: 'text-rose-600' },
  center_left:  { bar: 'bg-orange-400', text: 'text-orange-600' },
  center:       { bar: 'bg-slate-500', text: 'text-slate-600' },
  center_right: { bar: 'bg-sky-500',   text: 'text-sky-600' },
  right:        { bar: 'bg-blue-700',  text: 'text-blue-700' },
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

  const levelKey = { high: 'high', medium: 'medium', low: 'low' } as const;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-5">
        {t.biasBar.title}
      </h3>

      <div className="space-y-4">
        {SPECTRUM_ORDER.map((spectrum) => {
          const entry = coverage[spectrum];
          if (!entry) return null;
          const colors = COLORS[spectrum];
          const label = labelMap[spectrum];
          const level = t.biasBar[levelKey[entry.estimate]];

          return (
            <div key={spectrum}>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                  {label}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {level} · {entry.percent}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`${colors.bar} h-2.5 rounded-full transition-all duration-700 ease-out`}
                  style={{ width: `${entry.percent}%` }}
                  role="progressbar"
                  aria-valuenow={entry.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label}: ${level}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini spectrum legend */}
      <div className="flex items-center gap-0.5 mt-5 mb-1">
        {SPECTRUM_ORDER.map((key) => (
          <div key={key} className={`flex-1 h-1 rounded-full ${COLORS[key].bar} opacity-60`} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{t.leaningLeft}</span>
        <span>{t.leaningCenter}</span>
        <span>{t.leaningRight}</span>
      </div>
    </div>
  );
};
