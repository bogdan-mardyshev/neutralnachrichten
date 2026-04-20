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
    <div className="w-full max-w-2xl mx-auto mb-12">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
          </svg>
        </div>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          className="block w-full p-4 pl-12 text-lg text-gray-900 border border-gray-300 rounded-full bg-white shadow-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none disabled:bg-gray-100 placeholder-gray-400" 
          placeholder={t.searchPlaceholder} 
          required 
        />
        <button 
          type="submit" 
          disabled={isLoading || !query.trim()}
          className="absolute right-2.5 bottom-2.5 text-white bg-slate-900 hover:bg-slate-800 focus:ring-4 focus:outline-none focus:ring-slate-300 font-medium rounded-full text-sm px-6 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? t.searching : t.searchButton}
        </button>
      </form>
      <p className="mt-3 text-sm text-gray-500 text-center">
        {t.realtimeAnalysis}
      </p>
    </div>
  );
};