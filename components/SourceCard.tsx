import React from 'react';
import { NewsSource } from '../types';
import { translations, Language } from '../translations';

interface SourceCardProps {
  source: NewsSource;
  leaning: string;
  lang: Language;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source, leaning, lang }) => {
  const t = translations[lang];
  
  // Determine styling based on leaning text
  const getLeaningStyles = (lean: string) => {
    const l = lean.toLowerCase();
    if (l.includes('left') || l.includes('links')) return 'border-l-4 border-red-500 bg-red-50/50';
    if (l.includes('right') || l.includes('rechts')) return 'border-l-4 border-slate-700 bg-slate-50/50';
    return 'border-l-4 border-blue-500 bg-blue-50/50'; // Default for center
  };

  const getLeaningBadge = (lean: string) => {
    const l = lean.toLowerCase();
    if (l.includes('left') || l.includes('links')) return 'bg-red-100 text-red-800';
    if (l.includes('right') || l.includes('rechts')) return 'bg-slate-200 text-slate-800';
    return 'bg-blue-100 text-blue-800'; // Default for center
  };

  return (
    <a 
      href={source.article_url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className={`block p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col ${getLeaningStyles(leaning)}`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${getLeaningBadge(leaning)}`}>
          {leaning}
        </span>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
          {source.source_name}
        </span>
      </div>
      
      <h4 className="serif text-lg font-bold text-gray-900 mb-2 leading-tight">
        {source.article_title}
      </h4>
      
      <p className="text-sm text-gray-600 mb-4 flex-grow line-clamp-4">
        {source.summary_of_perspective}
      </p>

      <div className="mt-auto pt-3 border-t border-gray-200/60 flex justify-between items-center text-xs">
        <span className="text-gray-500 font-medium text-gray-700">
          {source.publication_date || ''}
        </span>
        {source.url_is_search_fallback ? (
          <span className="text-slate-500 font-medium hover:underline text-xs">🔍 {t.searchArticle}</span>
        ) : (
          <span className="text-blue-600 font-medium hover:underline">{t.readArticle} →</span>
        )}
      </div>
    </a>
  );
};
