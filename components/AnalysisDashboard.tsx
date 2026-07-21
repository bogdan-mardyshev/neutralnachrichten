import React, { useEffect, useRef, useState } from 'react';
import { NewsAnalysisResult } from '../types';
import { SpectrumGrid } from './SpectrumGrid';
import { BiasBar } from './BiasBar';
import { BlindspotBanner } from './BlindspotBanner';
import { ShareButtons } from './ShareButtons';
import { DeepAnalysisBlock } from './DeepAnalysisBlock';
import { HypeCounter } from './HypeCounter';
import { ReliabilityPanel } from './ReliabilityPanel';
import { DeepInsights } from './DeepInsights';

// ── Balance feedback (audit D5): the perceived-balance loop ─────────────────────
const FEEDBACK_T = {
  de: { q: 'War diese Analyse ausgewogen?', yes: 'Ja', no: 'Nein', thanks: 'Danke für dein Feedback!' },
  en: { q: 'Was this analysis balanced?', yes: 'Yes', no: 'No', thanks: 'Thanks for your feedback!' },
  ru: { q: 'Этот разбор был сбалансированным?', yes: 'Да', no: 'Нет', thanks: 'Спасибо за отзыв!' },
} as const;

const BalanceFeedback: React.FC<{ topic: string; lang: Language }> = ({ topic, lang }) => {
  const [voted, setVoted] = useState<null | 'up' | 'down'>(null);
  const ft = FEEDBACK_T[lang as keyof typeof FEEDBACK_T] ?? FEEDBACK_T.de;
  const vote = (verdict: 'up' | 'down') => {
    setVoted(verdict);
    fetch(`${import.meta.env.VITE_API_BASE || ''}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, lang, verdict }),
    }).catch(() => {});
  };
  return (
    <div className="flex items-center justify-center gap-3 py-3 border border-[#e0d8cf] dark:border-[#252525] bg-white dark:bg-[#1c1c1c]">
      {voted ? (
        <p className="font-sans text-xs text-emerald-600 dark:text-emerald-400">✓ {ft.thanks}</p>
      ) : (
        <>
          <span className="font-sans text-xs text-gray-500 dark:text-gray-400">{ft.q}</span>
          <button onClick={() => vote('up')} className="font-sans text-xs px-3 py-1 border border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded">👍 {ft.yes}</button>
          <button onClick={() => vote('down')} className="font-sans text-xs px-3 py-1 border border-rose-400 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded">👎 {ft.no}</button>
        </>
      )}
    </div>
  );
};
import { translations, Language } from '../translations';

// ── Sources known to be analysed (fixed list, matches rssSearch.js feeds) ─────
const SOURCES_TICKER = [
  'taz', 'nd-aktuell', 'Junge Welt',
  'Spiegel', 'Süddeutsche Zeitung', 'Die Zeit', 'Tagesspiegel',
  'Tagesschau', 'ZDF heute', 'Deutschlandfunk',
  'FAZ', 'Die Welt', 'Focus', 'NTV', 'Handelsblatt',
  'Bild', 'Junge Freiheit', 'Tichys Einblick',
];

const SPECTRUM_LABELS: Record<string, Record<Language, string>> = {
  left:         { de: 'Linke Medien',        en: 'Left media',        ru: 'Левые СМИ' },
  center_left:  { de: 'Mitte-Links Medien',   en: 'Center-left media', ru: 'Центрально-левые СМИ' },
  center:       { de: 'Zentristische Medien', en: 'Centrist media',    ru: 'Центристские СМИ' },
  center_right: { de: 'Mitte-Rechts Medien',  en: 'Center-right media',ru: 'Центрально-правые СМИ' },
  right:        { de: 'Rechte Medien',        en: 'Right media',       ru: 'Правые СМИ' },
};

function useSourceTicker(active: boolean) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIdx(i => (i + 1) % SOURCES_TICKER.length), 650);
    return () => clearInterval(id);
  }, [active]);
  return SOURCES_TICKER[idx];
}

function useCountdown(active: boolean, from: number) {
  const [rem, setRem] = useState(from);
  useEffect(() => {
    if (!active) { setRem(from); return; }
    setRem(from);
    const id = setInterval(() => setRem(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return rem;
}

function useTypewriter(text: string, msPerChar = 12) {
  const [displayed, setDisplayed] = useState('');
  const prevRef = useRef('');
  useEffect(() => {
    if (!text) { setDisplayed(''); prevRef.current = ''; return; }
    if (text === prevRef.current) return;
    prevRef.current = text;
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, msPerChar);
    return () => clearInterval(id);
  }, [text]);
  return text ? displayed : '';
}

function getInsights(
  coverage: NewsAnalysisResult['coverage_distribution'],
  lang: Language,
): string[] {
  if (!coverage) return [];
  const order = ['left', 'center_left', 'center', 'center_right', 'right'] as const;
  const counts = order.map(s => ({ s, count: (coverage[s] as any)?.count ?? 0 }));
  const total = counts.reduce((a, b) => a + b.count, 0);
  if (total === 0) return [];

  const insights: string[] = [];

  if (lang === 'de') insights.push(`${total} Artikel aus 33 deutschen Medien analysiert`);
  else if (lang === 'en') insights.push(`${total} articles found across 33 German outlets`);
  else insights.push(`Найдено ${total} статей в 33 немецких изданиях`);

  const withArticles = counts.filter(x => x.count > 0);
  if (withArticles.length >= 2) {
    const max = withArticles.reduce((a, b) => b.count > a.count ? b : a);
    const min = withArticles.reduce((a, b) => b.count < a.count ? b : a);
    if (max.count >= min.count * 2 && max.s !== min.s) {
      const ratio = (max.count / min.count).toFixed(1);
      const maxName = SPECTRUM_LABELS[max.s]?.[lang] ?? max.s;
      const minName = SPECTRUM_LABELS[min.s]?.[lang] ?? min.s;
      if (lang === 'de') insights.push(`${maxName} berichten ${ratio}× häufiger als ${minName}`);
      else if (lang === 'en') insights.push(`${maxName} cover this ${ratio}× more than ${minName}`);
      else insights.push(`${maxName} пишут в ${ratio}× раз чаще, чем ${minName}`);
    }
  }

  return insights;
}

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
    <div className="space-y-0 border-2 border-[#1a1a1a] dark:border-[#2d2d2d] overflow-hidden bg-[#FFF8F0] dark:bg-[#141414]">
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
        <div key={i} className="border-b border-[#e0d8cf] dark:border-[#252525] last:border-0 px-5 py-4 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-3 bg-[#e0d8cf] dark:bg-[#252525] rounded w-40" />
            <div className="h-3 bg-[#e0d8cf] dark:bg-[#252525] rounded w-5" />
          </div>
          <div className="space-y-2">
            <div className="h-2.5 bg-[#e8e0d5] dark:bg-[#2d2d2d] rounded w-full" />
            <div className="h-2.5 bg-[#e8e0d5] dark:bg-[#2d2d2d] rounded w-4/5" />
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
  /** True while waiting for the Gemini AI result (RSS phase already shown) */
  analysisLoading?: boolean;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ data, lang, deepLoading, analysisLoading }) => {
  const t = translations[lang];
  const { news_spectrum, overall_non_partisan_analysis, analysis_topic } = data;

  const ticker    = useSourceTicker(analysisLoading ?? false);
  const countdown = useCountdown(analysisLoading ?? false, 25);
  const typewriterText = useTypewriter(overall_non_partisan_analysis ?? '');

  return (
    <div className="animate-fade-in space-y-8">

      {/* Running progress bar — visible while AI analysis is in progress */}
      {analysisLoading && (
        <div className="relative h-[3px] bg-emerald-100 overflow-hidden -mt-2 rounded-full">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-emerald-400 rounded-full animate-scan" />
        </div>
      )}

      {/* ── AI Loading Banner — ticker + insights + countdown ────────────────── */}
      {analysisLoading && (
        <div className="border border-[#e0d8cf] dark:border-[#252525] bg-[#FFF8F0] dark:bg-[#141414] px-5 py-4 space-y-3 animate-fade-in">
          {/* Source ticker */}
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
            <span className="font-sans text-[11px] text-gray-500 dark:text-gray-400">
              {lang === 'de' ? 'Analysiere:' : lang === 'en' ? 'Analysing:' : 'Анализируем:'}
            </span>
            <span className="font-sans text-[11px] font-bold text-emerald-700 transition-all duration-500">
              {ticker}
            </span>
          </div>

          {/* Auto-insights from RSS coverage */}
          {getInsights(data.coverage_distribution, lang).map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[9px] text-emerald-400 mt-0.5 shrink-0">◆</span>
              <p className="font-sans text-[11px] text-gray-600 dark:text-gray-400">{insight}</p>
            </div>
          ))}

          {/* Countdown */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#e0d8cf] dark:border-[#252525]">
            <div className="w-1 h-1 bg-gray-300 rounded-full animate-pulse" />
            <span className="font-sans text-[10px] uppercase tracking-widest text-gray-400">
              {lang === 'de'
                ? (countdown > 0 ? `KI-Analyse · noch ~${countdown}s` : 'KI-Analyse · gleich fertig…')
                : lang === 'en'
                ? (countdown > 0 ? `AI analysis · ~${countdown}s left` : 'AI analysis · almost done…')
                : (countdown > 0 ? `ИИ анализирует · ~${countdown}с` : 'ИИ анализирует · почти готово…')
              }
            </span>
          </div>
        </div>
      )}

      {/* Degraded warning — newspaper style */}
      {data._meta?.degraded && (
        <div className="border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-5 py-3">
          <p className="font-sans text-xs text-amber-800 dark:text-amber-300">{t.degraded_warning}</p>
        </div>
      )}

      {/* ── Header + Fact Check ── */}
      <div className="border-2 border-[#1a1a1a] dark:border-[#2d2d2d] overflow-hidden bg-[#FFF8F0] dark:bg-[#141414]">
        {/* Black header with topic */}
        <div className="bg-[#1a1a1a] px-4 sm:px-6 py-4 sm:py-5">
          <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">{t.topic}</p>
          <h2 className="font-serif font-black text-xl sm:text-2xl md:text-3xl text-white capitalize leading-tight">
            {analysis_topic}
          </h2>
          {/* RSS source count + timestamp row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {(data._meta?.rss_articles ?? 0) > 0 && (
              <span className="font-sans text-[9px] uppercase tracking-widest text-white/40">
                📡 {data._meta!.rss_articles} RSS-Artikel
              </span>
            )}
            {data.analyzed_at && (
              <span className="font-sans text-[9px] uppercase tracking-widest text-white/30">
                {new Date(data.analyzed_at).toLocaleString(lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Fact check / AI analysis */}
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-emerald-500" />
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">{t.factCheck}</p>
            {analysisLoading && (
              <span className="font-sans text-[9px] uppercase tracking-widest text-emerald-500/60 animate-pulse ml-1">
                {t.analysisLoading}
              </span>
            )}
          </div>
          {analysisLoading && !overall_non_partisan_analysis ? (
            /* Skeleton while waiting for AI analysis */
            <div className="border-l-2 border-emerald-400 pl-4 space-y-2 animate-pulse">
              <div className="h-3 bg-[#e8e0d5] dark:bg-[#252525] rounded w-full" />
              <div className="h-3 bg-[#e8e0d5] dark:bg-[#252525] rounded w-5/6" />
              <div className="h-3 bg-[#e8e0d5] dark:bg-[#252525] rounded w-4/5" />
            </div>
          ) : (
            <p className="font-serif text-base text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed border-l-2 border-emerald-400 pl-4">
              {typewriterText}
              {typewriterText.length < (overall_non_partisan_analysis?.length ?? 0) && (
                <span className="inline-block w-0.5 h-[1em] bg-emerald-500 animate-pulse ml-0.5 align-middle" />
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── Reliability panel (confidence + grounding + verified silences) ── */}
      {data._reliability && (
        <ReliabilityPanel reliability={data._reliability} lang={lang} />
      )}

      {/* ── Spectrum Grid ── */}
      <SpectrumGrid spectrum={news_spectrum} rssSpectra={data._rss?.spectra} lang={lang} analysisLoading={analysisLoading} />

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

      {/* ── Deep Insights (reach balance, timeline, source map, headlines) ── */}
      <DeepInsights data={data} lang={lang} />

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

      {/* ── Balance feedback (D5) ── */}
      <BalanceFeedback topic={analysis_topic} lang={lang} />

      {/* ── Share ── */}
      <div className="border-t-2 border-[#1a1a1a] dark:border-[#2d2d2d] pt-6">
        <ShareButtons topic={analysis_topic} lang={lang} />
      </div>
    </div>
  );
};
