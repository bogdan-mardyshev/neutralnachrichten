import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

// ── Data ─────────────────────────────────────────────────────────────────────

const TEAM = [
  {
    name: 'Bogdan Mardyshev',
    initials: 'BM',
    role: { de: 'CTO & Gründer', en: 'CTO & Co-founder', ru: 'CTO и сооснователь' },
    bio: {
      de: 'Architektur, KI-Integration und Infrastruktur. Baut die Systeme, die NeutraleNachrichten antreiben.',
      en: 'Architecture, AI integration and infrastructure. Builds the systems powering NeutralNews.',
      ru: 'Архитектура, интеграция ИИ и инфраструктура. Строит системы, на которых работает платформа.',
    },
    gradient: 'from-rose-600 via-orange-500 to-amber-400',
    tag: { de: 'Entwicklung', en: 'Engineering', ru: 'Разработка' },
  },
  {
    name: 'Romeo Giorgio Spadaro',
    initials: 'RS',
    role: { de: 'CEO & Gründer', en: 'CEO & Co-founder', ru: 'CEO и сооснователь' },
    bio: {
      de: 'Strategie, Partnerschaften und Wachstum. Treibt die Vision von unabhängiger Medienanalyse voran.',
      en: 'Strategy, partnerships and growth. Champions the vision of independent media analysis.',
      ru: 'Стратегия, партнёрства и рост. Продвигает видение независимого медиаанализа.',
    },
    gradient: 'from-blue-700 via-sky-500 to-cyan-400',
    tag: { de: 'Strategie', en: 'Strategy', ru: 'Стратегия' },
  },
  {
    name: 'Frederic Hallier',
    initials: 'FH',
    role: { de: 'CMO & Gründer', en: 'CMO & Co-founder', ru: 'CMO и сооснователь' },
    bio: {
      de: 'Marketing, Community und Kommunikation. Bringt NeutraleNachrichten zu den Menschen, die es brauchen.',
      en: 'Marketing, community and communications. Brings NeutralNews to the people who need it.',
      ru: 'Маркетинг, сообщество и коммуникации. Доносит платформу до тех, кому она нужна.',
    },
    gradient: 'from-violet-600 via-purple-500 to-pink-400',
    tag: { de: 'Marketing', en: 'Marketing', ru: 'Маркетинг' },
  },
];

const SPECTRUM_OUTLETS = [
  { name: 'junge Welt',     pos: 2,  dot: 'bg-rose-600',   label: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: 'taz',            pos: 10, dot: 'bg-rose-500',   label: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: 'ND',             pos: 16, dot: 'bg-rose-400',   label: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: 'Spiegel',        pos: 30, dot: 'bg-orange-400', label: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'SZ',             pos: 37, dot: 'bg-orange-400', label: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'Die Zeit',       pos: 44, dot: 'bg-orange-400', label: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'Tagesspiegel',   pos: 52, dot: 'bg-slate-500',  label: 'bg-slate-50 text-slate-700 border-slate-200' },
  { name: 'FAZ',            pos: 58, dot: 'bg-slate-500',  label: 'bg-slate-50 text-slate-700 border-slate-200' },
  { name: 'Handelsblatt',   pos: 64, dot: 'bg-sky-400',    label: 'bg-sky-50 text-sky-700 border-sky-200' },
  { name: 'Focus',          pos: 73, dot: 'bg-sky-500',    label: 'bg-sky-50 text-sky-700 border-sky-200' },
  { name: 'Welt',           pos: 80, dot: 'bg-sky-600',    label: 'bg-sky-50 text-sky-700 border-sky-200' },
  { name: 'Bild',           pos: 88, dot: 'bg-blue-600',   label: 'bg-blue-50 text-blue-800 border-blue-200' },
  { name: 'Cicero',         pos: 93, dot: 'bg-blue-700',   label: 'bg-blue-50 text-blue-800 border-blue-200' },
  { name: 'JF',             pos: 98, dot: 'bg-blue-800',   label: 'bg-blue-50 text-blue-800 border-blue-200' },
];

