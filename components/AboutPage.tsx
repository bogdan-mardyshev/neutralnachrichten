import React from 'react';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

const TEAM = [
  {
    name: 'Bogdan Mardyshev',
    role: { de: 'CTO & Gründer', en: 'CTO & Co-founder', ru: 'CTO и сооснователь' },
    bio: {
      de: 'CTO und leitender Entwickler. Verantwortet Architektur, KI-Integration und Infrastruktur.',
      en: 'CTO and lead developer. Responsible for architecture, AI integration and infrastructure.',
      ru: 'CTO и главный разработчик. Отвечает за архитектуру, интеграцию ИИ и инфраструктуру.',
    },
  },
  {
    name: 'Romeo Giorgio Spadaro',
    role: { de: 'CEO & Gründer', en: 'CEO & Co-founder', ru: 'CEO и сооснователь' },
    bio: {
      de: 'Verantwortet Strategie, Partnerschaften und Wachstum.',
      en: 'Responsible for strategy, partnerships and growth.',
      ru: 'Отвечает за стратегию, партнёрства и рост.',
    },
  },
  {
    name: 'Frederic Hallier',
    role: { de: 'CMO & Gründer', en: 'CMO & Co-founder', ru: 'CMO и сооснователь' },
    bio: {
      de: 'Verantwortet Marketing, Community und Kommunikation.',
      en: 'Responsible for marketing, community and communications.',
      ru: 'Отвечает за маркетинг, сообщество и коммуникации.',
    },
  },
];

const FEATURES: Record<Language, { accent: string; title: string; desc: string }[]> = {
  de: [
    { accent: 'bg-rose-500',    title: '5 politische Spektren',       desc: 'Von junge Welt bis Junge Freiheit — die gesamte deutsche Medienlandschaft auf einen Blick' },
    { accent: 'bg-sky-500',     title: 'Echtzeit via Google Search',   desc: 'Gemini 2.5 Flash durchsucht aktuelle Artikel direkt bei der Eingabe — keine veralteten Daten' },
    { accent: 'bg-violet-500',  title: 'Tiefenanalyse',                desc: 'Gemeinsame Fakten, Divergenzpunkte, Blinde Flecken, Sentiment, Keywords, Experten-Karte' },
    { accent: 'bg-emerald-500', title: 'Berichterstattungsvolumen',    desc: 'Geschätzte Artikelzahl pro Lager pro Woche und Monat' },
    { accent: 'bg-amber-500',   title: '2 Sprachen',                   desc: 'Deutsch und Englisch — vollständig übersetzt inkl. Tiefenanalyse' },
    { accent: 'bg-orange-500',  title: 'Trending & Top-Themen',        desc: 'Wöchentliche Echtzeit-Trends aus Deutschland + Plattform-Suchstatistiken' },
  ],
  en: [
    { accent: 'bg-rose-500',    title: '5 political spectrums',        desc: 'From junge Welt to Junge Freiheit — the full German media landscape at a glance' },
    { accent: 'bg-sky-500',     title: 'Real-time via Google Search',  desc: 'Gemini 2.5 Flash searches current articles the moment you type — no stale data' },
    { accent: 'bg-violet-500',  title: 'Deep Analysis',                desc: 'Shared facts, diverging points, blind spots, sentiment, keywords, expert map' },
    { accent: 'bg-emerald-500', title: 'Coverage Volume',              desc: 'Estimated article count per camp per week and month' },
    { accent: 'bg-amber-500',   title: '2 languages',                  desc: 'German and English — fully translated including deep analysis' },
    { accent: 'bg-orange-500',  title: 'Trending & Top Topics',        desc: 'Weekly real-time trends from Germany + platform search stats' },
  ],
  ru: [
    { accent: 'bg-rose-500',    title: '5 политических спектров',      desc: 'От junge Welt до Junge Freiheit — весь немецкий медиаландшафт с первого взгляда' },
    { accent: 'bg-sky-500',     title: 'В реальном времени',           desc: 'Gemini 2.5 Flash ищет актуальные статьи прямо в момент запроса — никаких устаревших данных' },
    { accent: 'bg-violet-500',  title: 'Глубокий анализ',              desc: 'Общие факты, точки расхождения, слепые пятна, тональность, ключевые слова, карта экспертов' },
    { accent: 'bg-emerald-500', title: 'Объём освещения',              desc: 'Примерное количество статей по лагерям за неделю и месяц' },
    { accent: 'bg-amber-500',   title: '2 языка',                      desc: 'Немецкий и английский — полный перевод включая глубокий анализ' },
    { accent: 'bg-orange-500',  title: 'Тренды и топ-темы',            desc: 'Еженедельные тренды из Германии в реальном времени + статистика поиска на платформе' },
  ],
};

