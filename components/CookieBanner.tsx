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
    <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] text-white p-4 md:p-6 z-[100] animate-slide-up border-t-2 border-[#2d2d2d]">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-sans text-xs text-white/70">
          {t.cookieText}
        </p>
        <div className="flex gap-3 whitespace-nowrap">
          <button
            onClick={onEssential}
            className="font-sans text-[10px] uppercase tracking-widest text-white/40 hover:text-white/80 transition-colors"
          >
            {t.cookieEssential}
          </button>
          <button
            onClick={onAccept}
            className="font-sans text-[10px] uppercase tracking-widest bg-white text-[#1a1a1a] px-5 py-2 hover:bg-[#f0ece4] transition-colors"
          >
            {t.cookieAccept}
          </button>
        </div>
      </div>
    </div>
  );
};
