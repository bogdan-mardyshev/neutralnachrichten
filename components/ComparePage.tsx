import React, { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { translations, Language } from '../translations';
import { analyzeTopic } from '../services/geminiService';
import { NewsAnalysisResult, NewsSource, SpectrumKey, CoverageDistribution } from '../types';

interface Props { lang: Language }

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const SPECTRUM_STYLE: Record<SpectrumKey, { bar: string; text: string; bg: string; border: string; dot: string }> = {
  left:         { bar: 'bg-rose-500',   text: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200',   dot: 'bg-rose-500'  },
  center_left:  { bar: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400' },
  center:       { bar: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400'  },
  center_right: { bar: 'bg-sky-500',    text: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-500'    },
  right:        { bar: 'bg-blue-700',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-700'   },
};

// Example topic pairs — clickable chips to pre-fill inputs
const EXAMPLES: Record<Language, { a: string; b: string }[]> = {
  de: [
    { a: 'Bürgergeld', b: 'Mietpreisbremse' },
    { a: 'Ukraine-Krieg', b: 'Gaza-Krieg' },
    { a: 'AfD', b: 'Grüne' },
    { a: 'Heizungsgesetz', b: 'Atomkraft' },
  ],
  en: [
    { a: 'Citizen\'s income', b: 'Rent brake' },
    { a: 'Ukraine war', b: 'Gaza war' },
    { a: 'AfD', b: 'Greens' },
    { a: 'Heating act', b: 'Nuclear power' },
  ],
  ru: [
    { a: 'Bürgergeld', b: 'Mietpreisbremse' },
    { a: 'Война в Украине', b: 'Война в Газе' },
    { a: 'АдГ', b: 'Зелёные' },
    { a: 'Закон об отоплении', b: 'Атомная энергия' },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function polarizationScore(cd?: CoverageDistribution): number {
  if (!cd) return 0;
  const vals = SPECTRUM_ORDER.map(s => cd[s]?.percent ?? 0);
  const total = vals.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const shares = vals.map(v => v / total);
  const mean = 1 / 5;
  const variance = shares.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / 5;
  const stddev = Math.sqrt(variance);
  const baseScore = (stddev / 0.4) * 100;
  const extremes = shares[0] + shares[4];
  const centerMass = shares[1] + shares[2] + shares[3];
  const splitBonus = Math.max(0, extremes - centerMass) * 40;
  return Math.min(100, Math.round(baseScore + splitBonus));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StackedBar({ cd }: { cd: CoverageDistribution }) {
  const total = SPECTRUM_ORDER.reduce((acc, s) => acc + (cd[s]?.percent ?? 0), 0);
  return (
    <div className="flex overflow-hidden h-2 gap-px">
      {SPECTRUM_ORDER.map(s => {
        const pct = total > 0 ? ((cd[s]?.percent ?? 0) / total) * 100 : 0;
        return (
          <div key={s} className={`${SPECTRUM_STYLE[s].bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
        );
      })}
    </div>
  );
}

function PolarBadge({ score, lang }: { score: number; lang: Language }) {
  const t = translations[lang];
  const c = t.compare;
  const { bg, text, label } =
    score >= 55 ? { bg: 'bg-red-50',    text: 'text-red-600',    label: c.high } :
    score >= 25 ? { bg: 'bg-amber-50',  text: 'text-amber-600',  label: c.medium } :
    score >= 8  ? { bg: 'bg-emerald-50',text: 'text-emerald-700',label: c.low } :
                  { bg: 'bg-slate-50',  text: 'text-slate-500',  label: c.balanced };
  return (
    <span className={`font-sans text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border border-current ${bg} ${text}`}>
      {label}{score > 0 ? ` · ${score}` : ''}
    </span>
  );
}

function MiniCard({ source, spectrumKey, lang }: { source: NewsSource | undefined; spectrumKey: SpectrumKey; lang: Language }) {
  const c = SPECTRUM_STYLE[spectrumKey];
  if (!source) {
    return (
      <div className={`border-2 ${c.border} ${c.bg} p-3 flex items-center justify-center min-h-[80px]`}>
        <span className="font-sans text-[9px] uppercase tracking-widest text-gray-300">
          {translations[lang].compare.noData}
        </span>
      </div>
    );
  }
  return (
    <a
      href={source.article_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`border-2 border-[#1a1a1a] border-l-4 ${c.border.replace('border-', 'border-l-')} ${c.bg} p-3 flex flex-col gap-1.5 hover:border-[#1a1a1a] transition-colors group`}
    >
      <p className={`font-sans text-[9px] font-bold uppercase tracking-widest ${c.text}`}>{source.source_name}</p>
      <p className="font-serif text-xs font-bold text-[#1a1a1a] dark:text-[#f0ece4] leading-snug line-clamp-2 group-hover:underline">{source.article_title}</p>
      <p className="font-serif text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{source.summary_of_perspective}</p>
      <span className={`font-sans text-[9px] font-bold uppercase tracking-widest ${c.text} mt-auto`}>
        {translations[lang].compare.readMore}
      </span>
    </a>
  );
}

function Skeleton() {
  return (
    <div className="border-2 border-[#1a1a1a] dark:border-gray-700 animate-pulse">
      <div className="bg-[#1a1a1a] dark:bg-gray-800 h-10" />
      <div className="p-5 flex flex-col gap-3 dark:bg-[#141414]">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 w-1/2" />
        <div className="h-2 bg-gray-100 dark:bg-gray-800 w-full" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700" />
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export const ComparePage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const c = t.compare;
  const [searchParams, setSearchParams] = useSearchParams();

  const [inputA, setInputA] = useState(searchParams.get('topicA') ?? '');
  const [inputB, setInputB] = useState(searchParams.get('topicB') ?? '');
  const [resultA, setResultA] = useState<NewsAnalysisResult | null>(null);
  const [resultB, setResultB] = useState<NewsAnalysisResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const leaningLabel: Record<SpectrumKey, string> = {
    left:         t.leaningLeft,
    center_left:  t.leaningCenterLeft,
    center:       t.leaningCenter,
    center_right: t.leaningCenterRight,
    right:        t.leaningRight,
  };

  const handleAnalyze = async () => {
    const a = inputA.trim();
    const b = inputB.trim();
    if (!a || !b) return;

    setResultA(null); setResultB(null);
    setErrorA(null);  setErrorB(null);
    setLoadingA(true); setLoadingB(true);
    setHasSearched(true);
    setSearchParams({ topicA: a, topicB: b, lang }, { replace: true });

    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

    const [resA, resB] = await Promise.allSettled([
      analyzeTopic(a, lang),
      analyzeTopic(b, lang),
    ]);

    setLoadingA(false);
    setLoadingB(false);

    if (resA.status === 'fulfilled') setResultA(resA.value);
    else setErrorA(c.errorA);

    if (resB.status === 'fulfilled') setResultB(resB.value);
    else setErrorB(c.errorB);
  };

  const scoreA = resultA?.coverage_distribution ? polarizationScore(resultA.coverage_distribution) : null;
  const scoreB = resultB?.coverage_distribution ? polarizationScore(resultB.coverage_distribution) : null;
  const isLoading = loadingA || loadingB;

  const L = {
    de: {
      howLabel: 'So funktioniert der Vergleich',
      steps: [
        { n: '01', title: 'Zwei Themen wählen', desc: 'Gib zwei Themen ein — z.B. ein politisches und ein wirtschaftliches, oder zwei ähnliche Ereignisse.' },
        { n: '02', title: 'Beide parallel analysieren', desc: 'Wir analysieren beide Themen gleichzeitig über das gesamte politische Spektrum — von links bis rechts.' },
        { n: '03', title: 'Abdeckung vergleichen', desc: 'Welches Thema wird wo mehr diskutiert? Welches Lager berichtet intensiver — und welches schweigt?' },
        { n: '04', title: 'Muster erkennen', desc: 'Manche Themen teilen das Spektrum symmetrisch. Andere werden nur von einer Seite dominiert. Das ist der Kern des Vergleichs.' },
      ],
      whyLabel: 'Wann ist das nützlich?',
      whyCases: [
        'Vergleich zweier aktueller Krisen: Wer berichtet mehr, wer weniger?',
        'Zwei politische Parteien: Wie wird jede im Spektrum wahrgenommen?',
        'Sozialpolitik vs. Wirtschaftspolitik: Welches Thema spaltet stärker?',
      ],
      examplesLabel: 'Beispiele',
      topicALabel: 'Thema A',
      topicBLabel: 'Thema B',
      vsText: 'vs.',
      btnText: 'Beide analysieren',
      btnLoading: 'Analysiere...',
      coverageLabel: 'Medienabdeckung',
      polarLabel: 'Polarisierung',
      perSpectrumLabel: 'Pro politischem Lager',
    },
    en: {
      howLabel: 'How the comparison works',
      steps: [
        { n: '01', title: 'Choose two topics', desc: 'Enter two topics — e.g. a political and an economic one, or two similar events.' },
        { n: '02', title: 'Analyse both in parallel', desc: 'We analyse both topics simultaneously across the full political spectrum — from left to right.' },
        { n: '03', title: 'Compare coverage', desc: 'Which topic gets more attention where? Which camp reports more — and which stays silent?' },
        { n: '04', title: 'Spot patterns', desc: 'Some topics divide the spectrum symmetrically. Others are dominated by one side. That\'s the core of the comparison.' },
      ],
      whyLabel: 'When is this useful?',
      whyCases: [
        'Comparing two current crises: who covers more, who covers less?',
        'Two political parties: how is each perceived across the spectrum?',
        'Social policy vs. economic policy: which topic divides more?',
      ],
      examplesLabel: 'Examples',
      topicALabel: 'Topic A',
      topicBLabel: 'Topic B',
      vsText: 'vs.',
      btnText: 'Analyse both',
      btnLoading: 'Analysing...',
      coverageLabel: 'Media coverage',
      polarLabel: 'Polarisation',
      perSpectrumLabel: 'Per political camp',
    },
    ru: {
      howLabel: 'Как работает сравнение',
      steps: [
        { n: '01', title: 'Выберите две темы', desc: 'Введите две темы — например, политическую и экономическую, или два похожих события.' },
        { n: '02', title: 'Анализ обеих параллельно', desc: 'Мы анализируем обе темы одновременно по всему политическому спектру — от левых до правых.' },
        { n: '03', title: 'Сравните освещение', desc: 'Какая тема получает больше внимания? Какой лагерь пишет активнее — а какой молчит?' },
        { n: '04', title: 'Замечайте паттерны', desc: 'Одни темы делят спектр симметрично. Другие доминируют только у одной стороны. Это и есть суть сравнения.' },
      ],
      whyLabel: 'Когда это полезно?',
      whyCases: [
        'Сравнение двух кризисов: кто пишет больше, кто меньше?',
        'Две политические партии: как каждую воспринимают в разных лагерях?',
        'Социальная vs. экономическая политика: что больше раскалывает спектр?',
      ],
      examplesLabel: 'Примеры',
      topicALabel: 'Тема А',
      topicBLabel: 'Тема Б',
      vsText: 'vs.',
      btnText: 'Анализировать обе',
      btnLoading: 'Анализируем...',
      coverageLabel: 'Охват СМИ',
      polarLabel: 'Поляризация',
      perSpectrumLabel: 'По политическому лагерю',
    },
  }[lang];

  return (
    <div className="max-w-5xl mx-auto pb-16 px-4">

      {/* ── Back ── */}
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
        <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
        {t.backToHome}
      </Link>

      {/* ════════════════════════════════════════════════════════
          HERO HEADER
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden mb-6">
        <div className="h-1.5 flex">
          <div className="flex-1 bg-rose-500" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-400" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="bg-[#1a1a1a] px-6 sm:px-8 py-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-white/35 mb-1">{c.title}</p>
            <h1 className="font-serif font-black text-xl sm:text-2xl text-white leading-tight">{c.subtitle}</h1>
          </div>
          <div className="hidden sm:flex flex-col gap-1 items-end shrink-0">
            <div className="font-sans text-[8px] uppercase tracking-widest text-white/25">A</div>
            <div className="font-serif font-black text-white/15 text-4xl leading-none">↔</div>
            <div className="font-sans text-[8px] uppercase tracking-widest text-white/25">B</div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          EXPLAINER — how it works (visible before first search)
      ════════════════════════════════════════════════════════ */}
      {!hasSearched && (
        <div className="mb-6">
          {/* 4-step how-to */}
          <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden mb-4">
            <div className="bg-[#1a1a1a] dark:bg-gray-900 px-5 py-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.howLabel}</p>
            </div>
            <div className="grid sm:grid-cols-4 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a] dark:divide-gray-700">
              {L.steps.map((step, i) => (
                <div key={step.n} className="p-4 sm:p-5 flex flex-col gap-2 dark:bg-[#141414]">
                  <span className="font-serif font-black text-lg text-gray-200 dark:text-gray-600 leading-none">{step.n}</span>
                  <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] leading-tight">{step.title}</p>
                  <p className="font-serif text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Why + Examples side by side */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Why useful */}
            <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
              <div className="bg-[#1a1a1a] dark:bg-gray-900 px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.whyLabel}</p>
              </div>
              <div className="p-5 dark:bg-[#141414] flex flex-col gap-3">
                {L.whyCases.map((wc, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0 mt-1.5" />
                    <p className="font-serif text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{wc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Example chips */}
            <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
              <div className="bg-[#1a1a1a] dark:bg-gray-900 px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.examplesLabel}</p>
              </div>
              <div className="p-5 dark:bg-[#141414] flex flex-col gap-2">
                {EXAMPLES[lang].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputA(ex.a); setInputB(ex.b); }}
                    className="w-full flex items-center gap-2 border-2 border-[#1a1a1a] dark:border-gray-600 px-3 py-2 hover:bg-[#1a1a1a] dark:hover:bg-gray-700 group transition-colors text-left"
                  >
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] group-hover:text-white transition-colors flex-1 truncate">{ex.a}</span>
                    <span className="font-sans text-[9px] text-gray-300 dark:text-gray-600 group-hover:text-white/40 transition-colors shrink-0">{L.vsText}</span>
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] group-hover:text-white transition-colors flex-1 truncate text-right">{ex.b}</span>
                    <span className="font-sans text-[9px] text-gray-300 dark:text-gray-600 group-hover:text-white/40 transition-colors shrink-0">↗</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SEARCH FORM
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden mb-6">
        <div className="grid sm:grid-cols-[1fr_auto_1fr_auto] divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a] dark:divide-gray-700">

          {/* Input A */}
          <div className="p-4 sm:p-5 flex flex-col gap-2 dark:bg-[#141414]">
            <label className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{L.topicALabel}</label>
            <input
              value={inputA}
              onChange={e => setInputA(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder={c.placeholderA}
              className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] bg-transparent border-b-2 border-[#1a1a1a]/20 dark:border-gray-600 focus:border-[#1a1a1a] dark:focus:border-gray-400 outline-none py-1 placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-colors w-full"
            />
          </div>

          {/* VS divider */}
          <div className="hidden sm:flex items-center justify-center px-4 bg-[#f5f0e8] dark:bg-[#1e1a14]">
            <span className="font-serif font-black text-xl text-gray-300 dark:text-gray-600">{L.vsText}</span>
          </div>

          {/* Input B */}
          <div className="p-4 sm:p-5 flex flex-col gap-2 dark:bg-[#141414]">
            <label className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{L.topicBLabel}</label>
            <input
              value={inputB}
              onChange={e => setInputB(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder={c.placeholderB}
              className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] bg-transparent border-b-2 border-[#1a1a1a]/20 dark:border-gray-600 focus:border-[#1a1a1a] dark:focus:border-gray-400 outline-none py-1 placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-colors w-full"
            />
          </div>

          {/* Button */}
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !inputA.trim() || !inputB.trim()}
            className="font-sans text-[10px] font-bold uppercase tracking-widest px-6 py-4 sm:py-0 bg-[#1a1a1a] dark:bg-gray-800 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isLoading ? L.btnLoading : L.btnText}
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          RESULTS
      ════════════════════════════════════════════════════════ */}
      {hasSearched && (
        <div ref={resultsRef}>

          {/* Loading skeletons */}
          {isLoading && (
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {loadingA && <Skeleton />}
              {loadingB && <Skeleton />}
            </div>
          )}

          {/* Coverage summary cards */}
          {(resultA || resultB) && !isLoading && (
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {([
                { result: resultA, topic: inputA, score: scoreA, err: errorA, accent: 'border-t-violet-500', side: 'A' },
                { result: resultB, topic: inputB, score: scoreB, err: errorB, accent: 'border-t-emerald-500', side: 'B' },
              ] as const).map(({ result, topic, score, err, accent, side }) => (
                <div key={side} className={`border-2 border-[#1a1a1a] dark:border-gray-700 border-t-4 ${accent} overflow-hidden`}>
                  <div className="px-5 py-4 border-b-2 border-[#1a1a1a] dark:border-gray-700 dark:bg-[#141414] flex items-start justify-between gap-2">
                    <div>
                      <p className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
                        {side === 'A' ? L.topicALabel : L.topicBLabel}
                      </p>
                      <p className="font-serif font-bold text-base text-[#1a1a1a] dark:text-white leading-tight">{topic}</p>
                    </div>
                    {score !== null && <PolarBadge score={score} lang={lang} />}
                  </div>

                  {err && (
                    <div className="px-5 py-4">
                      <p className="font-sans text-[10px] text-rose-600 uppercase tracking-wider">{err}</p>
                    </div>
                  )}

                  {result?.coverage_distribution && (
                    <div className="px-5 py-4 dark:bg-[#141414]">
                      <p className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{L.coverageLabel}</p>
                      <StackedBar cd={result.coverage_distribution} />
                      <div className="flex justify-between font-sans text-[8px] uppercase tracking-widest text-gray-300 dark:text-gray-600 mt-1">
                        <span>{t.leaningLeft}</span>
                        <span>{t.leaningCenter}</span>
                        <span>{t.leaningRight}</span>
                      </div>

                      {/* Per-camp percents */}
                      <div className="grid grid-cols-5 gap-1 mt-3">
                        {SPECTRUM_ORDER.map(s => {
                          const cd = result.coverage_distribution!;
                          const pct = cd[s]?.percent ?? 0;
                          const st = SPECTRUM_STYLE[s];
                          return (
                            <div key={s} className={`${st.bg} border ${st.border} p-1.5 flex flex-col items-center gap-0.5`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              <span className={`font-sans text-[9px] font-bold ${st.text}`}>{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Per-spectrum comparison table */}
          {(resultA || resultB) && !isLoading && (
            <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="bg-[#1a1a1a] dark:bg-gray-900 px-5 py-3 flex items-center gap-4">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white flex-1">{L.perSpectrumLabel}</p>
                <div className="hidden sm:flex items-center gap-6">
                  <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 max-w-[120px] truncate">{inputA || L.topicALabel}</p>
                  <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 max-w-[120px] truncate">{inputB || L.topicBLabel}</p>
                </div>
              </div>

              {/* Column labels (mobile visible) */}
              <div className="sm:hidden grid grid-cols-2 divide-x-2 divide-[#1a1a1a] dark:divide-gray-700 border-b-2 border-[#1a1a1a] dark:border-gray-700 px-4 py-2 bg-[#f5f0e8] dark:bg-[#1e1a14]">
                <p className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 pr-2 truncate">{inputA || L.topicALabel}</p>
                <p className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 pl-2 truncate">{inputB || L.topicBLabel}</p>
              </div>

              {/* Rows */}
              <div className="divide-y-2 divide-[#1a1a1a] dark:divide-gray-700">
                {SPECTRUM_ORDER.map(s => {
                  const st = SPECTRUM_STYLE[s];
                  const srcA = resultA?.news_spectrum?.[s];
                  const srcB = resultB?.news_spectrum?.[s];
                  const _srcA = Array.isArray(srcA) ? srcA[0] : srcA;
                  const _srcB = Array.isArray(srcB) ? srcB[0] : srcB;

                  return (
                    <div key={s}>
                      {/* Spectrum label row */}
                      <div className={`flex items-center gap-2 px-5 py-2 border-b border-[#1a1a1a]/10 dark:border-gray-700 ${st.bg}`}>
                        <div className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                        <span className={`font-sans text-[9px] font-bold uppercase tracking-widest ${st.text}`}>
                          {leaningLabel[s]}
                        </span>
                      </div>
                      {/* Cards row */}
                      <div className="grid sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a] dark:divide-gray-700">
                        <div className="p-3 sm:p-4">
                          <MiniCard source={_srcA} spectrumKey={s} lang={lang} />
                        </div>
                        <div className="p-3 sm:p-4">
                          <MiniCard source={_srcB} spectrumKey={s} lang={lang} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
