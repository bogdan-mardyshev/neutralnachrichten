import React from 'react';
import { NewsAnalysisResult } from '../types';
import { SourceCard } from './SourceCard';
import { BiasBar } from './BiasBar';
import { BlindspotBanner } from './BlindspotBanner';
import { translations, Language } from '../translations';

interface AnalysisDashboardProps {
  data: NewsAnalysisResult;
  lang: Language;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ data, lang }) => {
  const t = translations[lang];
  const { news_spectrum, overall_non_partisan_analysis, analysis_topic } = data;

  return (
    <div className="animate-fade-in space-y-8">

      {data._meta?.degraded && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-md text-sm">
          {t.degraded_warning}
        </div>
      )}

      {/* Header & Fact Check */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 md:p-8">
          <div className="uppercase tracking-widest text-xs font-semibold text-slate-400 mb-2">{t.topic}</div>
          <h2 className="serif text-3xl md:text-4xl font-bold capitalize">{analysis_topic}</h2>
        </div>
        <div className="p-6 md:p-8">
          <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wide mb-2 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {t.factCheck}
          </h3>
          <p className="text-lg text-gray-700 leading-relaxed border-l-4 border-emerald-500 pl-4">
            {overall_non_partisan_analysis}
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
            {news_spectrum.left.summary_of_perspective}
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
            {news_spectrum.right.summary_of_perspective}
          </p>
        </div>
      </div>

      {/* Bias Bar */}
      {data.coverage_distribution && (
        <BiasBar coverage={data.coverage_distribution} lang={lang} />
      )}

      {/* Blindspot Banner */}
      {data.coverage_distribution && (
        <BlindspotBanner
          coverage={data.coverage_distribution}
          topic={analysis_topic}
          lang={lang}
        />
      )}

      {/* Sources Grid */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 px-2">{t.analyzedSources}</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <SourceCard source={news_spectrum.left} leaning={t.leaningLeft} lang={lang} />
          <SourceCard source={news_spectrum.center} leaning={t.leaningCenter} lang={lang} />
          <SourceCard source={news_spectrum.right} leaning={t.leaningRight} lang={lang} />
        </div>
      </div>
    </div>
  );
};
