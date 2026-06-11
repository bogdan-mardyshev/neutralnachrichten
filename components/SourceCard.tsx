import React from 'react';
import { NewsSource } from '../types';
import { translations, Language } from '../translations';

interface SourceCardProps {
  source: NewsSource;
  leaning: string;
  lang: Language;
}

/** Only allow http(s) links — article URLs come from external RSS feeds, and an
 *  unvalidated scheme (javascript:, data:) in an <a href> would be a click-XSS. */
const safeHref = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url.trim()) ? url : undefined;
};

export const SourceCard: React.FC<SourceCardProps> = ({ source, leaning, lang }) => {
  const t = translations[lang];

  // Determine styling based on leaning text
  const getLeaningStyles = (lean: string) => {
    const l = lean.toLowerCase();
    if (l.includes('left') || l.includes('links'))
      return 'border-l-4 border-rose-600 bg-rose-50/40 dark:bg-rose-950/20';
    if (l.includes('right') || l.includes('rechts'))
      return 'border-l-4 border-blue-700 bg-slate-50/40 dark:bg-blue-950/20';
    return 'border-l-4 border-slate-400 bg-slate-50/30 dark:bg-[#1c1c1c]';
  };

  const getLeaningBadge = (lean: string) => {
    const l = lean.toLowerCase();
    if (l.includes('left') || l.includes('links'))
      return 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-400';
    if (l.includes('right') || l.includes('rechts'))
      return 'bg-slate-200 dark:bg-blue-950/60 text-slate-800 dark:text-blue-300';
    return 'bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-slate-400';
  };

  return (
    <a
      href={safeHref(source.article_url)}
      target="_blank"
      rel="noopener noreferrer"
      className={`block p-5 border border-[#e0d8cf] dark:border-[#252525] shadow-sm hover:shadow-md transition-shadow h-full flex flex-col ${getLeaningStyles(leaning)}`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`text-xs font-semibold px-2.5 py-0.5 ${getLeaningBadge(leaning)}`}>
          {leaning}
        </span>
        <div className="flex items-center gap-1.5">
          {source._tier === 'flagship' && (
            <span title={lang === 'de' ? 'Leitmedium' : lang === 'ru' ? 'Флагман' : 'Flagship outlet'}
                  className="text-[10px]">★</span>
          )}
          {source._factual && (() => {
            const F: Record<string, { c: string; de: string; en: string; ru: string }> = {
              high:  { c: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400', de: 'Faktentreue hoch',     en: 'High factuality',  ru: 'Высокая фактологичность' },
              mixed: { c: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',         de: 'Faktentreue gemischt', en: 'Mixed factuality', ru: 'Смешанная фактологичность' },
              low:   { c: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400',             de: 'Faktentreue niedrig',  en: 'Low factuality',   ru: 'Низкая фактологичность' },
            };
            const f = F[source._factual];
            return <span title={f[lang] ?? f.en} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${f.c}`}>{source._factual === 'high' ? '✓' : source._factual === 'mixed' ? '~' : '!'}</span>;
          })()}
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
            {source.source_name}
          </span>
        </div>
      </div>

      <h4 className="font-serif text-base font-bold text-[#1a1a1a] dark:text-[#f0ece4] mb-2 leading-tight">
        {source.article_title}
      </h4>

      <p className="font-sans text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow line-clamp-4">
        {source.summary_of_perspective}
      </p>

      <div className="mt-auto pt-3 border-t border-[#e0d8cf] dark:border-[#252525] flex justify-between items-center text-xs">
        <span className="font-sans text-gray-500 dark:text-gray-500 font-medium">
          {source.publication_date || ''}
        </span>
        {source.url_is_search_fallback ? (
          <span className="font-sans text-slate-500 dark:text-slate-400 font-medium hover:underline text-xs">🔍 {t.searchArticle}</span>
        ) : (
          <span className="font-sans text-rose-600 dark:text-rose-400 font-medium hover:underline">{t.readArticle} →</span>
        )}
      </div>
    </a>
  );
};
