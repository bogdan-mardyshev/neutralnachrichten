import React, { useState, useRef } from 'react';
import { FetchStatus } from '../types';
import { translations, Language } from '../translations';

interface SearchBarProps {
  onSearch: (query: string) => void;
  status:   FetchStatus;
  lang:     Language;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, status, lang, inputRef }) => {
  const [query, setQuery]       = useState('');
  const [focused, setFocused]   = useState(false);
  const internalRef             = useRef<HTMLInputElement>(null);
  const ref                     = inputRef ?? internalRef;
  const t = translations[lang];
  const isLoading = status === 'loading';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      ref.current?.blur();
    }
  };

  return (
    <div className="w-full mb-6 sm:mb-8 animate-slide-up">
      <form onSubmit={handleSubmit}>
        <div
          className={`flex border-2 transition-all duration-200 ${
            focused
              ? 'border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a]'
              : 'border-[#1a1a1a]'
          }`}
        >
          <input
            ref={ref}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={isLoading}
            /* 16px on mobile to prevent iOS zoom */
            className="flex-1 px-4 py-4 sm:py-3.5 font-sans text-base sm:text-sm text-[#1a1a1a] bg-transparent placeholder-gray-400 focus:outline-none disabled:opacity-50"
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="press-scale bg-rose-600 text-white px-5 sm:px-6 py-4 sm:py-3.5 font-sans text-xs font-bold uppercase tracking-widest hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                <span className="hidden sm:inline">{t.searching}</span>
              </span>
            ) : (
              <>
                <span className="sm:hidden">→</span>
                <span className="hidden sm:inline">{t.searchButton}</span>
              </>
            )}
          </button>
        </div>
      </form>
      <p className="mt-2 font-sans text-[10px] uppercase tracking-widest text-gray-400 text-center">
        {t.realtimeAnalysis}
      </p>
    </div>
  );
};
