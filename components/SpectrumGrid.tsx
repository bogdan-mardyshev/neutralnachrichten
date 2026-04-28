import React from 'react';
import { NewsSource, SpectrumKey } from '../types';
import { Language, translations } from '../translations';

interface SpectrumGridProps {
  spectrum: Record<SpectrumKey, NewsSource>;
  lang: Language;
}

const spectrumStyles: Record<SpectrumKey, {
  bar: string;
  badge: string;
  title: string;
  card: string;
  dot: string;
  arrow: string;
}> = {
  left: {
    bar: 'bg-rose-600',
    badge: 'bg-rose-100 text-rose-700',
    title: 'text-rose-700',
    card: 'border-t-4 border-rose-600',
    dot: 'bg-rose-600',
    arrow: '←',
  },
  center_left: {
    bar: 'bg-orange-400',
    badge: 'bg-orange-100 text-orange-700',
    title: 'text-orange-700',
    card: 'border-t-4 border-orange-400',
    dot: 'bg-orange-400',
    arrow: '↖',
  },
  center: {
    bar: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-700',
    title: 'text-slate-700',
    card: 'border-t-4 border-slate-400',
    dot: 'bg-slate-500',
    arrow: '·',
  },
  center_right: {
    bar: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    title: 'text-sky-700',
    card: 'border-t-4 border-sky-500',
    dot: 'bg-sky-500',
    arrow: '↗',
  },
  right: {
    bar: 'bg-blue-700',
    badge: 'bg-blue-100 text-blue-800',
    title: 'text-blue-800',
    card: 'border-t-4 border-blue-700',
    dot: 'bg-blue-700',
    arrow: '→',
  },
};

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

interface SourceCardProps {
  source: NewsSource;
  spectrumKey: SpectrumKey;
  leaning: string;
  lang: Language;
}

const SourceCard: React.FC<SourceCardProps> = ({ source, spectrumKey, leaning, lang }) => {
  const t = translations[lang];
  const s = spectrumStyles[spectrumKey];

  return (
    <a
      href={source.article_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm ${s.card} hover:shadow-md transition-all duration-200 overflow-hidden`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${s.badge}`}>
            {leaning}
          </span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate max-w-[100px]">
            {source.source_name}
          </span>
        </div>

        <h4 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-3 group-hover:text-slate-700 transition-colors">
          {source.article_title}
        </h4>
      </div>

      {/* Summary */}
      <div className="px-4 pb-4 flex-grow">
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">
          {source.summary_of_perspective}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between mt-auto">
        <span className="text-xs text-gray-400">
          {source.publication_date || ''}
        </span>
        <span className={`text-xs font-semibold ${s.title} group-hover:underline`}>
          {source.url_is_search_fallback
            ? `🔍 ${t.searchArticle}`
            : `${t.readArticle} ${s.arrow}`}
        </span>
      </div>
    </a>
  );
};

export const SpectrumGrid: React.FC<SpectrumGridProps> = ({ spectrum, lang }) => {
  const t = translations[lang];

  const leaningLabels: Record<SpectrumKey, string> = {
    left: t.leaningLeft,
    center_left: t.leaningCenterLeft,
    center: t.leaningCenter,
    center_right: t.leaningCenterRight,
    right: t.leaningRight,
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900 px-1">{t.analyzedSources}</h3>

      {/* Political spectrum bar */}
      <div className="flex items-center gap-0.5 px-1">
        {SPECTRUM_ORDER.map((key) => (
          <div
            key={key}
            className={`flex-1 h-1.5 rounded-full ${spectrumStyles[key].bar} opacity-70`}
          />
        ))}
      </div>

      {/* 5-column grid — stacks to 1 col on mobile, 2-3 on md, all 5 on xl */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {SPECTRUM_ORDER.map((key) => (
          <SourceCard
            key={key}
            source={spectrum[key]}
            spectrumKey={key}
            leaning={leaningLabels[key]}
            lang={lang}
          />
        ))}
      </div>
    </div>
  );
};
