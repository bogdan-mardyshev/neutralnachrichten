import React from 'react';
import { Language, translations } from '../translations';
import { CoverageDistribution, NewsSpectrum, SpectrumKey } from '../types';

interface BlindspotBannerProps {
  coverage: CoverageDistribution;
  news_spectrum?: NewsSpectrum;
  topic: string;
  lang: Language;
}

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const SPECTRUM_DOT: Record<SpectrumKey, string> = {
  left:         'bg-rose-600',
  center_left:  'bg-orange-400',
  center:       'bg-slate-500',
  center_right: 'bg-sky-500',
  right:        'bg-blue-700',
};

export const BlindspotBanner: React.FC<BlindspotBannerProps> = ({ coverage, news_spectrum, topic, lang }) => {
  const t = translations[lang];

  const missing = SPECTRUM_ORDER.filter((s) => {
    const hasArticle = Array.isArray(news_spectrum?.[s])
      ? (news_spectrum![s] as any[]).some((a: any) => a?.article_title && a.article_title !== 'Kein Artikel gefunden')
      : (news_spectrum?.[s] as any)?.article_title;
    if (hasArticle) return false;
    return coverage[s]?.estimate === 'low';
  });

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
    <div className="border-2 border-[#1a1a1a] dark:border-[#2d2d2d] overflow-hidden bg-[#FFF8F0] dark:bg-[#141414]">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-5 py-3 flex items-center gap-2">
        <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">
          {t.blindspot.header}
        </span>
      </div>

      <div className="px-5 py-4 space-y-2">
        {allLow ? (
          <p className="font-sans text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{t.blindspot.allLow}</p>
        ) : (
          missing.map((spectrum) => (
            <div key={spectrum} className="flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${SPECTRUM_DOT[spectrum]}`} />
              <p className="font-sans text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">
                <span className="font-bold">{subheaderMap[spectrum]}</span>{' '}
                {bodyMap[spectrum](topic)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