const STEPS: Record<Language, { n: string; title: string; desc: string; color: string }[]> = {
  de: [
    { n: '01', title: 'Thema eingeben', desc: 'Du tippst ein Thema — z.B. „Bürgergeld" oder „Ukraine-Krieg". Unser System übersetzt es intern ins Deutsche, falls nötig.', color: 'border-rose-500 text-rose-600' },
    { n: '02', title: 'Gemini durchsucht', desc: 'Gemini 2.5 Flash durchsucht über Google Search Grounding gleichzeitig alle 5 politischen Lager — von junge Welt bis Junge Freiheit.', color: 'border-orange-400 text-orange-600' },
    { n: '03', title: 'Analyse & Vergleich', desc: 'KI destilliert Narrativ, Fakten, Blind Spots und Sentiment aus echten Artikeln — und zeigt dir, wo Medien übereinstimmen und wo sie divergieren.', color: 'border-blue-600 text-blue-700' },
  ],
  en: [
    { n: '01', title: 'Enter a topic', desc: 'You type a topic — e.g. "Bürgergeld" or "Ukraine war". Our system translates it to German internally if needed.', color: 'border-rose-500 text-rose-600' },
    { n: '02', title: 'Gemini searches', desc: 'Gemini 2.5 Flash searches all 5 political camps simultaneously via Google Search Grounding — from junge Welt to Junge Freiheit.', color: 'border-orange-400 text-orange-600' },
    { n: '03', title: 'Analysis & comparison', desc: 'AI distills narrative, facts, blind spots and sentiment from real articles — showing you where media agree and where they diverge.', color: 'border-blue-600 text-blue-700' },
  ],
  ru: [
    { n: '01', title: 'Введите тему', desc: 'Вы вводите тему — например, «Bürgergeld» или «война в Украине». Система при необходимости переводит её на немецкий автоматически.', color: 'border-rose-500 text-rose-600' },
    { n: '02', title: 'Gemini ищет', desc: 'Gemini 2.5 Flash одновременно обходит все 5 политических лагерей через Google Search Grounding — от junge Welt до Junge Freiheit.', color: 'border-orange-400 text-orange-600' },
    { n: '03', title: 'Анализ и сравнение', desc: 'ИИ извлекает нарратив, факты, слепые пятна и тональность из реальных статей — показывая, где СМИ согласны, а где расходятся.', color: 'border-blue-600 text-blue-700' },
  ],
};

const STATS: Record<Language, { value: string; raw: number; label: string; prefix?: string; suffix?: string }[]> = {
  de: [
    { value: '5',    raw: 5,   label: 'Politische Spektren',  suffix: '' },
    { value: '3',    raw: 3,   label: 'Sprachen',             suffix: '' },
    { value: '40+',  raw: 40,  label: 'Medienquellen',        suffix: '+' },
    { value: '< 1',  raw: 1,   label: 'Minute bis Ergebnis', suffix: ' min' },
  ],
  en: [
    { value: '5',    raw: 5,   label: 'Political spectrums',  suffix: '' },
    { value: '3',    raw: 3,   label: 'Languages',            suffix: '' },
    { value: '40+',  raw: 40,  label: 'Media sources',        suffix: '+' },
    { value: '< 1',  raw: 1,   label: 'Minute to results',   suffix: ' min' },
  ],
  ru: [
    { value: '5',    raw: 5,   label: 'Политических спектров', suffix: '' },
    { value: '3',    raw: 3,   label: 'Языка',                 suffix: '' },
    { value: '40+',  raw: 40,  label: 'Медиаисточников',       suffix: '+' },
    { value: '< 1',  raw: 1,   label: 'Минуты до результата',  suffix: ' мин' },
  ],
};

