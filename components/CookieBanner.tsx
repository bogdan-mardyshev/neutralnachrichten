import React from 'react';
import { Language, translations } from '../translations';

interface CookieBannerProps {
  lang: Language;
  onAccept: () => void;
  onEssential: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ lang, onAccept, onEssential }) => {
  const t = translations[lang];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 md:p-6 z-[100] animate-slide-up">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-slate-300">
          {t.cookieText}
        </p>
        <div className="flex gap-3 whitespace-nowrap">
          <button 
            onClick={onEssential}
            className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            {t.cookieEssential}
          </button>
          <button 
            onClick={onAccept}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            {t.cookieAccept}
          </button>
        </div>
      </div>
    </div>
  );
};
