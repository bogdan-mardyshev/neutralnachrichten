import React, { useState, useEffect, useRef } from 'react';
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

const PIPELINE: Record<Language, { n: string; title: string; desc: string; color: string; dotColor: string }[]> = {
  de: [
    { n: '01', title: 'Thema eingeben',              desc: 'Du gibst ein Thema ein — auf Deutsch, Englisch oder Russisch. Das System übersetzt intern ins Deutsche, falls nötig.',                                   color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'RSS-Streaming (~2s)',          desc: '18 RSS-Feeds werden parallel abgerufen und sofort per SSE an den Browser gestreamt — echte Artikel erscheinen, bevor die KI überhaupt startet.',        color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'KI-Analyse (15–45s)',          desc: 'Gemini 2.5 Flash durchsucht alle 5 Spektren gleichzeitig via Google Search Grounding. Perspektiv-Zusammenfassungen und Fakten-Check werden generiert.',  color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'Übersetzung & Deep Analysis', desc: 'Bei EN/RU-Anfragen wird das Ergebnis semantisch übersetzt. Die Tiefenanalyse (Fakten, Divergenzen, Blind Spots) läuft parallel als zweiter Gemini-Call.',color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Cache & Auslieferung',        desc: 'Ergebnisse werden 24h in PostgreSQL + RAM gecacht. Nächste Anfrage zum gleichen Thema: sofort. RSS wird immer frisch abgerufen.',                        color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
  ],
  en: [
    { n: '01', title: 'Enter topic',                 desc: 'You enter a topic — in German, English or Russian. The system translates to German internally if needed.',                                                color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'RSS streaming (~2s)',          desc: '18 RSS feeds are fetched in parallel and streamed to the browser instantly via SSE — real articles appear before the AI has even started.',               color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'AI analysis (15–45s)',         desc: 'Gemini 2.5 Flash searches all 5 spectra simultaneously via Google Search Grounding. Perspective summaries and fact-checks are generated.',               color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'Translation & deep analysis', desc: 'For EN/RU queries, results are semantically translated. Deep analysis (shared facts, diverging points, blind spots) runs in parallel as a second Gemini call.', color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Cache & delivery',            desc: 'Results are cached 24h in PostgreSQL + RAM. Next request for the same topic: instant. RSS is always fetched fresh.',                                      color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
  ],
  ru: [
    { n: '01', title: 'Введите тему',                desc: 'Вы вводите тему — на немецком, английском или русском. При необходимости система автоматически переводит на немецкий.',                                   color: 'border-rose-500',    dotColor: 'bg-rose-500'    },
    { n: '02', title: 'RSS-стриминг (~2с)',           desc: '18 RSS-лент загружаются параллельно и мгновенно стримятся в браузер через SSE — реальные статьи появляются до того, как ИИ вообще начал работу.',        color: 'border-orange-400',  dotColor: 'bg-orange-400'  },
    { n: '03', title: 'ИИ-анализ (15–45с)',           desc: 'Gemini 2.5 Flash одновременно обходит все 5 спектров через Google Search Grounding. Генерируются перспективные резюме и проверка фактов.',               color: 'border-amber-400',   dotColor: 'bg-amber-400'   },
    { n: '04', title: 'Перевод и глубокий анализ',   desc: 'Для EN/RU запросов результат семантически переводится. Глубокий анализ (факты, расхождения, слепые пятна) параллельно выполняется вторым вызовом Gemini.', color: 'border-emerald-500', dotColor: 'bg-emerald-500' },
    { n: '05', title: 'Кэш и доставка',              desc: 'Результаты кэшируются на 24ч в PostgreSQL + ОЗУ. Следующий запрос по той же теме — мгновенно. RSS всегда загружается свежим.',                           color: 'border-blue-600',    dotColor: 'bg-blue-600'    },
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
    },
  }[lang];

  const totalSources = Object.values(SOURCES).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="max-w-4xl mx-auto pb-16">

      {/* Back */}
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
        <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
        {t.backToHome}
      </Link>

      {/* ════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] overflow-hidden mb-8 animate-fade-in">
        <div className="h-2 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="bg-[#1a1a1a] px-6 sm:px-10 py-8 relative overflow-hidden">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-2 divide-y-2 sm:divide-y-0 divide-[#1a1a1a] border-t-2 border-[#1a1a1a]">
          <div className="px-5 py-4">
            <p className="font-serif font-black text-2xl text-rose-600">18</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{L.totalSources}</p>
          </div>
          <div className="px-5 py-4">
            <p className="font-serif font-black text-2xl text-emerald-600">5</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
              {lang === 'de' ? 'Politische Lager' : lang === 'ru' ? 'Политических лагерей' : 'Political camps'}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="font-serif font-black text-2xl text-orange-500">~2s</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
              {lang === 'de' ? 'Erste Ergebnisse' : lang === 'ru' ? 'Первые результаты' : 'First results'}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="font-serif font-black text-2xl text-sky-600">3</p>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
              {lang === 'de' ? 'Sprachen' : lang === 'ru' ? 'Языка' : 'Languages'}
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PIPELINE — 4 steps with connecting line
      ════════════════════════════════════════════════════════ */}
      <div ref={pipeRef} className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.pipeTitle}</p>
        </div>
        <div className="p-6">
          {/* Desktop: horizontal steps */}
          <div className="hidden sm:grid grid-cols-5 relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-[10%] right-[10%] h-px bg-[#e0d8cf] z-0" />
            {PIPELINE[lang].map((step, i) => (
              <div
                key={step.n}
                className={`flex flex-col items-center gap-3 relative z-10 px-3 transition-all duration-500 ${pipeInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Number circle */}
                <div className={`w-10 h-10 border-2 ${step.color} flex items-center justify-center bg-[#FFF8F0]`}>
                  <span className={`font-serif font-black text-xs ${step.color.replace('border-', 'text-')}`}>{step.n}</span>
                </div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] text-center leading-tight">{step.title}</p>
                <p className="font-serif text-[11px] text-gray-400 text-center leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          {/* Mobile: vertical steps */}
          <div className="sm:hidden space-y-0">
            {PIPELINE[lang].map((step, i) => (
              <div key={step.n} className="flex gap-4 relative">
                {/* Left column: dot + line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 border-2 ${step.color} flex items-center justify-center bg-[#FFF8F0] shrink-0`}>
                    <span className={`font-serif font-black text-[10px] ${step.color.replace('border-', 'text-')}`}>{step.n}</span>
                  </div>
                  {i < PIPELINE[lang].length - 1 && (
                    <div className="w-px flex-1 bg-[#e0d8cf] my-1" />
                  )}
                </div>
                <div className="pb-5 pt-0.5 flex-1">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">{step.title}</p>
                  <p className="font-serif text-xs text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SOURCES — interactive spectrum tabs
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.sourcesTitle}</p>
          <p className="font-sans text-[9px] text-white/40 uppercase tracking-widest">{L.sourceSub}</p>
        </div>

        {/* Spectrum bar selector */}
        <div className="flex border-b-2 border-[#1a1a1a]">
          {SPECTRUM_ORDER.map(s => {
            const cfg = SPECTRUM_CFG[s];
            const isActive = activeSpectrum === s;
            return (
              <button
                key={s}
                onClick={() => setActiveSpectrum(isActive ? null : s)}
                className={`flex-1 py-3 flex flex-col items-center gap-1.5 transition-colors border-r last:border-r-0 border-[#1a1a1a] ${
                  isActive ? 'bg-[#1a1a1a]' : 'hover:bg-[#f0e8dc]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                <span className={`font-sans text-[8px] font-bold uppercase tracking-widest hidden sm:block ${
                  isActive ? 'text-white' : 'text-gray-500'
                }`}>
                  {cfg.label[lang]}
                </span>
                <span className={`font-sans text-[10px] font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>
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
                <div key={src} className={`flex items-center gap-2 px-3 py-2 border ${SPECTRUM_CFG[activeSpectrum].border} bg-white/60`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SPECTRUM_CFG[activeSpectrum].dot}`} />
                  <span className="font-serif text-sm text-[#1a1a1a]">{src}</span>
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
                  <div key={s} className="border-r last:border-r-0 border-[#e0d8cf]">
                    <div className={`h-1 w-full bg-gradient-to-r ${cfg.gradient}`} />
                    <div className="p-3">
                      <p className={`font-sans text-[9px] font-bold uppercase tracking-widest mb-2 ${cfg.text}`}>
                        {cfg.label[lang]}
                      </p>
                      <div className="space-y-1">
                        {SOURCES[s].map(src => (
                          <p key={src} className="font-serif text-[11px] text-[#1a1a1a] leading-snug">{src}</p>
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
      <div className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.classifyTitle}</p>
        </div>
        <div className="px-6 py-5 flex flex-col sm:flex-row gap-5">
          <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed flex-1">{m.classifyBody}</p>
          {/* Visual: outlet-level, not article-level */}
          <div className="sm:w-48 shrink-0 space-y-2">
            {[
              { label: lang === 'de' ? 'Outlet-Ebene' : lang === 'ru' ? 'Уровень издания' : 'Outlet level', active: true  },
              { label: lang === 'de' ? 'Artikel-Ebene' : lang === 'ru' ? 'Уровень статьи' : 'Article level', active: false },
            ].map(({ label, active }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-2 border-2 ${active ? 'border-emerald-500 bg-emerald-50' : 'border-[#e0d8cf] opacity-50'}`}>
                <span className={`text-xs font-bold ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{active ? '✓' : '✕'}</span>
                <span className="font-sans text-[10px] uppercase tracking-wider text-[#1a1a1a]">{label}</span>
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
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] shrink-0">{L.deepTitle}</p>
          <div className="flex-1 h-px bg-[#1a1a1a] opacity-15" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEEP_FEATURES[lang].map((f, i) => (
            <div
              key={f.title}
              className={`group border-2 border-[#1a1a1a] p-5 hover:bg-[#1a1a1a] transition-colors duration-200 cursor-default
                transition-all duration-500 ${deepInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-7 h-7 ${f.accent} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-bold text-sm">{f.icon}</span>
                </div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] group-hover:text-white transition-colors">
                  {f.title}
                </p>
              </div>
              <p className="font-serif text-xs text-gray-500 group-hover:text-white/60 leading-relaxed transition-colors">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          TRENDING
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.trendingTitle}</p>
        </div>
        <div className="px-6 py-5">
          <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{(m as any).trendingBody}</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          WHAT WE DON'T DO
      ════════════════════════════════════════════════════════ */}
      <div ref={notRef} className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.notTitle}</p>
        </div>
        <div className="divide-y divide-[#e0d8cf]">
          {m.notItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 px-6 py-3.5 transition-all duration-500 ${notInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="font-serif font-black text-rose-500 text-lg leading-none shrink-0 mt-0.5">✕</span>
              <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{item}</p>
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
        <div className="bg-amber-50 divide-y divide-amber-200">
          {m.limitsItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 px-6 py-3.5 transition-all duration-500 ${limitsInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span className="font-sans text-[10px] font-bold text-amber-600 w-5 shrink-0 mt-0.5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CTA
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-1">
              {lang === 'de' ? 'Quelle fehlt?' : lang === 'ru' ? 'Нет источника?' : 'Missing a source?'}
            </p>
            <p className="font-serif text-sm text-[#1a1a1a]">{m.suggestCta}</p>
          </div>
          <Link
            to="/suggest"
            className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] text-white px-5 py-2.5 hover:bg-rose-600 transition-colors whitespace-nowrap shrink-0"
          >
            ↗ {lang === 'de' ? 'Quelle vorschlagen' : lang === 'ru' ? 'Предложить источник' : 'Suggest a source'}
          </Link>
        </div>
      </div>

    </div>
  );
};
