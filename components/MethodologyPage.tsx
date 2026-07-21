import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

// ── Data ─────────────────────────────────────────────────────────────────────

const SOURCES = {
  left:         ['taz', 'nd-aktuell', 'Junge Welt', 'Der Freitag', 'NachDenkSeiten'],
  center_left:  ['Der Spiegel', 'Süddeutsche Zeitung', 'Die Zeit', 'Tagesspiegel', 'Stern', 'Frankfurter Rundschau', 'Berliner Zeitung', 'RND'],
  center:       ['Tagesschau', 'ZDF heute', 'Deutschlandfunk', 'Deutsche Welle', 'MDR'],
  center_right: ['FAZ', 'Die Welt', 'Focus', 'NTV', 'Handelsblatt', 'NZZ', 'WirtschaftsWoche', 'Cicero'],
  right:        ['Bild', 'Junge Freiheit', 'Tichys Einblick', 'Nius', 'Apollo News', 'Epoch Times DE', 'Achgut'],
} as const;

const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'] as const;
type SpectrumKey = typeof SPECTRUM_ORDER[number];

const SPECTRUM_CFG: Record<SpectrumKey, {
  label: Record<Language, string>;
  bar: string; dot: string; border: string; bg: string; text: string;
  arrow: string; gradient: string;
}> = {
  left:         { label: { de: 'Links',        en: 'Left',         ru: 'Левые'       }, bar: 'bg-rose-600',   dot: 'bg-rose-600',   border: 'border-rose-300',   bg: 'bg-rose-50',   text: 'text-rose-700',   arrow: '←', gradient: 'from-rose-600 to-rose-400'     },
  center_left:  { label: { de: 'Mitte-Links',  en: 'Center-Left',  ru: 'Центр-Лево'  }, bar: 'bg-orange-400', dot: 'bg-orange-400', border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-700', arrow: '↖', gradient: 'from-orange-400 to-amber-400'   },
  center:       { label: { de: 'Mitte',        en: 'Center',       ru: 'Центр'       }, bar: 'bg-slate-400',  dot: 'bg-slate-400',  border: 'border-slate-300',  bg: 'bg-slate-50',  text: 'text-slate-700',  arrow: '↕', gradient: 'from-slate-500 to-slate-400'   },
  center_right: { label: { de: 'Mitte-Rechts', en: 'Center-Right', ru: 'Центр-Право' }, bar: 'bg-sky-500',    dot: 'bg-sky-500',    border: 'border-sky-300',    bg: 'bg-sky-50',    text: 'text-sky-700',    arrow: '↗', gradient: 'from-sky-500 to-blue-500'      },
  right:        { label: { de: 'Rechts',       en: 'Right',        ru: 'Правые'      }, bar: 'bg-blue-700',   dot: 'bg-blue-700',   border: 'border-blue-300',   bg: 'bg-blue-50',   text: 'text-blue-800',   arrow: '→', gradient: 'from-blue-700 to-blue-500'     },
};

const DEEP_FEATURES: Record<string, { icon: string; title: string; desc: string; accent: string }[]> = {
  de: [
    { icon: '✓', title: 'Belegte Fakten (NLI)',      desc: 'Jeder gemeinsame Fakt wird gegen den Quelltext geprüft — Belegt / Unbelegt / Widerspruch — mit Link zur Quelle',                                accent: 'bg-emerald-500' },
    { icon: '↕', title: 'Divergenzpunkte + Belege',  desc: 'Dieselben Ereignisse, unterschiedliche Deutungen — jede Lager-Sicht mit Quellenlink',                                                            accent: 'bg-amber-400'   },
    { icon: '◌', title: 'Verifiziertes Verschweigen',desc: 'Über Feed-Gesundheit: echtes Verschweigen vs. „nur Leitmedien still" vs. „nicht bewertbar" (Ladefehler)',                                       accent: 'bg-rose-500'    },
    { icon: '◆', title: 'Vertrauenswert (0–100)',    desc: 'Aus Spektrumsbreite, Beleg-Quote und Aussagen-Abdeckung — sichtbar bei jeder Analyse',                                                          accent: 'bg-violet-600'  },
    { icon: '⊞', title: 'Quellen-Landkarte',         desc: 'Spektrum × Faktentreue — wer berichtet und wie verlässlich, auf einen Blick',                                                                    accent: 'bg-sky-500'     },
    { icon: '≡', title: 'Reichweiten-Balance',       desc: 'Abdeckung gewichtet nach Publikumsreichweite, nicht nur nach Artikelzahl',                                                                       accent: 'bg-violet-500'  },
    { icon: '⏱', title: 'Zeitverlauf',               desc: 'Wer berichtete zuerst, wer spät, wer gar nicht — Berichterstattung über die Zeit',                                                               accent: 'bg-pink-500'    },
    { icon: '⌗', title: 'Unterthemen-Cluster',       desc: 'Die Story in Teilstränge zerlegt — inkl. Aspekten, die nur ein Lager erzählt',                                                                   accent: 'bg-teal-500'    },
    { icon: '#', title: 'Geframte Sprache',          desc: 'Schlüsselwörter pro Lager — hervorgehoben, was nur ein Lager verwendet (Framing)',                                                               accent: 'bg-indigo-500'  },
    { icon: '◈', title: 'Geprüfte Experten',         desc: 'Nur Namen, die wirklich im Quelltext vorkommen — erfundene werden ausgeblendet',                                                                 accent: 'bg-orange-500'  },
  ],
  en: [
    { icon: '✓', title: 'Verified facts (NLI)',      desc: 'Every shared fact is checked against the source text — Verified / Unverified / Contradicted — with a link to the source',                          accent: 'bg-emerald-500' },
    { icon: '↕', title: 'Diverging points + sources',desc: 'Same events, different framings — each camp view linked to its source article',                                                                  accent: 'bg-amber-400'   },
    { icon: '◌', title: 'Verified silence',          desc: 'Via feed health: real silence vs. "flagships silent" vs. "not assessable" (load error)',                                                         accent: 'bg-rose-500'    },
    { icon: '◆', title: 'Confidence score (0–100)',  desc: 'From spectrum breadth, citation ratio and statement coverage — shown on every analysis',                                                         accent: 'bg-violet-600'  },
    { icon: '⊞', title: 'Source map',                desc: 'Spectrum × factuality — who covers it and how reliably, at a glance',                                                                            accent: 'bg-sky-500'     },
    { icon: '≡', title: 'Reach balance',             desc: 'Coverage weighted by audience reach, not just article count',                                                                                    accent: 'bg-violet-500'  },
    { icon: '⏱', title: 'Timeline',                  desc: 'Who reported first, who lagged, who ignored it — coverage over time',                                                                            accent: 'bg-pink-500'    },
    { icon: '⌗', title: 'Sub-story clusters',        desc: 'The story split into threads — including angles only one camp tells',                                                                            accent: 'bg-teal-500'    },
    { icon: '#', title: 'Framed language',           desc: 'Keywords per camp — highlighting words used by only one camp (framing)',                                                                         accent: 'bg-indigo-500'  },
    { icon: '◈', title: 'Verified experts',          desc: 'Only names that actually appear in the source text — fabricated ones are hidden',                                                                accent: 'bg-orange-500'  },
  ],
};

const PIPELINE: Record<string, { n: string; title: string; desc: string; color: string; dotColor: string }[]> = {
  de: [
    { n: '01', title: 'Korpus-Aufbau (laufend)',     desc: 'Ein eigener Worker liest rund um die Uhr 33 RSS-Feeds aus 34 Medien. Aus jedem Artikel wird nur eine eigene Kurzzusammenfassung + ein kurzer Anriss + ein semantischer Vektor abgeleitet und gespeichert — der Volltext wird verworfen (rechtssicher).', color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'Hybride Suche',               desc: 'Dein Thema wird semantisch (Vektor-Ähnlichkeit) UND lexikalisch (Volltext) im Korpus gesucht und per Reciprocal-Rank-Fusion zusammengeführt — so finden wir auch Paraphrasen, nicht nur exakte Wörter.',                                   color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'KI-Analyse auf echtem Text',  desc: 'Gemini 2.5 Flash analysiert die abgerufenen Artikel und schreibt fünf perspektivische Zusammenfassungen — auf Basis des echten Artikeltexts, nicht nur der Schlagzeile.',                                                            color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'Verifikation & Belege',       desc: 'Jeder von der KI genannte Artikel wird gegen den Korpus geprüft und mit der echten Quell-URL verlinkt. Aussagen werden gegen den Quelltext gegengecheckt (NLI), nicht belegbare „Experten" werden entfernt.',                       color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Verschweigen & Vertrauenswert', desc: 'Über die Feed-Gesundheit unterscheiden wir echtes Verschweigen von Ladefehlern. Aus Spektrumsbreite, Beleg-Quote und Aussagen-Abdeckung entsteht ein transparenter Vertrauenswert (0–100).',                                            color: 'border-violet-600',  dotColor: 'bg-violet-600'  },
    { n: '06', title: 'Übersetzung & Cache',         desc: 'Bei EN/RU wird semantisch übersetzt; Ergebnisse werden gecacht. Die hybride Suche über den Korpus liefert die nächste Anfrage nahezu sofort.',                                                                                       color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
  ],
  en: [
    { n: '01', title: 'Corpus building (continuous)', desc: 'A dedicated worker reads 33 RSS feeds from 34 outlets around the clock. From each article we derive and store ONLY our own short summary + a brief lede + a semantic vector — the full text is discarded (legally clean).', color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'Hybrid retrieval',            desc: 'Your topic is searched semantically (vector similarity) AND lexically (full-text) over the corpus, fused via Reciprocal Rank Fusion — so we catch paraphrases, not just exact words.',                                          color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'AI analysis on real text',    desc: 'Gemini 2.5 Flash analyses the retrieved articles and writes five perspective summaries — based on the real article text, not just the headline.',                                                                                   color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'Verification & citations',    desc: 'Every article the AI names is checked against the corpus and linked to its real source URL. Claims are cross-checked against the source text (NLI); unverifiable "experts" are removed.',                                color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Silence & confidence',        desc: 'Feed-health data distinguishes real editorial silence from load errors. A transparent confidence score (0–100) is computed from spectrum breadth, citation ratio and statement coverage.',                              color: 'border-violet-600',  dotColor: 'bg-violet-600'  },
    { n: '06', title: 'Translation & cache',         desc: 'For EN/RU results are semantically translated; results are cached. Hybrid corpus search makes the next request near-instant.',                                                                                                   color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
  ],
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export const MethodologyPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const m = t.methodology;
  const [activeSpectrum, setActiveSpectrum] = useState<SpectrumKey | null>(null);

  const { ref: pipeRef,   inView: pipeInView   } = useInView(0.05);
  const { ref: deepRef,   inView: deepInView   } = useInView(0.05);
  const { ref: notRef,    inView: notInView    } = useInView(0.1);
  const { ref: limitsRef, inView: limitsInView } = useInView(0.1);

  const L = {
    de: {
      pipeTitle: 'Technische Pipeline',
      sourcesTitle: m.sourcesTitle,
      sourceSub: 'Klick auf ein Lager, um die Quellen zu sehen',
      classifyTitle: m.classifyTitle,
      deepTitle: (m as any).deepTitle as string,
      trendingTitle: (m as any).trendingTitle as string,
      notTitle: m.notTitle,
      limitsTitle: m.limitsTitle,
      totalSources: 'Quellen gesamt',
      verified: 'Verifiziert',
      suggestCta: m.suggestCta,
    },
    en: {
      pipeTitle: 'Technical pipeline',
      sourcesTitle: m.sourcesTitle,
      sourceSub: 'Click a spectrum to see its sources',
      classifyTitle: m.classifyTitle,
      deepTitle: (m as any).deepTitle as string,
      trendingTitle: (m as any).trendingTitle as string,
      notTitle: m.notTitle,
      limitsTitle: m.limitsTitle,
      totalSources: 'Total sources',
      verified: 'Verified',
      suggestCta: m.suggestCta,
    },
  }[lang === 'ru' ? 'de' : lang]!;

  const totalSources = Object.values(SOURCES).reduce((s, arr) => s + arr.length, 0);

  const methTitle = lang === 'de'
    ? 'Methodik – Wie wir analysieren | NeutralNachrichten'
    : 'Methodology – How we analyse | NeutralNachrichten';
  const methDesc = lang === 'de'
    ? 'Erfahre, wie NeutralNachrichten 33 deutsche Medien aus 5 politischen Lagern in Echtzeit analysiert – mit KI, RSS-Streaming und voller Transparenz.'
    : 'Learn how NeutralNachrichten analyses 33 German outlets from 5 political camps in real time – with AI, RSS streaming and full transparency.';

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Helmet>
        <title>{methTitle}</title>
        <meta name="description" content={methDesc} />
        <link rel="canonical" href="https://www.neutralenachrichten.com/methodology" />
        <meta property="og:title" content={methTitle} />
        <meta property="og:description" content={methDesc} />
        <meta property="og:url" content="https://www.neutralenachrichten.com/methodology" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.neutralenachrichten.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={methTitle} />
        <meta name="twitter:description" content={methDesc} />
      </Helmet>

      {/* Back */}
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
        <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
        {t.backToHome}
      </Link>

      {/* ════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden mb-8 animate-fade-in">
        <div className="h-2 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="bg-[#1a1a1a] dark:bg-[#0a0a0a] px-6 sm:px-10 py-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 font-serif font-black text-[100px] leading-none text-white/[0.03] select-none pointer-events-none pr-4">
            M
          </div>
          <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-white/40 mb-3">{m.title}</p>
          <h1 className="font-serif font-black text-2xl sm:text-3xl text-white leading-tight mb-4 relative z-10">
            {m.howTitle}
          </h1>
          <p className="font-serif text-sm text-white/60 leading-relaxed max-w-xl relative z-10">
            {m.howBody}
          </p>
        </div>
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-2 divide-y-2 sm:divide-y-0 divide-[#1a1a1a] dark:divide-gray-700 border-t-2 border-[#1a1a1a] dark:border-gray-700">
          <div className="px-5 py-4 dark:bg-[#141414]">
            <p className="font-serif font-black text-2xl text-rose-600">33</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">{L.totalSources}</p>
          </div>
          <div className="px-5 py-4 dark:bg-[#141414]">
            <p className="font-serif font-black text-2xl text-emerald-600">5</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {lang === 'de' ? 'Politische Lager' : 'Political camps'}
            </p>
          </div>
          <div className="px-5 py-4 dark:bg-[#141414]">
            <p className="font-serif font-black text-2xl text-orange-500">~2s</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {lang === 'de' ? 'Erste Ergebnisse' : 'First results'}
            </p>
          </div>
          <div className="px-5 py-4 dark:bg-[#141414]">
            <p className="font-serif font-black text-2xl text-sky-600">2</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {lang === 'de' ? 'Sprachen' : 'Languages'}
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PIPELINE — 4 steps with connecting line
      ════════════════════════════════════════════════════════ */}
      <div ref={pipeRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.pipeTitle}</p>
        </div>
        <div className="p-6 dark:bg-[#141414]">
          {/* Desktop: horizontal steps */}
          <div className="hidden sm:grid grid-cols-5 relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-[10%] right-[10%] h-px bg-[#e0d8cf] dark:bg-gray-700 z-0" />
            {(PIPELINE[lang] ?? PIPELINE['de']).map((step, i) => (
              <div
                key={step.n}
                className={`flex flex-col items-center gap-3 relative z-10 px-3 transition-all duration-500 ${pipeInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Number circle */}
                <div className={`w-10 h-10 border-2 ${step.color} flex items-center justify-center bg-[#FFF8F0] dark:bg-[#141414]`}>
                  <span className={`font-serif font-black text-xs ${step.color.replace('border-', 'text-')}`}>{step.n}</span>
                </div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] text-center leading-tight">{step.title}</p>
                <p className="font-serif text-[11px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          {/* Mobile: vertical steps */}
          <div className="sm:hidden space-y-0">
            {(PIPELINE[lang] ?? PIPELINE['de']).map((step, i) => (
              <div key={step.n} className="flex gap-4 relative">
                {/* Left column: dot + line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 border-2 ${step.color} flex items-center justify-center bg-[#FFF8F0] dark:bg-[#141414] shrink-0`}>
                    <span className={`font-serif font-black text-[10px] ${step.color.replace('border-', 'text-')}`}>{step.n}</span>
                  </div>
                  {i < (PIPELINE[lang] ?? PIPELINE['de']).length - 1 && (
                    <div className="w-px flex-1 bg-[#e0d8cf] dark:bg-gray-700 my-1" />
                  )}
                </div>
                <div className="pb-5 pt-0.5 flex-1">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] mb-1">{step.title}</p>
                  <p className="font-serif text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SOURCES — interactive spectrum tabs
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.sourcesTitle}</p>
          <p className="font-sans text-[9px] text-white/40 uppercase tracking-widest">{L.sourceSub}</p>
        </div>

        {/* Spectrum bar selector */}
        <div className="flex border-b-2 border-[#1a1a1a] dark:border-gray-700">
          {SPECTRUM_ORDER.map(s => {
            const cfg = SPECTRUM_CFG[s];
            const isActive = activeSpectrum === s;
            return (
              <button
                key={s}
                onClick={() => setActiveSpectrum(isActive ? null : s)}
                className={`flex-1 py-3 flex flex-col items-center gap-1.5 transition-colors border-r last:border-r-0 border-[#1a1a1a] dark:border-gray-700 ${
                  isActive ? 'bg-[#1a1a1a] dark:bg-gray-800' : 'hover:bg-[#f0e8dc] dark:hover:bg-[#1e1a14]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                <span className={`font-sans text-[8px] font-bold uppercase tracking-widest hidden sm:block ${
                  isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {cfg.label[lang]}
                </span>
                <span className={`font-sans text-[10px] font-bold ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                  {cfg.arrow}
                </span>
              </button>
            );
          })}
        </div>

        {/* Source list — shown for selected spectrum */}
        {activeSpectrum ? (
          <div className={`px-6 py-5 ${SPECTRUM_CFG[activeSpectrum].bg} border-b-2 border-[#1a1a1a]`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-1 self-stretch ${SPECTRUM_CFG[activeSpectrum].bar}`} />
              <div>
                <p className={`font-sans text-[10px] font-bold uppercase tracking-widest ${SPECTRUM_CFG[activeSpectrum].text}`}>
                  {SPECTRUM_CFG[activeSpectrum].label[lang]}
                </p>
                <p className="font-sans text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">
                  {SOURCES[activeSpectrum].length} {lang === 'de' ? 'Quellen' : 'sources'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SOURCES[activeSpectrum].map(src => (
                <div key={src} className={`flex items-center gap-2 px-3 py-2 border ${SPECTRUM_CFG[activeSpectrum].border} bg-white/60 dark:bg-black/20`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SPECTRUM_CFG[activeSpectrum].dot}`} />
                  <span className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">{src}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* All spectrums overview */
          <div className="overflow-x-auto">
            <div className="grid grid-cols-5 min-w-[480px]">
              {SPECTRUM_ORDER.map(s => {
                const cfg = SPECTRUM_CFG[s];
                return (
                  <div key={s} className="border-r last:border-r-0 border-[#e0d8cf] dark:border-gray-700 dark:bg-[#141414]">
                    <div className={`h-1 w-full bg-gradient-to-r ${cfg.gradient}`} />
                    <div className="p-3">
                      <p className={`font-sans text-[9px] font-bold uppercase tracking-widest mb-2 ${cfg.text}`}>
                        {cfg.label[lang]}
                      </p>
                      <div className="space-y-1">
                        {SOURCES[s].map(src => (
                          <p key={src} className="font-serif text-[11px] text-[#1a1a1a] dark:text-[#f0ece4] leading-snug">{src}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          CLASSIFICATION
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.classifyTitle}</p>
        </div>
        <div className="px-6 py-5 dark:bg-[#141414] flex flex-col sm:flex-row gap-5">
          <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed flex-1">{m.classifyBody}</p>
          {/* Visual: outlet-level, not article-level */}
          <div className="sm:w-48 shrink-0 space-y-2">
            {[
              { label: lang === 'de' ? 'Outlet-Ebene' : 'Outlet level', active: true  },
              { label: lang === 'de' ? 'Artikel-Ebene' : 'Article level', active: false },
            ].map(({ label, active }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-2 border-2 ${active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-[#e0d8cf] dark:border-gray-700 opacity-50'}`}>
                <span className={`text-xs font-bold ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{active ? '✓' : '✕'}</span>
                <span className="font-sans text-[10px] uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          DEEP ANALYSIS FEATURES — 7 cards
      ════════════════════════════════════════════════════════ */}
      <div ref={deepRef} className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4] shrink-0">{L.deepTitle}</p>
          <div className="flex-1 h-px bg-[#1a1a1a] dark:bg-gray-600 opacity-15 dark:opacity-100" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(DEEP_FEATURES[lang] ?? DEEP_FEATURES['de']).map((f, i) => (
            <div
              key={f.title}
              className={`group border-2 border-[#1a1a1a] dark:border-gray-700 p-5 hover:bg-[#1a1a1a] dark:bg-[#141414] dark:hover:bg-gray-800 transition-colors duration-200 cursor-default
                transition-all duration-500 ${deepInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-7 h-7 ${f.accent} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-bold text-sm">{f.icon}</span>
                </div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] group-hover:text-white transition-colors">
                  {f.title}
                </p>
              </div>
              <p className="font-serif text-xs text-gray-500 dark:text-gray-400 group-hover:text-white/60 leading-relaxed transition-colors">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          TRENDING
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.trendingTitle}</p>
        </div>
        <div className="px-6 py-5 dark:bg-[#141414]">
          <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{(m as any).trendingBody}</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          WHAT WE DON'T DO
      ════════════════════════════════════════════════════════ */}
      <div ref={notRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.notTitle}</p>
        </div>
        <div className="divide-y divide-[#e0d8cf] dark:divide-gray-700">
          {m.notItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 px-6 py-3.5 dark:bg-[#141414] transition-all duration-500 ${notInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="font-serif font-black text-rose-500 text-lg leading-none shrink-0 mt-0.5">✕</span>
              <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          LIMITATIONS — amber warning panel
      ════════════════════════════════════════════════════════ */}
      <div ref={limitsRef} className="mb-8 border-2 border-amber-500 overflow-hidden">
        <div className="bg-amber-500 px-6 py-3 flex items-center gap-2">
          <span className="text-white font-bold">⚠</span>
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.limitsTitle}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 divide-y divide-amber-200 dark:divide-amber-900/30">
          {m.limitsItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 px-6 py-3.5 transition-all duration-500 ${limitsInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span className="font-sans text-[10px] font-bold text-amber-600 w-5 shrink-0 mt-0.5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CTA
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-5 dark:bg-[#141414] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
              {lang === 'de' ? 'Quelle fehlt?' : 'Missing a source?'}
            </p>
            <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">{m.suggestCta}</p>
          </div>
          <Link
            to="/suggest"
            className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-700 text-white px-5 py-2.5 hover:bg-rose-600 transition-colors whitespace-nowrap shrink-0"
          >
            ↗ {lang === 'de' ? 'Quelle vorschlagen' : 'Suggest a source'}
          </Link>
        </div>
      </div>

    </div>
  );
};
