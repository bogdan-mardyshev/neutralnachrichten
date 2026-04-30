import React, { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { translations, Language } from '../translations';
import { analyzeTopic } from '../services/geminiService';
import { NewsAnalysisResult, NewsSource, SpectrumKey, CoverageDistribution } from '../types';

interface Props { lang: Language }

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const SPECTRUM_STYLE: Record<SpectrumKey, { bar: string; text: string; badge: string; border: string }> = {
  left:         { bar: 'bg-rose-500',   text: 'text-rose-600',   badge: 'bg-rose-50 border-rose-200',   border: 'border-l-rose-500' },
  center_left:  { bar: 'bg-orange-400', text: 'text-orange-600', badge: 'bg-orange-50 border-orange-200', border: 'border-l-orange-400' },
  center:       { bar: 'bg-slate-400',  text: 'text-slate-600',  badge: 'bg-slate-50 border-slate-200',  border: 'border-l-slate-400' },
  center_right: { bar: 'bg-sky-500',    text: 'text-sky-600',    badge: 'bg-sky-50 border-sky-200',      border: 'border-l-sky-500' },
  right:        { bar: 'bg-blue-700',   text: 'text-blue-700',   badge: 'bg-blue-50 border-blue-200',    border: 'border-l-blue-700' },
};

// Compute polarization score 0–100 from coverage distribution.
// Uses stddev of shares, normalized by max possible stddev (≈0.4 when all weight on one bucket).
// Additionally weights extremes (left/right) heavier than center to detect left-right splits.
function polarizationScore(cd?: CoverageDistribution): number {
  if (!cd) return 0;
  const vals = SPECTRUM_ORDER.map(s => cd[s]?.percent ?? 0);
  const total = vals.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const shares = vals.map(v => v / total);

  // Base: stddev of shares (max ≈ 0.4 → normalized to 100)
  const mean = 1 / 5;
  const variance = shares.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / 5;
  const stddev = Math.sqrt(variance);
  const baseScore = (stddev / 0.4) * 100;

  // Bonus: left–right imbalance vs center amplifies polarization feeling
  const extremes = (shares[0] + shares[4]);          // left + right
  const centerMass = (shares[1] + shares[2] + shares[3]); // center three
  const splitBonus = Math.max(0, extremes - centerMass) * 40; // max ~+40 when extremes dominate

  return Math.min(100, Math.round(baseScore + splitBonus));
}

// Mini stacked bar for coverage
function StackedBar({ cd, lang }: { cd: CoverageDistribution; lang: Language }) {
  const total = SPECTRUM_ORDER.reduce((acc, s) => acc + (cd[s]?.percent ?? 0), 0);
  return (
    <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
      {SPECTRUM_ORDER.map(s => {
        const pct = total > 0 ? ((cd[s]?.percent ?? 0) / total) * 100 : 0;
        return (
          <div
            key={s}
            className={`${SPECTRUM_STYLE[s].bar} transition-all duration-700 first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

// Mini article card for comparison row
function MiniCard({
  source, spectrumKey, lang,
}: {
  source: NewsSource | undefined;
  spectrumKey: SpectrumKey;
  lang: Language;
}) {
  const t = translations[lang];
  const c = SPECTRUM_STYLE[spectrumKey];
  if (!source) {
    return (
      <div className={`flex-1 min-w-0 rounded-xl border ${c.badge} p-3 text-xs text-gray-400 italic`}>
        {t.compare.noData}
      </div>
    );
  }
  return (
    <a
      href={source.article_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex-1 min-w-0 rounded-xl border border-l-4 ${c.border} ${c.badge} p-3 flex flex-col gap-1.5 hover:shadow-sm transition-shadow`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-widest ${c.text}`}>{source.source_name}</p>
      <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{source.article_title}</p>
      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{source.summary_of_perspective}</p>
      <span className={`text-[10px] font-medium ${c.text} mt-auto`}>{t.compare.readMore}</span>
    </a>
  );
}

// Polarization badge
function PolarBadge({ score, lang }: { score: number; lang: Language }) {
  const t = translations[lang];
  const { color, label } =
    score >= 55 ? { color: 'bg-red-100 text-red-700 border-red-200',      label: t.compare.high } :
    score >= 25 ? { color: 'bg-amber-100 text-amber-700 border-amber-200', label: t.compare.medium } :
    score >= 8  ? { color: 'bg-green-100 text-green-700 border-green-200', label: t.compare.low } :
                  { color: 'bg-slate-100 text-slate-500 border-slate-200', label: t.compare.balanced };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {label}{score > 0 ? ` · ${score}` : ''}
    </span>
  );
}

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

    // Fetch both in parallel
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

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <Link to="/" className="text-slate-500 hover:text-slate-800 mb-8 flex items-center gap-2 text-sm">
        ← {t.backToHome}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{c.title}</h1>
        <p className="text-gray-500">{c.subtitle}</p>
      </div>

      {/* Search inputs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{c.topicA}</label>
            <input
              value={inputA}
              onChange={e => setInputA(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder={c.placeholderA}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="flex items-end justify-center pb-1">
            <span className="text-xl font-black text-gray-300 px-2">{c.vs}</span>
          </div>

          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{c.topicB}</label>
            <input
              value={inputB}
              onChange={e => setInputB(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder={c.placeholderB}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !inputA.trim() || !inputB.trim()}
              className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {isLoading ? c.analyzing : c.analyzeBtn}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div ref={resultsRef}>
          {/* Loading skeletons */}
          {isLoading && (
            <div className="flex gap-3 mb-6">
              {[loadingA, loadingB].map((loading, i) => loading && (
                <div key={i} className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-2.5 bg-gray-100 rounded-full mb-4" />
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-14 bg-gray-50 rounded-xl mb-2" />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Summary row — coverage bars + polarization */}
          {(resultA || resultB) && !isLoading && (
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {([resultA, resultB] as const).map((result, i) => {
                const topic = i === 0 ? inputA : inputB;
                const score = i === 0 ? scoreA : scoreB;
                const err = i === 0 ? errorA : errorB;
                const label = i === 0 ? c.topicA : c.topicB;
                const accentColor = i === 0 ? 'border-violet-400' : 'border-emerald-400';

                return (
                  <div key={i} className={`bg-white rounded-2xl border border-gray-100 border-t-4 ${accentColor} p-5`}>
                    {err && <p className="text-red-500 text-sm">{err}</p>}
                    {result && (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
                            <p className="font-bold text-slate-900 leading-tight">{topic}</p>
                          </div>
                          {score !== null && <PolarBadge score={score} lang={lang} />}
                        </div>
                        {result.coverage_distribution && (
                          <>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{c.coverage}</p>
                            <StackedBar cd={result.coverage_distribution} lang={lang} />
                            <div className="flex justify-between text-[9px] text-gray-300 mt-1">
                              <span>{t.leaningLeft}</span>
                              <span>{t.leaningCenter}</span>
                              <span>{t.leaningRight}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-spectrum comparison rows */}
          {(resultA || resultB) && !isLoading && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{c.perSpectrum}</p>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[120px_1fr_1fr] gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100">
                <div />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{inputA || c.topicA}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{inputB || c.topicB}</p>
              </div>

              <div className="divide-y divide-gray-50">
                {SPECTRUM_ORDER.map(s => {
                  const st = SPECTRUM_STYLE[s];
                  const srcA = resultA?.news_spectrum?.[s];
                  const srcB = resultB?.news_spectrum?.[s];
                  const _srcA = Array.isArray(srcA) ? srcA[0] : srcA;
                  const _srcB = Array.isArray(srcB) ? srcB[0] : srcB;
                  return (
                    <div key={s} className="grid grid-cols-[120px_1fr_1fr] gap-3 px-5 py-4 items-start">
                      {/* Spectrum label */}
                      <div className="flex flex-col gap-1 pt-1">
                        <div className={`w-2 h-2 rounded-full ${st.bar}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${st.text}`}>
                          {leaningLabel[s]}
                        </span>
                      </div>
                      <MiniCard source={_srcA} spectrumKey={s} lang={lang} />
                      <MiniCard source={_srcB} spectrumKey={s} lang={lang} />
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
