import React from 'react';
import { Language, translations } from '../translations';
import { CoverageEntry } from '../types';

interface BiasBarProps {
  coverage: {
    left: CoverageEntry;
    center: CoverageEntry;
    right: CoverageEntry;
  };
  lang: Language;
}

const COLORS = {
  left: { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' },
  center: { bar: 'bg-slate-500', text: 'text-slate-600', bg: 'bg-slate-50' },
  right: { bar: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
} as const;

export const BiasBar: React.FC<BiasBarProps> = ({ coverage, lang }) => {
  const t = translations[lang];
  const spectrums = ['left', 'center', 'right'] as const;

  const labelKey = { left: 'left', center: 'center', right: 'right' } as const;
  const levelKey = { high: 'high', medium: 'medium', low: 'low' } as const;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-5">
        {t.biasBar.title}
      </h3>

      <div className="space-y-4">
        {spectrums.map((spectrum) => {
          const entry = coverage[spectrum];
          const colors = COLORS[spectrum];
          const label = t.biasBar[labelKey[spectrum]];
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
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`${colors.bar} h-3 rounded-full transition-all duration-700 ease-out`}
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
    </div>
  );
};
