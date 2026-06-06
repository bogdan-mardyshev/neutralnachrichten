import React, { useState } from 'react';
import { NewsSource, RssArticle, SpectrumKey } from '../types';
import { Language, translations } from '../translations';

interface SpectrumGridProps {
  spectrum: Record<SpectrumKey, NewsSource[]>;
  rssSpectra?: Record<SpectrumKey, RssArticle[]>;
  lang: Language;
  analysisLoading?: boolean;
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

// ── Merge Gemini articles (with AI summaries) + RSS articles (real URLs) ───────
// Gemini articles come first (they have proper perspective summaries).
// RSS articles for outlets not yet in Gemini's selection are appended.
function mergeArticles(
  geminiArticles: NewsSource[],
  rssArticles: RssArticle[]
): NewsSource[] {
  const isPlaceholder = (a: NewsSource) =>
    a.source_name === 'Kein Artikel gefunden' || a.source_domain === 'n/a';
  // Canonical URL key — strips protocol/www/query/trailing slash so the same
  // article never appears twice (analyzed copy + raw copy) regardless of variant.
  const urlKey = (u?: string) =>
    (u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

  const merged: NewsSource[] = [];
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  // 1. Real Gemini articles first — they have AI-generated perspective summaries
  for (const a of geminiArticles) {
    if (isPlaceholder(a)) continue;
    merged.push(a);
    if (a.source_domain) seenDomains.add(a.source_domain.replace(/^www\./, ''));
    const uk = urlKey(a.article_url); if (uk) seenUrls.add(uk);
  }

  // 2. RSS articles from additional outlets not already covered by Gemini
  for (const r of rssArticles) {
    if (!r.article_url) continue;
    const dom = (r.source_domain || '').replace(/^www\./, '');
    if (seenUrls.has(urlKey(r.article_url))) continue; // same article already shown (analyzed)
    if (seenDomains.has(dom)) continue; // outlet already represented
    merged.push({
      source_name:            r.source_name,
      source_domain:          r.source_domain,
      article_title:          r.article_title,
      article_url:            r.article_url,
      summary_of_perspective: r.description || r.article_title,
      publication_date:       r.pub_date || undefined,
      url_is_search_fallback: false,
    });
    seenDomains.add(dom);
    const uk = urlKey(r.article_url); if (uk) seenUrls.add(uk);
  }

  // Fall back to original list if nothing merged (edge case)
  return merged.length > 0 ? merged : geminiArticles;
}

interface SourceCardProps {
  articles: NewsSource[];
  rssArticles?: RssArticle[];
  spectrumKey: SpectrumKey;
  leaning: string;
  lang: Language;
  analysisLoading?: boolean;
}

const SourceCard: React.FC<SourceCardProps> = ({ articles, rssArticles, spectrumKey, leaning, lang, analysisLoading }) => {
  const t = translations[lang];
  const s = spectrumStyles[spectrumKey];
  const [idx, setIdx] = useState(0);

  const source = articles[idx];
  const total = articles.length;

  // Find raw RSS description for the current article (only when it differs from AI summary)
  const rssSnippet = (() => {
    if (!rssArticles || !source) return null;
    const dom = (source.source_domain || '').replace(/^www\./, '');
    const match = rssArticles.find(r => (r.source_domain || '').replace(/^www\./, '') === dom);
    if (!match?.description) return null;
    // Don't show if it's already the summary (pure-RSS cards reuse description as summary)
    if (match.description === source.summary_of_perspective) return null;
    return match.description;
  })();

  if (!source) {
    return (
      <div className={`group flex flex-col bg-white dark:bg-[#1e1a14] rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm ${s.card} overflow-hidden min-h-[200px] items-center justify-center p-4`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center">{t.noData ?? '—'}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-[#FFF8F0] dark:bg-[#1e1a14] border border-[#e0d8cf] dark:border-gray-700 ${s.card} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className={`font-sans text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border ${s.badge}`}>
            {leaning}
          </span>
          <span className="font-sans text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate max-w-[100px]">
            {source.source_name}
          </span>
        </div>

        <a
          href={source.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <h4 className="font-serif font-bold text-[#1a1a1a] dark:text-[#f0ece4] text-sm leading-snug mb-2 line-clamp-3 hover:opacity-70 transition-opacity">
            {source.article_title}
          </h4>
        </a>
      </div>

      {/* AI Summary */}
      <div className="px-4 pb-3 flex-grow">
        {analysisLoading ? (
          <div className="space-y-1.5 animate-pulse">
            <div className="h-2 bg-[#e0d8cf] dark:bg-gray-700 rounded w-full" />
            <div className="h-2 bg-[#e0d8cf] dark:bg-gray-700 rounded w-5/6" />
            <div className="h-2 bg-[#e0d8cf] dark:bg-gray-700 rounded w-4/5" />
            <div className="h-2 bg-[#e0d8cf] dark:bg-gray-700 rounded w-3/4" />
          </div>
        ) : (
          <p className="font-sans text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-4">
            {source.summary_of_perspective}
          </p>
        )}
      </div>

      {/* RSS Snippet — real article text for verification */}
      {!analysisLoading && rssSnippet && (
        <div className="mx-4 mb-3 px-3 py-2 bg-[#f5f0e8] dark:bg-[#1a1510] border border-[#e0d8cf] dark:border-gray-700">
          <p className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
            {t.rssSnippetLabel}
          </p>
          <p className="font-sans text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-3 italic">
            {rssSnippet}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#e0d8cf] dark:border-gray-700 mt-auto">
        <div className="flex items-center justify-between">
          <span className="font-sans text-[10px] text-gray-400 dark:text-gray-500">
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

        {/* Carousel nav — shown when multiple articles */}
        {total > 1 && (
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#e0d8cf] dark:border-gray-700">
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="w-6 h-6 border border-[#1a1a1a] dark:border-gray-600 disabled:opacity-20 disabled:cursor-default font-sans text-xs flex items-center justify-center hover:bg-[#1a1a1a] dark:hover:bg-gray-600 hover:text-white dark:text-gray-300 transition-colors"
            >
              ‹
            </button>
            <span className="font-sans text-[10px] text-gray-400 dark:text-gray-500 tracking-wider">
              {idx + 1} / {total}
            </span>
            <button
              onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
              disabled={idx === total - 1}
              className="w-6 h-6 border border-[#1a1a1a] dark:border-gray-600 disabled:opacity-20 disabled:cursor-default font-sans text-xs flex items-center justify-center hover:bg-[#1a1a1a] dark:hover:bg-gray-600 hover:text-white dark:text-gray-300 transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const SpectrumGrid: React.FC<SpectrumGridProps> = ({ spectrum, rssSpectra, lang, analysisLoading }) => {
  const t = translations[lang];

  const leaningLabels: Record<SpectrumKey, string> = {
    left: t.leaningLeft,
    center_left: t.leaningCenterLeft,
    center: t.leaningCenter,
    center_right: t.leaningCenterRight,
    right: t.leaningRight,
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center gap-3">
        <h3 className="font-serif font-black text-xl text-[#1a1a1a] dark:text-white shrink-0">{t.analyzedSources}</h3>
        <div className="h-px flex-1 bg-[#1a1a1a] dark:bg-gray-600 opacity-15 dark:opacity-100" />
        {analysisLoading && (
          <span className="font-sans text-[9px] uppercase tracking-widest text-emerald-600 animate-pulse shrink-0">
            {t.analysisLoading}
          </span>
        )}
      </div>

      {/* Spectrum bar — colors only, no duplicate text labels */}
      <div className="flex gap-px overflow-hidden h-1.5">
        {SPECTRUM_ORDER.map((key) => (
          <div key={key} className={`flex-1 ${spectrumStyles[key].bar}`} />
        ))}
      </div>

      {/* Mobile: horizontal scroll-snap carousel */}
      <div className="sm:hidden">
        <div className="spectrum-scroll -mx-4 px-4">
          {SPECTRUM_ORDER.map((key, i) => (
            <div
              key={key}
              className={`animate-slide-up stagger-${i + 1}`}
              style={{ width: 'calc(85vw)', maxWidth: 320 }}
            >
              <SourceCard
                articles={mergeArticles(spectrum[key] ?? [], rssSpectra?.[key] ?? [])}
                rssArticles={rssSpectra?.[key]}
                spectrumKey={key}
                leaning={leaningLabels[key]}
                lang={lang}
                analysisLoading={analysisLoading}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {SPECTRUM_ORDER.map((key, i) => (
          <div key={key} className={`animate-slide-up stagger-${i + 1}`}>
            <SourceCard
              articles={mergeArticles(spectrum[key] ?? [], rssSpectra?.[key] ?? [])}
              rssArticles={rssSpectra?.[key]}
              spectrumKey={key}
              leaning={leaningLabels[key]}
              lang={lang}
              analysisLoading={analysisLoading}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
