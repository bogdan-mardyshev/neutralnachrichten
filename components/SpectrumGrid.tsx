import React, { useState } from 'react';
import { NewsSource, SpectrumKey } from '../types';
import { Language, translations } from '../translations';

interface SpectrumGridProps {
  spectrum: Record<SpectrumKey, NewsSource[]>;
  lang: Language;
}

const spectrumStyles: Record<SpectrumKey, {
  bar: string;
  badge: string;
  title: string;
  card: string;
  dot: string;
  arrow: string;
  accent: string;
}> = {
  left: {
    bar: 'bg-rose-600',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    title: 'text-rose-700',
    card: 'border-t-2 border-rose-600',
    dot: 'bg-rose-600',
    arrow: '←',
    accent: '#e11d48',
  },
  center_left: {
    bar: 'bg-orange-400',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    title: 'text-orange-700',
    card: 'border-t-2 border-orange-400',
    dot: 'bg-orange-400',
    arrow: '↖',
    accent: '#f97316',
  },
  center: {
    bar: 'bg-slate-500',
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
    title: 'text-slate-600',
    card: 'border-t-2 border-slate-400',
    dot: 'bg-slate-500',
    arrow: '·',
    accent: '#64748b',
  },
  center_right: {
    bar: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    title: 'text-sky-700',
    card: 'border-t-2 border-sky-500',
    dot: 'bg-sky-500',
    arrow: '↗',
    accent: '#0ea5e9',
  },
  right: {
    bar: 'bg-blue-700',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    title: 'text-blue-800',
    card: 'border-t-2 border-blue-700',
    dot: 'bg-blue-700',
    arrow: '→',
    accent: '#1d4ed8',
  },
};

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

interface SourceCardProps {
  articles: NewsSource[];
  spectrumKey: SpectrumKey;
  leaning: string;
  lang: Language;
}

const SourceCard: React.FC<SourceCardProps> = ({ articles, spectrumKey, leaning, lang }) => {
  const t = translations[lang];
  const s = spectrumStyles[spectrumKey];
  const [idx, setIdx] = useState(0);

  const source = articles[idx];
  const total = articles.length;

  if (!source) {
    return (
      <div className={`group flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm ${s.card} overflow-hidden min-h-[200px] items-center justify-center p-4`}>
        <p className="text-xs text-gray-400 italic text-center">{t.noData ?? '—'}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-[#FFF8F0] border border-[#e0d8cf] ${s.card} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className={`font-sans text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border ${s.badge}`}>
            {leaning}
          </span>
          <span className="font-sans text-[10px] text-gray-400 uppercase tracking-wider truncate max-w-[100px]">
            {source.source_name}
          </span>
        </div>

        <a
          href={source.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <h4 className="font-serif font-bold text-[#1a1a1a] text-sm leading-snug mb-2 line-clamp-3 hover:opacity-70 transition-opacity">
            {source.article_title}
          </h4>
        </a>
      </div>

      {/* Summary */}
      <div className="px-4 pb-4 flex-grow">
        <p className="font-sans text-xs text-gray-500 leading-relaxed line-clamp-4">
          {source.summary_of_perspective}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#e0d8cf] mt-auto">
        <div className="flex items-center justify-between">
          <span className="font-sans text-[10px] text-gray-400">
            {source.publication_date || ''}
          </span>
          <a
            href={source.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-sans text-[10px] uppercase tracking-wider ${s.title} hover:underline`}
          >
            {source.url_is_search_fallback
              ? `🔍 ${t.searchArticle}`
              : `${t.readArticle} ${s.arrow}`}
          </a>
        </div>

        {/* Carousel nav */}
        {total > 1 && (
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#e0d8cf]">
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="w-6 h-6 border border-[#1a1a1a] disabled:opacity-20 disabled:cursor-default font-sans text-xs flex items-center justify-center hover:bg-[#1a1a1a] hover:text-white transition-colors"
            >
              ‹
            </button>
            <span className="font-sans text-[10px] text-gray-400 tracking-wider">
              {idx + 1} / {total}
            </span>
            <button
              onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
              disabled={idx === total - 1}
              className="w-6 h-6 border border-[#1a1a1a] disabled:opacity-20 disabled:cursor-default font-sans text-xs flex items-center justify-center hover:bg-[#1a1a1a] hover:text-white transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-black text-xl text-[#1a1a1a]">{t.analyzedSources}</h3>
        <div className="h-px flex-1 bg-[#1a1a1a] mx-4 opacity-15" />
      </div>

      {/* Political spectrum bar */}
      <div className="flex gap-px overflow-hidden h-1.5">
        {SPECTRUM_ORDER.map((key) => (
          <div key={key} className={`flex-1 ${spectrumStyles[key].bar}`} />
        ))}
      </div>
      <div className="flex justify-between font-sans text-[9px] uppercase tracking-widest text-gray-400 -mt-3">
        <span>{leaningLabels['left']}</span>
        <span>{leaningLabels['center']}</span>
        <span>{leaningLabels['right']}</span>
      </div>

      {/* 5-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {SPECTRUM_ORDER.map((key) => (
          <SourceCard
            key={key}
            articles={spectrum[key] ?? []}
            spectrumKey={key}
            leaning={leaningLabels[key]}
            lang={lang}
          />
        ))}
      </div>
    </div>
  );
};
