import React from 'react';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

const TEAM = [
  {
    name: 'Bogdan Mardyshev',
    role: { de: 'CTO & Gründer', en: 'CTO & Co-founder', ru: 'CTO и сооснователь' },
    bio: {
      de: 'Informatikstudent an der SRH Berlin. CTO und leitender Entwickler.',
      en: 'Computer Science student at SRH Berlin. CTO and lead developer.',
      ru: 'Студент факультета информатики SRH Berlin. CTO и главный разработчик.',
    },
  },
  {
    name: 'Romeo Giorgio Spadaro',
    role: { de: 'CEO & Gründer', en: 'CEO & Co-founder', ru: 'CEO и сооснователь' },
    bio: {
      de: 'BWL-Student an der SRH Berlin. Verantwortet Strategie, Partnerschaften und Wachstum.',
      en: 'Business student at SRH Berlin. Responsible for strategy, partnerships and growth.',
      ru: 'Студент бизнес-факультета SRH Berlin. Отвечает за стратегию, партнёрства и рост.',
    },
  },
  {
    name: 'Frederic Hallier',
    role: { de: 'CMO & Gründer', en: 'CMO & Co-founder', ru: 'CMO и сооснователь' },
    bio: {
      de: 'BWL-Student an der SRH Berlin. Verantwortet Marketing, Community und Kommunikation.',
      en: 'Business student at SRH Berlin. Responsible for marketing, community and communications.',
      ru: 'Студент бизнес-факультета SRH Berlin. Отвечает за маркетинг, сообщество и коммуникации.',
    },
  },
];

const FEATURES: Record<Language, { icon: string; title: string; desc: string }[]> = {
  de: [
    { icon: '🗞️', title: '5 politische Spektren', desc: 'Von junge Welt bis Junge Freiheit — die gesamte deutsche Medienlandschaft auf einen Blick' },
    { icon: '🔍', title: 'Echtzeit via Google Search', desc: 'Gemini 2.5 Flash durchsucht aktuelle Artikel direkt bei der Eingabe — keine veralteten Daten' },
    { icon: '🧠', title: 'Tiefenanalyse', desc: 'Gemeinsame Fakten, Divergenzpunkte, Blinde Flecken, Sentiment, Keywords, Experten-Karte' },
    { icon: '📊', title: 'Berichterstattungsvolumen', desc: 'Geschätzte Artikelzahl pro Lager pro Woche und Monat' },
    { icon: '🌍', title: '3 Sprachen', desc: 'Deutsch, Englisch, Russisch — vollständig übersetzt inkl. Tiefenanalyse' },
    { icon: '🔥', title: 'Trending & Top-Themen', desc: 'Wöchentliche Echtzeit-Trends aus Deutschland + Plattform-Suchstatistiken' },
  ],
  en: [
    { icon: '🗞️', title: '5 political spectrums', desc: 'From junge Welt to Junge Freiheit — the full German media landscape at a glance' },
    { icon: '🔍', title: 'Real-time via Google Search', desc: 'Gemini 2.5 Flash searches current articles the moment you type — no stale data' },
    { icon: '🧠', title: 'Deep Analysis', desc: 'Shared facts, diverging points, blind spots, sentiment, keywords, expert map' },
    { icon: '📊', title: 'Coverage Volume', desc: 'Estimated article count per camp per week and month' },
    { icon: '🌍', title: '3 languages', desc: 'German, English, Russian — fully translated including deep analysis' },
    { icon: '🔥', title: 'Trending & Top Topics', desc: 'Weekly real-time trends from Germany + platform search stats' },
  ],
  ru: [
    { icon: '🗞️', title: '5 политических спектров', desc: 'От junge Welt до Junge Freiheit — весь немецкий медиаландшафт с первого взгляда' },
    { icon: '🔍', title: 'В реальном времени через Google', desc: 'Gemini 2.5 Flash ищет актуальные статьи прямо в момент запроса — никаких устаревших данных' },
    { icon: '🧠', title: 'Глубокий анализ', desc: 'Общие факты, точки расхождения, слепые пятна, тональность, ключевые слова, карта экспертов' },
    { icon: '📊', title: 'Объём освещения', desc: 'Примерное количество статей по лагерям за неделю и месяц' },
    { icon: '🌍', title: '3 языка', desc: 'Немецкий, английский, русский — полный перевод включая глубокий анализ' },
    { icon: '🔥', title: 'Тренды и топ-темы', desc: 'Еженедельные тренды из Германии в реальном времени + статистика поиска на платформе' },
  ],
};

export const AboutPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const a = t.about;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <Link to="/" className="text-slate-500 hover:text-slate-800 mb-8 flex items-center gap-2 text-sm">
        ← {t.backToHome}
      </Link>

      {/* Hero */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{a.title}</h1>
        <p className="text-2xl font-semibold text-slate-700 leading-snug mb-4">{a.missionHero}</p>
        <p className="text-lg text-gray-600 leading-relaxed">{a.missionSub}</p>
      </div>

      {/* Why */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{a.whyTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{a.whyBody}</p>
      </section>

      {/* Feature grid */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-5">
          {{ de: 'Was wir bieten', en: 'What we offer', ru: 'Что мы предлагаем' }[lang]}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES[lang].map((f, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-start gap-3">
              <span className="text-2xl leading-none shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <p className="font-bold text-sm text-slate-900">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-6">{a.teamTitle}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {TEAM.map((member) => (
            <div key={member.name} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-900 mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold">
                {member.name.charAt(0)}
              </div>
              <p className="font-bold text-slate-900 text-sm">{member.name}</p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">
                {member.role[lang]}
              </p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{member.bio[lang]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="mb-10 bg-slate-900 text-white rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">
          {{ de: 'Tech Stack', en: 'Tech Stack', ru: 'Технологии' }[lang]}
        </h2>
        <div className="flex flex-wrap gap-2">
          {['Gemini 2.5 Flash', 'Google Search Grounding', 'React 19', 'TypeScript', 'Node.js', 'Express', 'Tailwind CSS 4', 'Vite'].map(tech => (
            <span key={tech} className="bg-white/10 text-white text-xs font-medium px-3 py-1 rounded-full border border-white/20">
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Independence */}
      <section className="mb-10 bg-slate-50 rounded-xl p-6 border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{a.independenceTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{a.independenceBody}</p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">{a.contactTitle}</h2>
        <p className="text-gray-600 mb-2">{a.contactBody}</p>
        <a href={`mailto:${a.contactEmail}`} className="text-slate-800 font-semibold hover:underline">
          {a.contactEmail}
        </a>
        <div className="mt-4">
          <Link to="/suggest" className="text-slate-600 hover:text-slate-900 font-medium">
            {a.suggestLink}
          </Link>
        </div>
      </section>
    </div>
  );
};
