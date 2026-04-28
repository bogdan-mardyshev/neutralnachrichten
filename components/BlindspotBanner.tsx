import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Language, translations } from '../translations';
import { CoverageDistribution, SpectrumKey } from '../types';

interface BlindspotBannerProps {
  coverage: CoverageDistribution;
  topic: string;
  lang: Language;
}

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

export const BlindspotBanner: React.FC<BlindspotBannerProps> = ({ coverage, topic, lang }) => {
  const t = translations[lang];

  const missing = SPECTRUM_ORDER.filter(
    (s) => coverage[s]?.estimate === 'low'
  );

  if (missing.length === 0) return null;

  const allLow = missing.length === SPECTRUM_ORDER.length;

  const subheaderMap: Record<SpectrumKey, string> = {
    left:         t.blindspot.subheaderLeft,
    center_left:  t.blindspot.subheaderCenterLeft,
    center:       t.blindspot.subheaderCenter,
    center_right: t.blindspot.subheaderCenterRight,
    right:        t.blindspot.subheaderRight,
  };

  const bodyMap: Record<SpectrumKey, (topic: string) => string> = {
    left:         t.blindspot.bodyLeft,
    center_left:  t.blindspot.bodyCenterLeft,
    center:       t.blindspot.bodyCenter,
    center_right: t.blindspot.bodyCenterRight,
    right:        t.blindspot.bodyRight,
  };

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-amber-900 font-bold text-sm tracking-widest uppercase">
            {t.blindspot.header}
          </p>

          {allLow ? (
            <p className="text-amber-800 text-sm leading-relaxed">{t.blindspot.allLow}</p>
          ) : (
            missing.map((spectrum) => (
              <p key={spectrum} className="text-amber-800 text-sm leading-relaxed">
                <span className="font-semibold">{subheaderMap[spectrum]}</span>{' '}
                {bodyMap[spectrum](topic)}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
