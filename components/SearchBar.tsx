import React, { useState } from 'react';
import { FetchStatus } from '../types';
import { translations, Language } from '../translations';

interface SearchBarProps {
  onSearch: (query: string) => void;
  status: FetchStatus;
  lang: Language;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, status, lang }) => {
  const [query, setQuery] = useState('');
  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const isLoading = status === 'loading';

  return (
    <div className="w-full mb-8">
      <form onSubmit={handleSubmit}>
        <div className="flex border-2 border-[#1a1a1a]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-3.5 font-sans text-sm text-[#1a1a1a] bg-transparent placeholder-gray-400 focus:outline-none disabled:opacity-50"
            placeholder={t.searchPlaceholder}
            required
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-rose-600 text-white px-6 py-3.5 font-sans text-xs font-bold uppercase tracking-widest hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isLoading ? t.searching : t.searchButton}
          </button>
        </div>
      </form>
      <p className="mt-2 font-sans text-[10px] uppercase tracking-widest text-gray-400 text-center">
        {t.realtimeAnalysis}
      </p>
    </div>
  );
};
