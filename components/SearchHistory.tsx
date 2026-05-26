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
    <div className="flex items-center gap-3 mt-3 mb-6 flex-wrap">
      <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 shrink-0">
        {t.searchHistory.label}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {history.map((entry, i) => (
          <button
            key={i}
            onClick={() => onSelect(entry.topic)}
            className="font-sans text-xs px-2.5 py-1 border border-gray-300 dark:border-[#2d2d2d] text-gray-600 dark:text-gray-400 hover:border-[#1a1a1a] dark:hover:border-[#f0ece4] hover:text-[#1a1a1a] dark:hover:text-[#f0ece4] transition-colors"
          >
            {entry.topic}
          </button>
        ))}
        <button
          onClick={onClear}
          className="font-sans text-[10px] text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors uppercase tracking-wider"
          title={t.searchHistory.clear}
        >
          × {t.searchHistory.clear}
        </button>
      </div>
    </div>
  );
};