const TECH = ['Gemini 2.5 Flash', 'Google Search Grounding', 'React 19', 'TypeScript', 'Node.js', 'Express', 'Tailwind CSS 4', 'Vite'];

export const AboutPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const a = t.about;

  const whatWeOffer = { de: 'Was wir bieten', en: 'What we offer', ru: 'Что мы предлагаем' }[lang];
  const techLabel   = { de: 'Tech Stack',     en: 'Tech Stack',    ru: 'Технологии'      }[lang];

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">

      {/* Back link */}
      <Link
        to="/"
        className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors mb-8 flex items-center gap-1.5"
      >
        ← {t.backToHome}
      </Link>

      {/* ── Hero ── */}
      <div className="border-b-2 border-[#1a1a1a] pb-8 mb-8">
        {/* 5-colour rule */}
        <div className="h-[3px] flex mb-6">
          <div className="flex-1 bg-rose-600" />
          <div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" />
          <div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gray-400 mb-3">{a.title}</p>
        <h1 className="font-serif font-black text-3xl text-[#1a1a1a] leading-tight mb-4">
          {a.missionHero}
        </h1>
        <p className="font-serif text-base text-gray-600 leading-relaxed">
          {a.missionSub}
        </p>
      </div>

      {/* ── Why ── */}
      <section className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-5 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{a.whyTitle}</p>
        </div>
        <div className="px-5 py-5">
          <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{a.whyBody}</p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mb-8">
        <div className="border-b-2 border-[#1a1a1a] pb-2 mb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]">{whatWeOffer}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES[lang].map((f, i) => (
            <div key={i} className="border border-[#e0d8cf] p-4 flex items-start gap-3 hover:bg-[#f0e8dc] transition-colors">
              <div className={`w-0.5 h-full min-h-[2.5rem] ${f.accent} shrink-0`} />
              <div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">{f.title}</p>
                <p className="font-serif text-xs text-gray-500 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team ── */}
      <section className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-5 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{a.teamTitle}</p>
        </div>
        <div className="divide-y divide-[#e0d8cf]">
          {TEAM.map((member) => (
            <div key={member.name} className="px-5 py-4 flex items-start gap-4">
              {/* Initial badge */}
              <div className="w-9 h-9 bg-[#1a1a1a] text-white flex items-center justify-center font-serif font-bold text-base shrink-0">
                {member.name.charAt(0)}
              </div>
              <div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">{member.name}</p>
                <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">{member.role[lang]}</p>
                <p className="font-serif text-xs text-gray-500 mt-1.5 leading-relaxed">{member.bio[lang]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-5 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{techLabel}</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {TECH.map(tech => (
            <span
              key={tech}
              className="font-sans text-[10px] uppercase tracking-wider border border-[#1a1a1a] px-2.5 py-1 text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white transition-colors"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* ── Independence ── */}
      <section className="mb-8 border-l-4 border-emerald-500 pl-5 py-1">
        <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">{a.independenceTitle}</p>
        <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{a.independenceBody}</p>
      </section>

      {/* ── Contact ── */}
      <section className="border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-5 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{a.contactTitle}</p>
        </div>
        <div className="px-5 py-5">
          <p className="font-serif text-sm text-gray-500 mb-3">{a.contactBody}</p>
          <a
            href={`mailto:${a.contactEmail}`}
            className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] border-b border-[#1a1a1a] hover:text-rose-600 hover:border-rose-600 transition-colors"
          >
            {a.contactEmail}
          </a>
          <div className="mt-4 pt-4 border-t border-[#e0d8cf]">
            <Link
              to="/suggest"
              className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors"
            >
              {a.suggestLink}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};
