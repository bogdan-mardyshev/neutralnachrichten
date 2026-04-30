import React, { useEffect, useState } from 'react';
import { NewsAnalysisResult } from '../types';
import { SpectrumGrid } from './SpectrumGrid';
import { BiasBar } from './BiasBar';
import { BlindspotBanner } from './BlindspotBanner';
import { ShareButtons } from './ShareButtons';
import { DeepAnalysisBlock } from './DeepAnalysisBlock';
import { HypeCounter } from './HypeCounter';
import { translations, Language } from '../translations';

// ── Rotating status messages ───────────────────────────────────────────────────
const LOADING_MSGS: Record<Language, string[]> = {
  de: ['Quellen werden verglichen…', 'Politische Perspektiven werden analysiert…', 'Unterschiede werden herausgearbeitet…', 'Blind Spots werden identifiziert…', 'Zusammenfassung wird erstellt…'],
  en: ['Comparing sources…', 'Analysing political perspectives…', 'Finding where they diverge…', 'Spotting blind spots…', 'Putting it all together…'],
  ru: ['Сравниваем источники…', 'Анализируем политические перспективы…', 'Ищем расхождения…', 'Выявляем слепые пятна…', 'Формируем итог…'],
};

type Translations = (typeof translations)[Language];

// ── Deep Analysis Skeleton — Newspaper style ──────────────────────────────────
const SKEL_SECTIONS = [
  { label: 'sharedFactsTitle',  accent: '#1a1a1a' },
  { label: 'divergingTitle',    accent: '#1a1a1a' },
  { label: 'silencedTitle',     accent: '#1a1a1a' },
] as const;

const DeepAnalysisSkeleton: React.FC<{ lang: Language; t: Translations }> = ({ lang, t }) => {
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const msgs = LOADING_MSGS[lang];
  const da = t.deepAnalysis;

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setMsgIdx(i => (i + 1) % msgs.length); setVisible(true); }, 300);
    }, 2200);
    return () => clearInterval(id);
  }, [msgs.length]);

  return (
    <div className="space-y-0 border-2 border-[#1a1a1a] overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-5 py-3 flex items-center justify-between">
        <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{da.title}</span>
        <span
          className="font-sans text-[10px] text-white/50 transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {msgs[msgIdx]}
        </span>
      </div>

      {SKEL_SECTIONS.map((s, i) => (
        <div key={i} className="border-b border-[#e0d8cf] last:border-0 px-5 py-4 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-3 bg-[#e0d8cf] rounded w-40" />
            <div className="h-3 bg-[#e0d8cf] rounded w-5" />
          </div>
          <div className="space-y-2">
            <div className="h-2.5 bg-[#e8e0d5] rounded w-full" />
            <div className="h-2.5 bg-[#e8e0d5] rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
interface AnalysisDashboardProps {
  data: NewsAnalysisResult;
  lang: Language;
  deepLoading?: boolean;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ data, lang, deepLoading }) => {
  const t = translations[lang];
  const { news_spectrum, overall_non_partisan_analysis, analysis_topic } = data;

  return (
    <div className="animate-fade-in space-y-8">

      {/* Degraded warning — newspaper style */}
      {data._meta?.degraded && (
        <div className="border-l-4 border-amber-600 bg-amber-50 px-5 py-3">
          <p className="font-sans text-xs text-amber-800">{t.degraded_warning}</p>
        </div>
      )}

      {/* ── Header + Fact Check ── */}
      <div className="border-2 border-[#1a1a1a] overflow-hidden">
        {/* Black header with topic */}
        <div className="bg-[#1a1a1a] px-6 py-5">
          <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">{t.topic}</p>
          <h2 className="font-serif font-black text-2xl md:text-3xl text-white capitalize leading-tight">
            {analysis_topic}
          </h2>
        </div>

        {/* Fact check */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-emerald-500" />
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">{t.factCheck}</p>
          </div>
          <p className="font-serif text-base text-[#1a1a1a] leading-relaxed border-l-2 border-emerald-400 pl-4">
            {overall_non_partisan_analysis}
          </p>
        </div>
      </div>

      {/* ── Spectrum Grid ── */}
      <SpectrumGrid spectrum={news_spectrum} lang={lang} />

      {/* ── Hype Counter ── */}
      {data.coverage_distribution && (
        <HypeCounter coverage={data.coverage_distribution} topic={analysis_topic} lang={lang} />
      )}

      {/* ── Bias Bar ── */}
      {data.coverage_distribution && (
        <BiasBar coverage={data.coverage_distribution} lang={lang} />
      )}

      {/* ── Blindspot Banner ── */}
      {data.coverage_distribution && (
        <BlindspotBanner
          coverage={data.coverage_distribution}
          news_spectrum={data.news_spectrum}
          topic={analysis_topic}
          lang={lang}
        />
      )}

      {/* ── Deep Analysis Skeleton ── */}
      {deepLoading && <DeepAnalysisSkeleton lang={lang} t={t} />}

      {/* ── Deep Analysis Block ── */}
      {!deepLoading && data.deep_analysis && (
        data.deep_analysis.shared_facts?.length > 0 ||
        data.deep_analysis.diverging_points?.length > 0 ||
        data.deep_analysis.silenced_topics?.length > 0
      ) && (
        <DeepAnalysisBlock data={data.deep_analysis} lang={lang} />
      )}

      {/* ── Share ── */}
      <div className="border-t-2 border-[#1a1a1a] pt-6">
        <ShareButtons topic={analysis_topic} lang={lang} />
      </div>
    </div>
  );
};
