import React from 'react';
import { NewsAnalysisResult } from '../types';
import { SourceCard } from './SourceCard';
import { translations, Language } from '../translations';

interface AnalysisDashboardProps {
  data: NewsAnalysisResult;
  lang: Language;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ data, lang }) => {
  const t = translations[lang];

  return (
    <div className="animate-fade-in space-y-8">

      {/* Header & Fact Check */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 md:p-8">
          <div className="uppercase tracking-widest text-xs font-semibold text-slate-400 mb-2">{t.topic}</div>
          <h2 className="serif text-3xl md:text-4xl font-bold">{data.topic_title}</h2>
        </div>
        <div className="p-6 md:p-8">
          <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wide mb-2 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {t.factCheck}
          </h3>
          <p className="text-lg text-gray-700 leading-relaxed border-l-4 border-emerald-500 pl-4">
            {data.fact_check_summary}
          </p>
        </div>
      </div>

      {/* Narrative Split */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Narrative */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-red-500">
          <div className="flex items-center mb-4">
            <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 mr-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </span>
            <h3 className="font-bold text-gray-900 text-lg">{t.narrativeLeft}</h3>
          </div>
          <p className="text-gray-600 leading-relaxed">
            {data.analysis.left_narrative}
          </p>
        </div>

        {/* Right Narrative */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-slate-700">
           <div className="flex items-center mb-4 justify-end md:flex-row-reverse">
            <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-800 ml-0 md:ml-3 mr-3 md:mr-0">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </span>
            <h3 className="font-bold text-gray-900 text-lg">{t.narrativeRight}</h3>
          </div>
          <p className="text-gray-600 leading-relaxed text-left md:text-right">
            {data.analysis.right_narrative}
          </p>
        </div>
      </div>

      {/* Blindspot Alert */}
      <div className="bg-amber-50 rounded-xl p-6 border border-amber-200 flex items-start gap-4">
        <div className="flex-shrink-0 pt-1">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <div>
          <h3 className="font-bold text-amber-800 mb-1">{t.blindspotTitle}</h3>
          <p className="text-amber-900 mb-2 italic">"{data.analysis.bias_verdict}"</p>
          <p className="text-sm text-amber-800/80">
            <span className="font-bold">{t.blindspotWarning} </span>
            {data.analysis.blindspot_alert}
          </p>
        </div>
      </div>

      {/* Sources Grid */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 px-2">{t.analyzedSources}</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {data.sources.map((source, index) => (
            <SourceCard key={index} source={source} lang={lang} />
          ))}
        </div>
      </div>
    </div>
  );
};