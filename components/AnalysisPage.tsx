import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Language } from '../translations';

interface Props {
  lang: Language;
}

interface AnalysisData {
  topic: string;
  analysis: {
    // Full analysis fields
    analysis_topic?: string;
    overall_non_partisan_analysis?: string;
    news_spectrum?: Record<string, Array<{
      source_name: string;
      source_domain: string;
      article_title: string;
      article_url: string;
      summary_of_perspective: string;
    }>>;
    coverage_distribution?: Record<string, { estimate?: string; percent?: number; count?: number }>;
    // PublicEntry fields (fallback)
    topic_norm?: string;
    summary?: string;
    coverage?: Record<string, { percent: number }>;
    last_searched?: string;
    search_count?: number | string;
  };
}

const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'] as const;

const SPECTRUM_STYLE: Record<string, {
  label: Record<Language, string>;
  bar: string; text: string; bg: string; border: string; dot: string;
}> = {
  left:         { label: { de: 'Links', en: 'Left', ru: 'Левые' },             bar: 'bg-rose-600',   text: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200',   dot: 'bg-rose-500'   },
  center_left:  { label: { de: 'Mitte-Links', en: 'Center-Left', ru: 'Лев. центр' }, bar: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400' },
  center:       { label: { de: 'Mitte', en: 'Center', ru: 'Центр' },           bar: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400'  },
  center_right: { label: { de: 'Mitte-Rechts', en: 'Center-Right', ru: 'Пр. центр' }, bar: 'bg-sky-500',    text: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-500'    },
  right:        { label: { de: 'Rechts', en: 'Right', ru: 'Правые' },          bar: 'bg-blue-700',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-700'   },
};

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const AnalysisPage: React.FC<Props> = ({ lang }) => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    setNotFound(false);
    setData(null);

    const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';
    fetch(`${API_BASE}/api/public/analysis/${encodeURIComponent(slug)}`)
      .then(async r => {
        if (!r.ok) { setNotFound(true); return; }
        const json = await r.json();
        setData(json);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const topic = data?.topic || (slug || '').replace(/-/g, ' ');
  const displayTopic = capitalize(topic);

  const pageTitle = `${displayTopic} – Medienspektrum-Analyse | NeutralNachrichten`;
  const pageDesc = `Wie berichten deutsche Medien über "${displayTopic}"? KI-Analyse von taz, Spiegel, FAZ, Bild und 14 weiteren Quellen.`;
  const canonical = `https://www.neutralenachrichten.com/a/${slug || ''}`;

  // Extract news spectrum sources (full analysis)
  const newsSpectrum = data?.analysis?.news_spectrum;
  // Extract overall summary
  const overallAnalysis = data?.analysis?.overall_non_partisan_analysis || data?.analysis?.summary || null;
  // Coverage
  const coverage = data?.analysis?.coverage_distribution || data?.analysis?.coverage || null;

  const homeWithTopic = `/?topic=${encodeURIComponent(topic)}`;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto pb-16">
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={pageDesc} />
          <link rel="canonical" href={canonical} />
          <meta property="og:title" content={pageTitle} />
          <meta property="og:description" content={pageDesc} />
          <meta property="og:url" content={canonical} />
          <meta property="og:type" content="article" />
          <meta property="og:image" content="https://www.neutralenachrichten.com/og-image.png" />
          <meta name="twitter:card" content="summary_large_image" />
        </Helmet>
        {/* Skeleton */}
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-[#e0d8cf] dark:bg-gray-700 w-36 mb-8" />
          <div className="h-16 bg-[#e0d8cf] dark:bg-gray-700 w-2/3" />
          <div className="grid grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-[#e0d8cf] dark:bg-gray-700" />
            ))}
          </div>
          <div className="h-24 bg-[#e0d8cf] dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto pb-16">
        <Helmet>
          <title>Analyse nicht gefunden – NeutralNachrichten</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
          <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
          {lang === 'de' ? 'Zur Startseite' : lang === 'ru' ? 'На главную' : 'Back home'}
        </Link>
        <div className="border-2 border-[#1a1a1a] dark:border-gray-700 p-8 text-center">
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 mb-3">404</p>
          <h1 className="font-serif font-black text-2xl text-[#1a1a1a] dark:text-white mb-4">
            {lang === 'de' ? 'Analyse nicht gefunden' : lang === 'ru' ? 'Анализ не найден' : 'Analysis not found'}
          </h1>
          <p className="font-serif text-sm text-gray-500 dark:text-gray-400 mb-6">
            {lang === 'de'
              ? 'Diese Analyse ist nicht mehr verfügbar oder wurde noch nicht erstellt.'
              : lang === 'ru'
              ? 'Этот анализ недоступен или ещё не был создан.'
              : 'This analysis is no longer available or has not been created yet.'}
          </p>
          <Link
            to={homeWithTopic}
            className="inline-flex items-center gap-2 font-sans text-[10px] font-bold uppercase tracking-widest bg-rose-600 text-white px-5 py-3 hover:bg-rose-700 transition-colors"
          >
            {lang === 'de' ? `"${displayTopic}" jetzt analysieren →` : lang === 'ru' ? `Анализировать "${displayTopic}" →` : `Analyse "${displayTopic}" now →`}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content="https://www.neutralenachrichten.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": pageTitle,
          "description": pageDesc,
          "url": canonical,
          "publisher": {
            "@type": "Organization",
            "name": "NeutralNachrichten",
            "url": "https://www.neutralenachrichten.com"
          },
          "about": {
            "@type": "Thing",
            "name": displayTopic
          }
        })}</script>
      </Helmet>

      {/* Back */}
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
        <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
        {lang === 'de' ? 'Zur Startseite' : lang === 'ru' ? 'На главную' : 'Back home'}
      </Link>

      {/* Hero */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden mb-8 animate-fade-in">
        <div className="h-1.5 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="bg-[#1a1a1a] dark:bg-[#0a0a0a] px-6 sm:px-10 py-8 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 font-serif font-black text-[120px] leading-none text-white/[0.03] select-none pointer-events-none">NN</div>
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/35 mb-3">
            {lang === 'de' ? 'Medienspektrum-Analyse' : lang === 'ru' ? 'Медиаспектр-Анализ' : 'Media Spectrum Analysis'}
          </p>
          <h1 className="font-serif font-black text-2xl sm:text-3xl text-white leading-tight mb-4 relative z-10">
            {displayTopic}
          </h1>
          <div className="h-px bg-white/10 mb-4" />
          <p className="font-sans text-[10px] text-white/35 uppercase tracking-widest">
            {lang === 'de' ? '18 Quellen · 5 politische Lager · KI-Analyse' : lang === 'ru' ? '18 источников · 5 политических лагерей · ИИ-анализ' : '18 sources · 5 political camps · AI analysis'}
          </p>
        </div>
      </div>

      {/* Coverage spectrum bar */}
      {coverage && (
        <div className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
          <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">
              {lang === 'de' ? 'Berichterstattungs-Spektrum' : lang === 'ru' ? 'Спектр освещения' : 'Coverage Spectrum'}
            </p>
          </div>
          <div className="grid grid-cols-5 divide-x-2 divide-[#1a1a1a] dark:divide-gray-700 dark:bg-[#141414]">
            {SPECTRUM_ORDER.map(s => {
              const cfg = SPECTRUM_STYLE[s];
              const cov = (coverage as Record<string, { percent?: number; estimate?: string }>)[s];
              const pct = cov?.percent ?? 0;
              return (
                <div key={s} className="flex flex-col items-center p-3 gap-2">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <p className={`font-sans text-[9px] font-bold uppercase tracking-widest ${cfg.text} text-center hidden sm:block`}>
                    {cfg.label[lang]}
                  </p>
                  <div className="w-full bg-[#e0d8cf] dark:bg-gray-700 h-1 overflow-hidden">
                    <div className={`h-1 ${cfg.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="font-sans text-[10px] font-bold text-[#1a1a1a] dark:text-[#f0ece4]">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall analysis */}
      {overallAnalysis && (
        <div className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
          <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">
              {lang === 'de' ? 'Überparteiliche Analyse' : lang === 'ru' ? 'Беспартийный анализ' : 'Non-Partisan Analysis'}
            </p>
          </div>
          <div className="px-6 py-5 dark:bg-[#141414]">
            <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{overallAnalysis}</p>
          </div>
        </div>
      )}

      {/* News spectrum sources */}
      {newsSpectrum && (
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4] shrink-0">
              {lang === 'de' ? 'Quellen nach Spektrum' : lang === 'ru' ? 'Источники по спектру' : 'Sources by Spectrum'}
            </p>
            <div className="flex-1 h-px bg-[#1a1a1a] dark:bg-gray-600 opacity-15 dark:opacity-100" />
          </div>
          <div className="space-y-4">
            {SPECTRUM_ORDER.map(s => {
              const sources = newsSpectrum[s] || [];
              if (sources.length === 0) return null;
              const cfg = SPECTRUM_STYLE[s];
              return (
                <div key={s} className={`border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden`}>
                  <div className={`flex items-center gap-3 px-5 py-3 ${cfg.bg} border-b-2 border-[#1a1a1a] dark:border-gray-700`}>
                    <div className={`w-1 self-stretch ${cfg.bar}`} />
                    <p className={`font-sans text-[10px] font-bold uppercase tracking-widest ${cfg.text}`}>
                      {cfg.label[lang]}
                    </p>
                    <span className="font-sans text-[9px] text-gray-400 ml-auto">{sources.length} {lang === 'de' ? 'Quellen' : lang === 'ru' ? 'источников' : 'sources'}</span>
                  </div>
                  <div className="divide-y divide-[#e0d8cf] dark:divide-gray-700 dark:bg-[#141414]">
                    {sources.map((src, i) => (
                      <div key={i} className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <p className={`font-sans text-[9px] font-bold uppercase tracking-widest ${cfg.text}`}>{src.source_name}</p>
                        </div>
                        {src.article_url ? (
                          <a
                            href={src.article_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-serif text-sm font-bold text-[#1a1a1a] dark:text-[#f0ece4] hover:underline leading-snug block mb-1.5"
                          >
                            {src.article_title}
                          </a>
                        ) : (
                          <p className="font-serif text-sm font-bold text-[#1a1a1a] dark:text-[#f0ece4] leading-snug mb-1.5">{src.article_title}</p>
                        )}
                        {src.summary_of_perspective && (
                          <p className="font-serif text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{src.summary_of_perspective}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-6 dark:bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-1">
              {lang === 'de' ? 'Aktuelle Analyse' : lang === 'ru' ? 'Актуальный анализ' : 'Fresh analysis'}
            </p>
            <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">
              {lang === 'de'
                ? `Jetzt "${displayTopic}" live analysieren — mit aktuellen Artikeln aus 18 Quellen.`
                : lang === 'ru'
                ? `Анализировать "${displayTopic}" прямо сейчас — со свежими статьями из 18 источников.`
                : `Analyse "${displayTopic}" now — with the latest articles from 18 sources.`}
            </p>
          </div>
          <Link
            to={homeWithTopic}
            className="font-sans text-[10px] font-bold uppercase tracking-widest bg-rose-600 text-white px-6 py-3 hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'de' ? 'Jetzt analysieren →' : lang === 'ru' ? 'Анализировать →' : 'Analyse now →'}
          </Link>
        </div>
      </div>
    </div>
  );
};
