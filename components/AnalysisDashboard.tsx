import React, { useEffect, useState } from 'react';
import { NewsAnalysisResult } from '../types';
import { SpectrumGrid } from './SpectrumGrid';
import { BiasBar } from './BiasBar';
import { BlindspotBanner } from './BlindspotBanner';
import { ShareButtons } from './ShareButtons';
import { DeepAnalysisBlock } from './DeepAnalysisBlock';
import { translations, Language } from '../translations';

// ── Deep Analysis Loading Skeleton ────────────────────────────────────────────

const SECTIONS = [
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    bar: 'from-emerald-400 to-emerald-200',
    border: 'border-emerald-100',
    titleKey: 'sharedFactsTitle' as const,
    descKey:  'sharedFactsDesc'  as const,
    lines: [3, 4],
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    ),
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    bar: 'from-amber-400 to-amber-200',
    border: 'border-amber-100',
    titleKey: 'divergingTitle' as const,
    descKey:  'divergingDesc'  as const,
    lines: [5, 3, 4],
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    ),
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    bar: 'from-red-400 to-red-200',
    border: 'border-red-100',
    titleKey: 'silencedTitle' as const,
    descKey:  'silencedDesc'  as const,
    lines: [3, 4],
  },
] as const;

// Rotating status messages while waiting
const LOADING_MSGS: Record<Language, string[]> = {
  de: [
    'Quellen werden verglichen…',
    'Politische Perspektiven werden analysiert…',
    'Unterschiede werden herausgearbeitet…',
    'Blind Spots werden identifiziert…',
    'Zusammenfassung wird erstellt…',
  ],
  en: [
    'Comparing sources…',
    'Analysing political perspectives…',
    'Finding where they diverge…',
    'Spotting blind spots…',
    'Putting it all together…',
  ],
  ru: [
    'Сравниваем источники…',
    'Анализируем политические перспективы…',
    'Ищем расхождения…',
    'Выявляем слепые пятна…',
    'Формируем итог…',
  ],
};

type Translations = (typeof translations)[Language];
const DeepAnalysisSkeleton: React.FC<{ lang: Language; t: Translations }> = ({ lang, t }) => {
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const msgs = LOADING_MSGS[lang];
  const da = t.deepAnalysis;

  // Cycle status messages with fade
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % msgs.length);
        setVisible(true);
      }, 300);
    }, 2200);
    return () => clearInterval(id);
  }, [msgs.length]);

  return (
    <div className="space-y-3">

      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-500 via-amber-400 to-red-500" />
          <span className="text-lg font-bold text-gray-900">{da.title}</span>
        </div>
        {/* Spinning loader dot */}
        <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin inline-block" />
          <span
            className="transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {msgs[msgIdx]}
          </span>
        </span>
      </div>

      {/* Three section skeletons */}
      {SECTIONS.map((s, i) => (
        <div
          key={i}
          className={`bg-white rounded-xl border ${s.border} shadow-sm overflow-hidden`}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Header row */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full ${s.iconBg} ${s.iconColor} flex items-center justify-center shrink-0`}>
                {s.icon}
              </span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-sm">{da[s.titleKey]}</span>
                  {/* Count badge skeleton */}
                  <span className={`inline-block w-5 h-4 rounded-full ${s.iconBg} animate-pulse`} />
                </div>
                <span className="text-xs text-gray-400">{da[s.descKey]}</span>
              </div>
            </div>
            {/* Chevron placeholder */}
            <span className="w-5 h-5 rounded bg-gray-100 animate-pulse" />
          </div>

          {/* Content lines skeleton */}
          <div className={`border-t ${s.border} px-4 py-3 space-y-2.5`}>
            {s.lines.map((w, li) => (
              <div
                key={li}
                className="h-3 bg-gray-100 rounded animate-pulse"
                style={{
                  width: `${w * 16}%`,
                  animationDelay: `${i * 150 + li * 80}ms`,
                }}
              />
            ))}
          </div>

          {/* Bottom shimmer bar */}
          <div className="h-0.5 bg-gray-50 overflow-hidden">
            <div
              className={`h-full w-1/3 bg-gradient-to-r ${s.bar} opacity-60 animate-[shimmer_2s_ease-in-out_infinite]`}
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

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

      {/* 5-Spectrum Grid (sources + summaries) */}
      <SpectrumGrid spectrum={news_spectrum} lang={lang} />

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

      {/* Deep Analysis — loading skeleton */}
      {deepLoading && <DeepAnalysisSkeleton lang={lang} t={t} />}

      {!deepLoading && data.deep_analysis && (
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
