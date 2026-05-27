import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

// ── Data ─────────────────────────────────────────────────────────────────────

const SOURCES = {
  left:         ['taz', 'nd-aktuell', 'Junge Welt'],
  center_left:  ['Der Spiegel', 'Süddeutsche Zeitung', 'Die Zeit', 'Tagesspiegel'],
  center:       ['Tagesschau', 'ZDF heute', 'Deutschlandfunk'],
  center_right: ['FAZ', 'Die Welt', 'Focus', 'NTV', 'Handelsblatt'],
  right:        ['Bild', 'Junge Freiheit', 'Tichys Einblick'],
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

const DEEP_FEATURES: Record<Language, { icon: string; title: string; desc: string; accent: string }[]> = {
  de: [
    { icon: '◎', title: 'Gemeinsame Fakten',         desc: 'Was alle fünf Lager übereinstimmend berichten — unbestrittener Konsens',                          accent: 'bg-emerald-500' },
    { icon: '↕', title: 'Divergenzpunkte',           desc: 'Dieselben Ereignisse — unterschiedliche Deutungen über das Spektrum hinweg',                      accent: 'bg-amber-400'   },
    { icon: '◌', title: 'Blinde Flecken',            desc: 'Aspekte, die nur von einem Lager oder gar nicht berichtet werden',                                accent: 'bg-rose-500'    },
    { icon: '≡', title: 'Berichterstattungsvolumen', desc: 'Echte Artikelzahl pro Lager aus RSS — Woche und Monat, keine KI-Schätzung',                       accent: 'bg-violet-500'  },
    { icon: '~', title: 'Sentiment-Analyse',         desc: 'Tonalität der Berichterstattung: positiv / neutral / negativ pro Lager',                          accent: 'bg-pink-500'    },
    { icon: '#', title: 'Linguistische Analyse',     desc: 'Charakteristische Schlüsselwörter pro politischem Lager',                                          accent: 'bg-teal-500'    },
    { icon: '◈', title: 'Experten-Karte',            desc: 'Wer wird von welchen Medien zitiert — Übersicht der Quellen und Autoritäten',                      accent: 'bg-indigo-500'  },
    { icon: '📄', title: 'Original RSS-Snippets',    desc: 'Unter jeder KI-Zusammenfassung wird der originale RSS-Text gezeigt — für direkte Nachprüfbarkeit', accent: 'bg-orange-500'  },
  ],
  en: [
    { icon: '◎', title: 'Shared Facts',              desc: 'What all five camps agree on — undisputed consensus across the spectrum',                          accent: 'bg-emerald-500' },
    { icon: '↕', title: 'Diverging Points',          desc: 'Same events — different framings and interpretations across the spectrum',                         accent: 'bg-amber-400'   },
    { icon: '◌', title: 'Blind Spots',               desc: 'Angles barely covered or only covered by one side of the spectrum',                               accent: 'bg-rose-500'    },
    { icon: '≡', title: 'Coverage Volume',           desc: 'Real article count per camp from RSS — week and month, no AI estimation',                          accent: 'bg-violet-500'  },
    { icon: '~', title: 'Sentiment Analysis',        desc: 'Overall tone of coverage: positive / neutral / negative per camp',                                 accent: 'bg-pink-500'    },
    { icon: '#', title: 'Linguistic Analysis',       desc: 'Characteristic keywords per political camp — their linguistic fingerprint',                        accent: 'bg-teal-500'    },
    { icon: '◈', title: 'Expert Map',                desc: 'Who is cited by which media — overview of referenced sources and authorities',                     accent: 'bg-indigo-500'  },
    { icon: '📄', title: 'Original RSS Snippets',    desc: 'Below each AI summary, the original RSS text is shown — for direct verification',                  accent: 'bg-orange-500'  },
  ],
  ru: [
    { icon: '◎', title: 'Общие факты',              desc: 'С чем согласны все пять лагерей — бесспорный консенсус по всему спектру',                          accent: 'bg-emerald-500' },
    { icon: '↕', title: 'Точки расхождения',        desc: 'Одни события — разные интерпретации и подача по всему спектру',                                   accent: 'bg-amber-400'   },
    { icon: '◌', title: 'Слепые пятна',             desc: 'Аспекты, о которых почти не говорят или говорит лишь одна сторона',                               accent: 'bg-rose-500'    },
    { icon: '≡', title: 'Объём освещения',          desc: 'Реальное количество статей из RSS по лагерям — за неделю и месяц, без оценок ИИ',                 accent: 'bg-violet-500'  },
    { icon: '~', title: 'Анализ тональности',       desc: 'Общий тон освещения: позитивный / нейтральный / негативный по лагерям',                           accent: 'bg-pink-500'    },
    { icon: '#', title: 'Лингвистический анализ',   desc: 'Характерные ключевые слова по политическому лагерю — их языковой отпечаток',                       accent: 'bg-teal-500'    },
    { icon: '◈', title: 'Карта экспертов',          desc: 'Кого цитируют какие СМИ — обзор упоминаемых источников и авторитетов',                             accent: 'bg-indigo-500'  },
    { icon: '📄', title: 'Оригинальные RSS-сниппеты', desc: 'Под каждым AI-резюме показывается оригинальный текст из RSS — для прямой проверки',              accent: 'bg-orange-500'  },
  ],
};

// Updated pipeline: 5 steps, no Google Search Grounding, RSS-direct
const PIPELINE: Record<Language, { n: string; title: string; desc: string; color: string; dotColor: string }[]> = {
  de: [
    { n: '01', title: 'Thema eingeben',                   desc: 'Du gibst ein Thema ein — auf Deutsch, Englisch oder Russisch. Das System übersetzt intern ins Deutsche, falls nötig.',                                                                          color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'Keyword-Extraktion v2',            desc: 'extractSearchKeywords v2 zerlegt Komposita (Klimawandel → klima + wandel), filtert deutsche Stoppwörter heraus und gewichtet nach Aktualität — findet 18× mehr relevante Artikel als v1.',       color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'RSS-Abruf parallel (3–8s)',        desc: '18 RSS-Feeds werden gleichzeitig abgerufen, 15-Minuten-Cache vermeidet redundante Anfragen. Erste Artikel erscheinen per SSE-Stream im Browser, bevor die KI startet.',                          color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'RSS-Direct Gemini (3–10s)',        desc: 'Gemini 2.5 Flash erhält die RSS-Artikel direkt als Kontext — keine Google-Search-Runde, kein Grounding. Ergebnis: 3–10s statt 15–45s, und 78× niedrigere Kosten ($0,0004 statt $0,035/Anfrage).', color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Cache 24h + Tiefenanalyse',        desc: 'Ergebnisse werden 24h in PostgreSQL + RAM gecacht. Paralleler zweiter Gemini-Call für Tiefenanalyse (Fakten, Divergenzen, Blind Spots). Nächste Anfrage zum gleichen Thema: sofort.',             color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
  ],
  en: [
    { n: '01', title: 'Enter topic',                      desc: 'You enter a topic — in German, English or Russian. The system translates to German internally if needed.',                                                                                        color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'Keyword extraction v2',            desc: 'extractSearchKeywords v2 splits compound words (Klimawandel → klima + wandel), filters German stop words, and applies recency weighting — finds 18× more relevant articles than v1.',            color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'RSS fetch parallel (3–8s)',        desc: '18 RSS feeds are fetched simultaneously with a 15-minute cache to avoid redundant requests. First articles stream to the browser via SSE before the AI has started.',                            color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'RSS-direct Gemini (3–10s)',        desc: 'Gemini 2.5 Flash receives RSS articles directly as context — no Google Search round-trip, no grounding. Result: 3–10s instead of 15–45s, and 78× lower cost ($0.0004 vs $0.035/request).',     color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Cache 24h + deep analysis',        desc: 'Results are cached 24h in PostgreSQL + RAM. A parallel second Gemini call runs the deep analysis (shared facts, diverging points, blind spots). Same topic next time: instant.',                  color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
  ],
  ru: [
    { n: '01', title: 'Введите тему',                     desc: 'Вы вводите тему — на немецком, английском или русском. При необходимости система автоматически переводит на немецкий.',                                                                          color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'Извлечение ключевых слов v2',      desc: 'extractSearchKeywords v2 разбивает составные слова (Klimawandel → klima + wandel), фильтрует немецкие стоп-слова и взвешивает по актуальности — находит в 18× больше релевантных статей, чем v1.', color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'Параллельный RSS-запрос (3–8с)',   desc: '18 RSS-лент загружаются одновременно, 15-минутный кэш исключает повторные запросы. Первые статьи стримятся в браузер через SSE ещё до старта ИИ.',                                              color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'RSS-Direct Gemini (3–10с)',        desc: 'Gemini 2.5 Flash получает RSS-статьи напрямую как контекст — без обращения к Google Search, без Grounding. Результат: 3–10с вместо 15–45с, стоимость в 78× ниже ($0,0004 вместо $0,035/запрос).', color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Кэш 24ч + глубокий анализ',       desc: 'Результаты кэшируются на 24ч в PostgreSQL + ОЗУ. Параллельный второй вызов Gemini выполняет глубокий анализ (факты, расхождения, слепые пятна). Повторный запрос по той же теме — мгновенно.',    color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
  ],
};

// Truth Window rows
const TRUTH_WINDOW_ROWS: {
  badge: string; badgeColor: string; badgeBg: string;
  time: Record<Language, string>;
  barWidth: string; multiplier: string; barColor: string;
  filtered?: boolean;
}[] = [
  { badge: 'BREAKING', badgeColor: 'text-rose-700',   badgeBg: 'bg-rose-100 dark:bg-rose-950/50',   time: { de: '< 6 Std.',  en: '< 6 hrs',   ru: '< 6 ч'   }, barWidth: '100%', multiplier: '3.0×', barColor: 'bg-rose-600'   },
  { badge: 'HEUTE',    badgeColor: 'text-orange-700', badgeBg: 'bg-orange-100 dark:bg-orange-950/40',time: { de: '< 24 Std.', en: '< 24 hrs',  ru: '< 24 ч'  }, barWidth: '66%',  multiplier: '2.0×', barColor: 'bg-orange-400' },
  { badge: '3 TAGE',   badgeColor: 'text-amber-700',  badgeBg: 'bg-amber-100 dark:bg-amber-950/40', time: { de: '< 72 Std.', en: '< 72 hrs',  ru: '< 72 ч'  }, barWidth: '50%',  multiplier: '1.5×', barColor: 'bg-amber-400'  },
  { badge: 'WOCHE',    badgeColor: 'text-slate-600',  badgeBg: 'bg-slate-100 dark:bg-slate-800/40', time: { de: '< 7 Tage',  en: '< 7 days',  ru: '< 7 дн'  }, barWidth: '33%',  multiplier: '1.0×', barColor: 'bg-slate-400'  },
  { badge: '2 WOCHEN', badgeColor: 'text-sky-700',    badgeBg: 'bg-sky-100 dark:bg-sky-950/40',     time: { de: '< 14 Tage', en: '< 14 days', ru: '< 14 дн' }, barWidth: '20%',  multiplier: '0.6×', barColor: 'bg-sky-400'    },
  { badge: 'MONAT',    badgeColor: 'text-blue-700',   badgeBg: 'bg-blue-100 dark:bg-blue-950/40',   time: { de: '< 30 Tage', en: '< 30 days', ru: '< 30 дн' }, barWidth: '10%',  multiplier: '0.3×', barColor: 'bg-blue-700'   },
  { badge: 'ÄLTER',    badgeColor: 'text-gray-400',   badgeBg: 'bg-gray-100 dark:bg-gray-800/40',   time: { de: '> 30 Tage', en: '> 30 days', ru: '> 30 дн' }, barWidth: '0%',   multiplier: '',     barColor: 'bg-gray-300',  filtered: true },
];

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

  const { ref: pipeRef,    inView: pipeInView    } = useInView(0.05);
  const { ref: truthRef,   inView: truthInView   } = useInView(0.05);
  const { ref: compRef,    inView: compInView    } = useInView(0.05);
  const { ref: costRef,    inView: costInView    } = useInView(0.05);
  const { ref: deepRef,    inView: deepInView    } = useInView(0.05);
  const { ref: notRef,     inView: notInView     } = useInView(0.1);
  const { ref: limitsRef,  inView: limitsInView  } = useInView(0.1);

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
      truthTitle: 'Truth Window — Recency-Gewichtung',
      truthSub: 'Artikel-Aktualität beeinflusst das Ranking direkt. Ältere Artikel erhalten niedrigere Scores — veraltete Inhalte werden herausgefiltert.',
      filteredLabel: 'gefiltert',
      baselineLabel: 'Baseline',
      compTitle: 'Keyword-Extraktion v2 — Komposita-Aufspaltung',
      compSub: 'Deutsche Komposita werden automatisch in ihre Bestandteile zerlegt. Das ermöglicht semantisch verwandte Treffer, die v1 vollständig verpasst hat.',
      compInput: 'Eingabe',
      compMatches: 'Gefundene Artikel',
      compResult: '18× mehr Artikel gefunden',
      costTitle: 'Kostenvergleich — Grounding vs. RSS-Direct',
      costOld: 'GROUNDING (alt)',
      costNew: 'RSS-DIRECT (neu)',
      costCheaper: '78× günstiger',
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
      truthTitle: 'Truth Window — Recency Scoring',
      truthSub: 'Article freshness directly influences ranking. Older articles receive lower scores — stale content is filtered out entirely.',
      filteredLabel: 'filtered out',
      baselineLabel: 'Baseline',
      compTitle: 'Keyword Extraction v2 — Compound Splitting',
      compSub: 'German compound words are automatically split into their components. This enables semantically related matches that v1 missed entirely.',
      compInput: 'Input',
      compMatches: 'Matched articles',
      compResult: '18× more articles found',
      costTitle: 'Cost comparison — Grounding vs. RSS-Direct',
      costOld: 'GROUNDING (old)',
      costNew: 'RSS-DIRECT (new)',
      costCheaper: '78× cheaper',
    },
    ru: {
      pipeTitle: 'Техническая цепочка',
      sourcesTitle: m.sourcesTitle,
      sourceSub: 'Нажмите на лагерь, чтобы увидеть источники',
      classifyTitle: m.classifyTitle,
      deepTitle: (m as any).deepTitle as string,
      trendingTitle: (m as any).trendingTitle as string,
      notTitle: m.notTitle,
      limitsTitle: m.limitsTitle,
      totalSources: 'Источников всего',
      verified: 'Верифицировано',
      suggestCta: m.suggestCta,
      truthTitle: 'Truth Window — взвешивание по актуальности',
      truthSub: 'Свежесть статьи напрямую влияет на рейтинг. Старые статьи получают низкие оценки — устаревший контент полностью отфильтровывается.',
      filteredLabel: 'отфильтровано',
      baselineLabel: 'Базовый',
      compTitle: 'Извлечение ключевых слов v2 — разбивка сложных слов',
      compSub: 'Немецкие сложные слова автоматически разбиваются на составные части. Это позволяет находить семантически близкие статьи, которые v1 полностью упускал.',
      compInput: 'Ввод',
      compMatches: 'Найденные статьи',
      compResult: 'в 18× больше статей',
      costTitle: 'Сравнение затрат — Grounding vs. RSS-Direct',
      costOld: 'GROUNDING (старый)',
      costNew: 'RSS-DIRECT (новый)',
      costCheaper: 'в 78× дешевле',
    },
  }[lang];

  const totalSources = Object.values(SOURCES).reduce((s, arr) => s + arr.length, 0);

  const methTitle = lang === 'de'
    ? 'Methodik – Wie wir analysieren | NeutralNachrichten'
    : lang === 'ru'
    ? 'Методология – Как мы анализируем | NeutralNachrichten'
    : 'Methodology – How we analyse | NeutralNachrichten';
  const methDesc = lang === 'de'
    ? 'Erfahre, wie NeutralNachrichten 18 deutsche Medien aus 5 politischen Lagern in Echtzeit analysiert – mit KI, RSS-Direct und voller Transparenz.'
    : lang === 'ru'
    ? 'Узнайте, как NeutralNachrichten анализирует 18 немецких изданий из 5 политических лагерей в реальном времени – с помощью ИИ, RSS-Direct и полной прозрачности.'
    : 'Learn how NeutralNachrichten analyses 18 German outlets from 5 political camps in real time – with AI, RSS-Direct and full transparency.';

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
            <p className="font-serif font-black text-2xl text-rose-600">18</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">{L.totalSources}</p>
          </div>
          <div className="px-5 py-4 dark:bg-[#141414]">
            <p className="font-serif font-black text-2xl text-emerald-600">5</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {lang === 'de' ? 'Politische Lager' : lang === 'ru' ? 'Политических лагерей' : 'Political camps'}
            </p>
          </div>
          <div className="px-5 py-4 dark:bg-[#141414]">
            <p className="font-serif font-black text-2xl text-orange-500">3–10s</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {lang === 'de' ? 'KI-Analyse (RSS-Direct)' : lang === 'ru' ? 'ИИ-анализ (RSS-Direct)' : 'AI analysis (RSS-Direct)'}
            </p>
          </div>
          <div className="px-5 py-4 dark:bg-[#141414]">
            <p className="font-serif font-black text-2xl text-sky-600">3</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {lang === 'de' ? 'Sprachen' : lang === 'ru' ? 'Языка' : 'Languages'}
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PIPELINE — 5 steps
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
            {PIPELINE[lang].map((step, i) => (
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
            {PIPELINE[lang].map((step, i) => (
              <div key={step.n} className="flex gap-4 relative">
                {/* Left column: dot + line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 border-2 ${step.color} flex items-center justify-center bg-[#FFF8F0] dark:bg-[#141414] shrink-0`}>
                    <span className={`font-serif font-black text-[10px] ${step.color.replace('border-', 'text-')}`}>{step.n}</span>
                  </div>
                  {i < PIPELINE[lang].length - 1 && (
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
          TRUTH WINDOW — recency scoring infographic
      ════════════════════════════════════════════════════════ */}
      <div ref={truthRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.truthTitle}</p>
          <span className="font-sans text-[9px] uppercase tracking-widest text-white/40">
            {lang === 'de' ? 'Recency-Score-Gewichtung' : lang === 'ru' ? 'Весовые коэффициенты' : 'Recency score multipliers'}
          </span>
        </div>
        <div className="px-6 py-4 border-b-2 border-[#1a1a1a] dark:border-gray-700 dark:bg-[#141414]">
          <p className="font-serif text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-xl">{L.truthSub}</p>
        </div>
        <div className="dark:bg-[#141414] divide-y divide-[#e0d8cf] dark:divide-gray-800">
          {TRUTH_WINDOW_ROWS.map((row, i) => (
            <div
              key={row.badge}
              className={`flex items-center gap-3 px-4 sm:px-6 py-2.5 transition-all duration-500 ${truthInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              {/* Badge */}
              <div className={`w-[74px] shrink-0 px-2 py-0.5 ${row.badgeBg} flex items-center justify-center`}>
                <span className={`font-sans text-[8px] font-bold uppercase tracking-widest ${row.badgeColor} ${row.filtered ? 'line-through opacity-50' : ''}`}>
                  {row.badge}
                </span>
              </div>
              {/* Time label */}
              <span className="font-sans text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-[54px] shrink-0">
                {row.time[lang]}
              </span>
              {/* Bar track */}
              <div className="flex-1 h-4 bg-[#f0e8dc] dark:bg-gray-800 relative overflow-hidden">
                {!row.filtered && (
                  <div
                    className={`absolute left-0 top-0 h-full ${row.barColor} transition-all duration-700`}
                    style={{ width: truthInView ? row.barWidth : '0%', transitionDelay: `${i * 70 + 200}ms` }}
                  />
                )}
              </div>
              {/* Multiplier */}
              <div className="w-[52px] shrink-0 text-right">
                {row.filtered ? (
                  <span className="font-sans text-[10px] text-gray-400 dark:text-gray-600 italic">{L.filteredLabel}</span>
                ) : (
                  <span className={`font-serif font-black text-sm ${row.multiplier === '1.0×' ? 'text-slate-500' : row.multiplier >= '2' ? 'text-rose-600' : 'text-gray-500 dark:text-gray-400'}`}>
                    {row.multiplier}
                    {row.multiplier === '1.0×' && (
                      <span className="block font-sans text-[7px] text-slate-400 uppercase tracking-wider">{L.baselineLabel}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          COMPOUND SPLIT — keyword extraction v2 visual
      ════════════════════════════════════════════════════════ */}
      <div ref={compRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.compTitle}</p>
        </div>
        <div className="px-6 py-4 border-b-2 border-[#1a1a1a] dark:border-gray-700 dark:bg-[#141414]">
          <p className="font-serif text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-xl">{L.compSub}</p>
        </div>
        <div className="p-6 dark:bg-[#141414]">
          {/* Input row */}
          <div className={`flex items-center gap-3 mb-4 transition-all duration-500 ${compInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 w-16 shrink-0">{L.compInput}:</span>
            <div className="border-2 border-[#1a1a1a] dark:border-gray-600 px-4 py-2 bg-[#FFF8F0] dark:bg-[#1a1a1a]">
              <span className="font-serif font-black text-base text-[#1a1a1a] dark:text-white tracking-wide">Klimawandel</span>
            </div>
          </div>

          {/* Arrow down */}
          <div className={`flex items-center gap-3 mb-4 transition-all duration-500 delay-100 ${compInView ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-16 shrink-0" />
            <span className="font-sans text-lg text-gray-300 dark:text-gray-600">↓</span>
          </div>

          {/* Split boxes */}
          <div className={`flex flex-wrap items-center gap-3 mb-4 transition-all duration-500 delay-150 ${compInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <div className="w-16 shrink-0" />
            {/* Full word */}
            <div className="border-2 border-orange-400 px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30">
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400">KLIMAWANDEL</span>
            </div>
            <span className="font-sans text-xs text-gray-300 dark:text-gray-600">+</span>
            {/* Split part 1 */}
            <div className="border-2 border-emerald-500 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30">
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">KLIMA</span>
            </div>
            <span className="font-sans text-xs text-gray-300 dark:text-gray-600">+</span>
            {/* Split part 2 */}
            <div className="border-2 border-emerald-500 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30">
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">WANDEL</span>
            </div>
          </div>

          {/* Arrow down */}
          <div className={`flex items-center gap-3 mb-4 transition-all duration-500 delay-200 ${compInView ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-16 shrink-0" />
            <span className="font-sans text-lg text-gray-300 dark:text-gray-600">↓</span>
          </div>

          {/* Matched articles */}
          <div className={`mb-4 transition-all duration-500 delay-[250ms] ${compInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 w-16 shrink-0">{L.compMatches}:</span>
            </div>
            <div className="flex flex-wrap gap-2 pl-[76px]">
              {['Klimakonferenz', 'Klimapolitik', 'Klimaaktivismus', 'Klimaschutz', 'Klimapaket', 'Klimarecht'].map((word) => (
                <span
                  key={word}
                  className="font-sans text-[9px] uppercase tracking-wider px-2.5 py-1 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-[#1a1a1a]"
                >
                  {word}
                </span>
              ))}
              <span className="font-sans text-[9px] text-gray-300 dark:text-gray-600 italic py-1">+ weitere …</span>
            </div>
          </div>

          {/* Result badge */}
          <div className={`flex items-center gap-3 transition-all duration-500 delay-300 ${compInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <div className="w-16 shrink-0" />
            <div className="flex items-center gap-2 border-2 border-emerald-500 bg-emerald-500 px-4 py-2">
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.compResult}</span>
              <span className="font-serif font-black text-white text-sm">✓</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          COST COMPARISON — Grounding vs RSS-Direct
      ════════════════════════════════════════════════════════ */}
      <div ref={costRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.costTitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a] dark:divide-gray-700">
          {/* LEFT: old Grounding */}
          <div className={`p-6 dark:bg-[#141414] transition-all duration-500 ${costInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{L.costOld}</span>
              <span className="font-sans text-[9px] text-rose-500 font-bold uppercase tracking-widest">✕</span>
            </div>
            <div className="space-y-3">
              {[
                { label: lang === 'de' ? 'Pro Anfrage' : lang === 'ru' ? 'За запрос' : 'Per request', value: '$0.035' },
                { label: lang === 'de' ? 'Pro 10k Anfragen' : lang === 'ru' ? 'За 10к запросов' : 'Per 10k requests', value: '$350' },
                { label: lang === 'de' ? 'Antwortzeit' : lang === 'ru' ? 'Время ответа' : 'Response time', value: '15–45s' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <span className="font-sans text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-600">{label}</span>
                  <span className="font-serif font-bold text-sm text-gray-400 dark:text-gray-600 line-through">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[#e0d8cf] dark:border-gray-700">
              <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-600">
                {lang === 'de' ? 'Google Search Grounding' : lang === 'ru' ? 'Google Search Grounding' : 'Google Search Grounding'}
              </span>
            </div>
          </div>

          {/* RIGHT: new RSS-Direct */}
          <div className={`p-6 dark:bg-[#0f1a0f] bg-emerald-50 transition-all duration-500 delay-150 ${costInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{L.costNew}</span>
              <span className="font-sans text-[9px] text-emerald-600 font-bold uppercase tracking-widest">✓</span>
            </div>
            <div className="space-y-3">
              {[
                { label: lang === 'de' ? 'Pro Anfrage' : lang === 'ru' ? 'За запрос' : 'Per request', value: '$0.0004' },
                { label: lang === 'de' ? 'Pro 10k Anfragen' : lang === 'ru' ? 'За 10к запросов' : 'Per 10k requests', value: '$4' },
                { label: lang === 'de' ? 'Antwortzeit' : lang === 'ru' ? 'Время ответа' : 'Response time', value: '3–10s' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <span className="font-sans text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-serif font-bold text-sm text-emerald-700 dark:text-emerald-400">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{L.costCheaper}</span>
                <span className="font-serif font-black text-emerald-600 dark:text-emerald-400">✓</span>
              </div>
            </div>
          </div>
        </div>
        {/* Arrow connector row */}
        <div className="hidden sm:flex items-center justify-center border-t-2 border-[#1a1a1a] dark:border-gray-700 py-2 dark:bg-[#141414]">
          <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-3">
            {lang === 'de' ? 'Migration abgeschlossen' : lang === 'ru' ? 'Миграция завершена' : 'Migration complete'}
          </span>
          <span className="font-sans text-base text-emerald-500">→</span>
          <span className="font-sans text-[9px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 ml-3 font-bold">RSS-Direct</span>
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
                  {SOURCES[activeSpectrum].length} {lang === 'de' ? 'Quellen' : lang === 'ru' ? 'источников' : 'sources'}
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
              { label: lang === 'de' ? 'Outlet-Ebene' : lang === 'ru' ? 'Уровень издания' : 'Outlet level', active: true  },
              { label: lang === 'de' ? 'Artikel-Ebene' : lang === 'ru' ? 'Уровень статьи' : 'Article level', active: false },
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
          DEEP ANALYSIS FEATURES — 8 cards
      ════════════════════════════════════════════════════════ */}
      <div ref={deepRef} className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4] shrink-0">{L.deepTitle}</p>
          <div className="flex-1 h-px bg-[#1a1a1a] dark:bg-gray-600 opacity-15 dark:opacity-100" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEEP_FEATURES[lang].map((f, i) => (
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
              {lang === 'de' ? 'Quelle fehlt?' : lang === 'ru' ? 'Нет источника?' : 'Missing a source?'}
            </p>
            <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">{m.suggestCta}</p>
          </div>
          <Link
            to="/suggest"
            className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-700 text-white px-5 py-2.5 hover:bg-rose-600 transition-colors whitespace-nowrap shrink-0"
          >
            ↗ {lang === 'de' ? 'Quelle vorschlagen' : lang === 'ru' ? 'Предложить источник' : 'Suggest a source'}
          </Link>
        </div>
      </div>

    </div>
  );
};
