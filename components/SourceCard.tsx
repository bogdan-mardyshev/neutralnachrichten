import React from 'react';
import { Source } from '../types';
import { translations, Language } from '../translations';

interface SourceCardProps {
  source: Source;
  lang: Language;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source, lang }) => {
  const t = translations[lang];
  // Determine styling based on spectrum
  const getSpectrumStyles = (spectrum: string) => {
    const s = spectrum.toLowerCase();
    if (s.includes('left') || s.includes('links')) return 'border-l-4 border-red-500 bg-red-50/50';
    if (s.includes('right') || s.includes('rechts')) return 'border-l-4 border-slate-700 bg-slate-50/50';
    if (s.includes('center') || s.includes('mitte')) return 'border-l-4 border-blue-500 bg-blue-50/50';
    return 'border-l-4 border-gray-400 bg-gray-50';
  };

  const getSpectrumBadge = (spectrum: string) => {
    const s = spectrum.toLowerCase();
    if (s.includes('left') || s.includes('links')) return 'bg-red-100 text-red-800';
    if (s.includes('right') || s.includes('rechts')) return 'bg-slate-200 text-slate-800';
    if (s.includes('center') || s.includes('mitte')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <a 
      href={source.url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className={`block p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col ${getSpectrumStyles(source.spectrum)}`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${getSpectrumBadge(source.spectrum)}`}>
          {source.spectrum}
        </span>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
          {source.outlet_name}
        </span>
      </div>
      
      <h4 className="serif text-lg font-bold text-gray-900 mb-2 leading-tight">
        {source.headline}
      </h4>
      
      <p className="text-sm text-gray-600 mb-4 flex-grow">
        {source.summary}
      </p>

      <div className="mt-auto pt-3 border-t border-gray-200/60 flex justify-between items-center text-xs">
        <span className="text-gray-500">{t.sourceTone}: <span className="font-medium text-gray-700">{source.tone}</span></span>
        <span className="text-blue-600 font-medium hover:underline">→</span>
      </div>
    </a>
  );
};