const TECH = [
  { name: 'Gemini 2.5 Flash', color: 'border-blue-400 text-blue-700 bg-blue-50' },
  { name: 'Google Search Grounding', color: 'border-sky-400 text-sky-700 bg-sky-50' },
  { name: 'React 19', color: 'border-cyan-400 text-cyan-700 bg-cyan-50' },
  { name: 'TypeScript', color: 'border-indigo-400 text-indigo-700 bg-indigo-50' },
  { name: 'Node.js', color: 'border-emerald-400 text-emerald-700 bg-emerald-50' },
  { name: 'Express', color: 'border-gray-400 text-gray-700 bg-gray-50' },
  { name: 'PostgreSQL', color: 'border-slate-400 text-slate-700 bg-slate-50' },
  { name: 'Tailwind CSS 4', color: 'border-teal-400 text-teal-700 bg-teal-50' },
  { name: 'Vite', color: 'border-violet-400 text-violet-700 bg-violet-50' },
  { name: 'Railway', color: 'border-rose-400 text-rose-700 bg-rose-50' },
  { name: 'Sentry', color: 'border-orange-400 text-orange-700 bg-orange-50' },
  { name: 'PostHog', color: 'border-amber-400 text-amber-700 bg-amber-50' },
];

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(ease * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{ stat: typeof STATS['de'][0]; index: number; inView: boolean }> = ({ stat, index, inView }) => {
  const count = useCountUp(stat.raw, 900 + index * 150, inView);
  const ACCENT = ['from-rose-600 to-orange-400', 'from-orange-400 to-amber-400', 'from-sky-500 to-blue-600', 'from-emerald-500 to-teal-500'];
  return (
    <div className={`border-2 border-[#1a1a1a] p-5 flex flex-col justify-between transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${index * 80}ms` }}>
      <div className={`h-0.5 w-full bg-gradient-to-r ${ACCENT[index % ACCENT.length]} mb-4`} />
      <div>
        <p className="font-serif font-black text-4xl text-[#1a1a1a] leading-none tabular-nums">
          {stat.raw <= 5 ? stat.value : `${count}${stat.suffix || ''}`}
        </p>
        <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 mt-2">{stat.label}</p>
      </div>
    </div>
  );
};

