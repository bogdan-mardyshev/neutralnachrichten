import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Language, translations } from '../translations';
import { CoverageEstimate } from '../types';

interface BlindspotBannerProps {
  coverage: {
    left: { estimate: CoverageEstimate };
    center: { estimate: CoverageEstimate };
    right: { estimate: CoverageEstimate };
  };
  topic: string;
  lang: Language;
}

export const BlindspotBanner: React.FC<BlindspotBannerProps> = ({ coverage, topic, lang }) => {
  const t = translations[lang];

  const missing = (['left', 'center', 'right'] as const).filter(
    (s) => coverage[s].estimate === 'low'
  );

  if (missing.length === 0) return null;

  const allLow = missing.length === 3;

  const subheaderMap = {
    left: t.blindspot.subheaderLeft,
    center: t.blindspot.subheaderCenter,
    right: t.blindspot.subheaderRight,
  };

  const bodyMap = {
    left: t.blindspot.bodyLeft,
    center: t.blindspot.bodyCenter,
    right: t.blindspot.bodyRight,
  };

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-amber-900 font-bold text-sm tracking-widest uppercase">
            {t.blindspot.header}
            {!allLow && missing.length === 1 && (
              <span className="font-normal normal-case tracking-normal">
                {' '}· {subheaderMap[missing[0]]}
              </span>
            )}
            {!allLow && missing.length === 2 && (
              <span className="font-normal normal-case tracking-normal">
                {' '}· {subheaderMap[missing[0]]} {subheaderMap[missing[1]]}
              </span>
            )}
          </p>

          {allLow ? (
            <p className="text-amber-800 text-sm leading-relaxed">{t.blindspot.allLow}</p>
          ) : (
            missing.map((spectrum) => (
              <p key={spectrum} className="text-amber-800 text-sm leading-relaxed">
                {bodyMap[spectrum](topic)}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
