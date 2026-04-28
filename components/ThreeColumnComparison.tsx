import React from 'react';
import { NewsSource } from '../types';
import { Language, translations } from '../translations';

interface ColumnConfig {
  source: NewsSource;
  leaning: string;
  spectrum: 'left' | 'center' | 'right';
}

interface ThreeColumnComparisonProps {
  left: NewsSource;
  center: NewsSource;
  right: NewsSource;
  lang: Language;
}

const spectrumStyles = {
  left: {
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    title: 'text-red-700',
    card: 'border-t-4 border-red-500',
    hover: 'hover:border-red-400',
    arrow: '←',
  },
  center: {
    bar: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-700',
    title: 'text-slate-700',
    card: 'border-t-4 border-slate-400',
    hover: 'hover:border-slate-500',
    arrow: '·',
  },
  right: {
    bar: 'bg-blue-600',
    badge: 'bg-blue-100 text-blue-800',
    title: 'text-blue-800',
    card: 'border-t-4 border-blue-600',
    hover: 'hover:border-blue-500',
    arrow: '→',
  },
};

const SourceColumn: React.FC<ColumnConfig & { lang: Language }> = ({ source, leaning, spectrum, lang }) => {
  const t = translations[lang];
  const s = spectrumStyles[spectrum];

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
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {source.source_name}
          </span>
        </div>

        {/* Article title */}
        <h4 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-3 group-hover:text-slate-700 transition-colors">
          {source.article_title}
        </h4>
      </div>

      {/* Summary */}
      <div className="px-4 pb-4 flex-grow">
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-5">
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

export const ThreeColumnComparison: React.FC<ThreeColumnComparisonProps> = ({ left, center, right, lang }) => {
  const t = translations[lang];

  return (
    <div className="space-y-3">
      <h3 className="text-xl font-bold text-gray-900 px-1">{t.analyzedSources}</h3>

      {/* Spectrum legend bar */}
      <div className="flex items-center gap-1 px-1 mb-1">
        <div className="flex-1 h-1 rounded-full bg-red-500 opacity-60" />
        <div className="flex-1 h-1 rounded-full bg-slate-400 opacity-60" />
        <div className="flex-1 h-1 rounded-full bg-blue-600 opacity-60" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SourceColumn source={left}   leaning={t.leaningLeft}   spectrum="left"   lang={lang} />
        <SourceColumn source={center} leaning={t.leaningCenter} spectrum="center" lang={lang} />
        <SourceColumn source={right}  leaning={t.leaningRight}  spectrum="right"  lang={lang} />
      </div>
    </div>
  );
};
