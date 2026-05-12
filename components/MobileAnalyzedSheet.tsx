import React, { useEffect, useRef } from 'react';
import { Language } from '../translations';
import { PublicAnalyses } from './PublicAnalyses';

interface Props {
  open:          boolean;
  onClose:       () => void;
  lang:          Language;
  onSelect:      (topic: string, lang: Language) => void;
  recentSearches?: string[];
  authToken?:    string | null;
}

const L = {
  de: 'Bereits analysiert',
  en: 'Already analyzed',
  ru: 'Уже проанализировано',
};

export function MobileAnalyzedSheet({ open, onClose, lang, onSelect, recentSearches, authToken }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY   = useRef(0);
  const currentY = useRef(0);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };
  const handleTouchEnd = () => {
    const delta = currentY.current - startY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
    if (delta > 80) onClose();
  };

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="sm:hidden fixed inset-0 z-50 sheet-overlay animate-fade-in"
      onClick={handleBackdrop}
    >
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-[#FFF8F0] rounded-t-2xl border-t-2 border-[#1a1a1a] animate-sheet-up overflow-hidden"
        style={{
          maxHeight: '85vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transition: 'transform 0.25s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Spectrum strip */}
        <div className="h-[3px] flex">
          <div className="flex-1 bg-rose-600" />
          <div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" />
          <div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#e0d8cf] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0d8cf]">
          <h2 className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a]">
            {L[lang]}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#1a1a1a] text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 100px)' }}>
          <div className="p-0">
            <PublicAnalyses
              lang={lang}
              onSelect={(topic, l) => { onSelect(topic, l); onClose(); }}
              recentSearches={recentSearches}
              authToken={authToken}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