const SpectrumMap: React.FC<{ lang: Language }> = ({ lang }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const labels: Record<Language, [string, string, string]> = {
    de: ['Links', 'Mitte', 'Rechts'],
    en: ['Left', 'Center', 'Right'],
    ru: ['Лево', 'Центр', 'Право'],
  };
  const [l, c, r] = labels[lang];
  return (
    <div className="relative px-4 py-6 select-none">
      {/* Gradient bar */}
      <div className="h-2 w-full rounded-none overflow-hidden" style={{
        background: 'linear-gradient(to right, #e11d48 0%, #fb923c 25%, #94a3b8 50%, #0ea5e9 75%, #1d4ed8 100%)'
      }} />
      {/* Labels */}
      <div className="flex justify-between font-sans text-[9px] uppercase tracking-widest text-gray-400 mt-1">
        <span>{l}</span><span>{c}</span><span>{r}</span>
      </div>
      {/* Outlet dots */}
      <div className="relative mt-6 h-16">
        {SPECTRUM_OUTLETS.map((outlet) => (
          <div
            key={outlet.name}
            className="absolute flex flex-col items-center gap-1 cursor-default"
            style={{ left: `${outlet.pos}%`, transform: 'translateX(-50%)' }}
            onMouseEnter={() => setHovered(outlet.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className={`font-sans text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border transition-all duration-150 whitespace-nowrap ${
              hovered === outlet.name ? outlet.label + ' scale-110' : 'bg-transparent text-transparent border-transparent'
            }`}>
              {outlet.name}
            </span>
            <div className={`w-2.5 h-2.5 rounded-full ${outlet.dot} transition-transform duration-150 ${hovered === outlet.name ? 'scale-125' : ''}`} />
          </div>
        ))}
      </div>
      <p className="font-sans text-[9px] text-gray-300 uppercase tracking-widest text-center mt-2">
        {lang === 'de' ? 'Hover über die Punkte' : lang === 'ru' ? 'Наведите на точки' : 'Hover over the dots'}
      </p>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const AboutPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const a = t.about;

  const { ref: statsRef, inView: statsInView } = useInView(0.1);
  const { ref: stepsRef, inView: stepsInView } = useInView(0.1);
  const { ref: teamRef,  inView: teamInView  } = useInView(0.05);

  const L = {
    de: {
      whatWeOffer: 'Was wir bieten',
      howTitle: 'So funktioniert es',
      spectrumTitle: 'Deutsche Medien im Spektrum',
      spectrumSub: 'Wir analysieren alle fünf Lager gleichzeitig — in Echtzeit',
      techLabel: 'Tech Stack',
      independentBadge: '100% Unabhängig',
      contactBtn: 'E-Mail schreiben',
      suggestBtn: 'Quelle vorschlagen →',
    },
    en: {
      whatWeOffer: 'What we offer',
      howTitle: 'How it works',
      spectrumTitle: 'German media on the spectrum',
      spectrumSub: 'We analyse all five camps simultaneously — in real time',
      techLabel: 'Tech Stack',
      independentBadge: '100% Independent',
      contactBtn: 'Send email',
      suggestBtn: 'Suggest a source →',
    },
    ru: {
      whatWeOffer: 'Что мы предлагаем',
      howTitle: 'Как это работает',
      spectrumTitle: 'Немецкие СМИ на спектре',
      spectrumSub: 'Мы анализируем все пять лагерей одновременно — в реальном времени',
      techLabel: 'Технологии',
      independentBadge: '100% Независимо',
      contactBtn: 'Написать письмо',
      suggestBtn: 'Предложить источник →',
    },
  }[lang];

  const features: { accent: string; icon: string; title: string; desc: string }[] = {
    de: [
      { accent: 'from-rose-500 to-rose-600',    icon: '◈', title: '5 Spektren',             desc: 'Von junge Welt bis Junge Freiheit — das gesamte politische Spektrum Deutschlands auf einem Blick.' },
      { accent: 'from-sky-400 to-blue-600',     icon: '⟳', title: 'Echtzeit',               desc: 'Gemini 2.5 Flash + Google Search Grounding — aktuelle Artikel, keine veralteten Daten.' },
      { accent: 'from-violet-500 to-purple-600',icon: '⊕', title: 'Tiefenanalyse',           desc: 'Gemeinsame Fakten, Divergenzpunkte, Blinde Flecken, Sentiment, Keywords, Experten-Karte.' },
      { accent: 'from-emerald-400 to-teal-600', icon: '≡', title: 'Volumen-Tracking',         desc: 'Geschätzte Artikelanzahl pro politischem Lager pro Woche und Monat.' },
      { accent: 'from-amber-400 to-orange-500', icon: '◉', title: '3 Sprachen',              desc: 'Deutsch, Englisch und Russisch — vollständig übersetzt inkl. Tiefenanalyse.' },
      { accent: 'from-pink-500 to-rose-600',    icon: '↑', title: 'Trending',                desc: 'Wöchentliche Echtzeit-Trends aus Deutschland + Plattform-Suchstatistiken.' },
    ],
    en: [
      { accent: 'from-rose-500 to-rose-600',    icon: '◈', title: '5 spectrums',             desc: 'From junge Welt to Junge Freiheit — the full German political spectrum at a glance.' },
      { accent: 'from-sky-400 to-blue-600',     icon: '⟳', title: 'Real-time',               desc: 'Gemini 2.5 Flash + Google Search Grounding — current articles, no stale data.' },
      { accent: 'from-violet-500 to-purple-600',icon: '⊕', title: 'Deep Analysis',           desc: 'Shared facts, diverging points, blind spots, sentiment, keywords, expert map.' },
      { accent: 'from-emerald-400 to-teal-600', icon: '≡', title: 'Volume tracking',          desc: 'Estimated article count per camp per week and month.' },
      { accent: 'from-amber-400 to-orange-500', icon: '◉', title: '3 languages',             desc: 'German, English and Russian — fully translated including deep analysis.' },
      { accent: 'from-pink-500 to-rose-600',    icon: '↑', title: 'Trending',                desc: 'Weekly real-time trends from Germany + platform search stats.' },
    ],
    ru: [
      { accent: 'from-rose-500 to-rose-600',    icon: '◈', title: '5 спектров',              desc: 'От junge Welt до Junge Freiheit — весь политический спектр Германии с первого взгляда.' },
      { accent: 'from-sky-400 to-blue-600',     icon: '⟳', title: 'Реальное время',          desc: 'Gemini 2.5 Flash + Google Search Grounding — актуальные статьи, никаких устаревших данных.' },
      { accent: 'from-violet-500 to-purple-600',icon: '⊕', title: 'Глубокий анализ',         desc: 'Общие факты, точки расхождения, слепые пятна, тональность, ключевые слова, карта экспертов.' },
      { accent: 'from-emerald-400 to-teal-600', icon: '≡', title: 'Отслеживание объёма',      desc: 'Примерное количество статей по политическому лагерю за неделю и месяц.' },
      { accent: 'from-amber-400 to-orange-500', icon: '◉', title: '3 языка',                 desc: 'Немецкий, английский и русский — полный перевод включая глубокий анализ.' },
      { accent: 'from-pink-500 to-rose-600',    icon: '↑', title: 'Тренды',                  desc: 'Еженедельные тренды из Германии в реальном времени + статистика поиска на платформе.' },
    ],
  }[lang];

  return (
    <div className="max-w-4xl mx-auto pb-16">

      {/* ── Back ──────────────────────────────────────────────── */}
      <Link to="/" className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors flex items-center gap-1.5 mb-8">
        ← {t.backToHome}
      </Link>

      {/* ════════════════════════════════════════════════════════
          HERO — full-bleed masthead
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] overflow-hidden mb-8">
        {/* Spectrum bar */}
        <div className="h-2 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="px-6 sm:px-10 py-10 bg-[#1a1a1a] relative overflow-hidden">
          {/* Decorative large text behind */}
          <div className="absolute top-0 right-0 font-serif font-black text-[120px] leading-none text-white/[0.03] select-none pointer-events-none pr-4 pt-0">
            NN
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/40 mb-4">{a.title}</p>
          <h1 className="font-serif font-black text-2xl sm:text-4xl text-white leading-[1.1] mb-5 max-w-2xl relative z-10">
            {a.missionHero}
          </h1>
          <div className="h-px bg-white/10 mb-5" />
          <p className="font-serif text-sm sm:text-base text-white/60 leading-relaxed max-w-xl relative z-10">
            {a.missionSub}
          </p>
        </div>
        {/* Why strip */}
        <div className="px-6 sm:px-10 py-6 border-t-2 border-[#1a1a1a]">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-2">{a.whyTitle}</p>
          <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{a.whyBody}</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          STATS — animated counters
      ════════════════════════════════════════════════════════ */}
      <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {STATS[lang].map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} inView={statsInView} />
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          HOW IT WORKS — 3-step flow
      ════════════════════════════════════════════════════════ */}
      <div ref={stepsRef} className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3 flex items-center justify-between">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.howTitle}</p>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a]">
          {STEPS[lang].map((step, i) => (
            <div
              key={step.n}
              className={`p-6 flex flex-col gap-3 transition-all duration-700 ${stepsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className={`w-10 h-10 border-2 ${step.color} flex items-center justify-center shrink-0`}>
                <span className={`font-serif font-black text-sm ${step.color.split(' ')[1]}`}>{step.n}</span>
              </div>
              <div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] mb-1.5">{step.title}</p>
                <p className="font-serif text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SPECTRUM MAP — media positioning
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.spectrumTitle}</p>
          <p className="font-sans text-[9px] text-white/40 mt-0.5">{L.spectrumSub}</p>
        </div>
        <div className="px-4 sm:px-8">
          <SpectrumMap lang={lang} />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          FEATURES — 6 cards
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] shrink-0">{L.whatWeOffer}</p>
          <div className="flex-1 h-px bg-[#1a1a1a] opacity-15" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group border-2 border-[#1a1a1a] p-5 hover:bg-[#1a1a1a] transition-colors duration-200 cursor-default flex flex-col gap-3"
            >
              {/* Icon with gradient dot */}
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 bg-gradient-to-br ${f.accent} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-sm font-bold">{f.icon}</span>
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
          TEAM — gradient avatar cards
      ════════════════════════════════════════════════════════ */}
      <div ref={teamRef} className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{a.teamTitle}</p>
        </div>
        <div className="grid sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a]">
          {TEAM.map((member, i) => (
            <div
              key={member.name}
              className={`flex flex-col transition-all duration-700 ${teamInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* Gradient avatar strip */}
              <div className={`h-1.5 bg-gradient-to-r ${member.gradient}`} />
              <div className="p-5 flex flex-col gap-3 flex-1">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center shrink-0 shadow`}>
                    <span className="font-serif font-black text-base text-white">{member.initials}</span>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] leading-tight">{member.name}</p>
                    <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">{member.role[lang]}</p>
                  </div>
                </div>
                {/* Bio */}
                <p className="font-serif text-xs text-gray-500 leading-relaxed flex-1">{member.bio[lang]}</p>
                {/* Tag */}
                <span className={`self-start font-sans text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-gradient-to-r ${member.gradient} text-white`}>
                  {member.tag[lang]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          TECH STACK — coloured tags
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.techLabel}</p>
        </div>
        <div className="px-5 py-5 flex flex-wrap gap-2">
          {TECH.map(tech => (
            <span
              key={tech.name}
              className={`font-sans text-[10px] font-bold uppercase tracking-wider border px-3 py-1 transition-all duration-150 hover:scale-105 cursor-default ${tech.color}`}
            >
              {tech.name}
            </span>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          INDEPENDENCE — prominent badge
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 overflow-hidden border-2 border-emerald-500">
        <div className="bg-emerald-500 px-6 py-3 flex items-center gap-3">
          <span className="text-white font-bold text-lg">✓</span>
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.independentBadge}</p>
        </div>
        <div className="px-6 py-5 bg-emerald-50">
          <p className="font-sans text-[9px] uppercase tracking-widest text-emerald-700 font-bold mb-2">{a.independenceTitle}</p>
          <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{a.independenceBody}</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CONTACT — split CTA
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{a.contactTitle}</p>
        </div>
        <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-serif text-sm text-gray-500 mb-1">{a.contactBody}</p>
            <a
              href={`mailto:${a.contactEmail}`}
              className="font-serif font-bold text-base text-[#1a1a1a] hover:text-rose-600 transition-colors"
            >
              {a.contactEmail}
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <a
              href={`mailto:${a.contactEmail}`}
              className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] text-white px-4 py-2.5 hover:bg-rose-600 transition-colors text-center"
            >
              ↗ {L.contactBtn}
            </a>
            <Link
              to="/suggest"
              className="font-sans text-[10px] uppercase tracking-widest border-2 border-[#1a1a1a] text-[#1a1a1a] px-4 py-2.5 hover:bg-[#1a1a1a] hover:text-white transition-colors text-center"
            >
              {L.suggestBtn}
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};
