import React from 'react';
import { NewsAnalysisResult } from '../types';
import { ThreeColumnComparison } from './ThreeColumnComparison';
import { BiasBar } from './BiasBar';
import { BlindspotBanner } from './BlindspotBanner';
import { ShareButtons } from './ShareButtons';
import { DeepAnalysisBlock } from './DeepAnalysisBlock';
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

      {/* 3-Column Comparison (sources + summaries) */}
      <ThreeColumnComparison
        left={news_spectrum.left}
        center={news_spectrum.center}
        right={news_spectrum.right}
        lang={lang}
      />

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

      {/* Deep Analysis */}
      {data.deep_analysis && (
        data.deep_analysis.shared_facts?.length > 0 ||
        data.deep_analysis.diverging_points?.length > 0 ||
        data.deep_analysis.silenced_topics?.length > 0
      ) && (
        <DeepAnalysisBlock data={data.deep_analysis} lang={lang} />
      )}

      {/* Share */}
      <div className="border-t border-gray-100 pt-6">
        <ShareButtons topic={analysis_topic} lang={lang} />
      </div>
    </div>
  );
};
