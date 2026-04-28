import React from 'react';
import { HistoryEntry } from '../hooks/useSearchHistory';
import { Language, translations } from '../translations';

interface SearchHistoryProps {
  history: HistoryEntry[];
  onSelect: (topic: string) => void;
  onClear: () => void;
  lang: Language;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({ history, onSelect, onClear, lang }) => {
  const t = translations[lang];
  if (history.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold shrink-0">
        {t.searchHistory.label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {history.map((entry, i) => (
          <button
            key={i}
            onClick={() => onSelect(entry.topic)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all duration-150 border border-transparent hover:border-slate-300"
          >
            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {entry.topic}
          </button>
        ))}
        <button
          onClick={onClear}
          className="text-xs text-gray-300 hover:text-red-400 transition-colors px-1"
          title={t.searchHistory.clear}
        >
          × {t.searchHistory.clear}
        </button>
      </div>
    </div>
  );
};
