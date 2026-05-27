import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

// ── Team ─────────────────────────────────────────────────────────────────────

const TEAM = [
  {
    name: 'Bogdan Mardyshev',
    initials: 'BM',
    role: { de: 'CTO & Gründer', en: 'CTO & Co-founder', ru: 'CTO и сооснователь' },
    bio: {
      de: 'Architekt der Plattform. Verantwortlich für KI-Integration, Infrastruktur und das Gesamtsystem hinter NeutraleNachrichten.',
      en: 'Platform architect. Responsible for AI integration, infrastructure and the complete system behind NeutralNews.',
      ru: 'Архитектор платформы. Отвечает за интеграцию ИИ, инфраструктуру и всю систему за NeutraleNachrichten.',
    },
    gradient: 'from-rose-500 via-orange-400 to-amber-300',
    focus: { de: 'Technik', en: 'Engineering', ru: 'Разработка' },
  },
  {
    name: 'Romeo Giorgio Spadaro',
    initials: 'RS',
    role: { de: 'CEO & Gründer', en: 'CEO & Co-founder', ru: 'CEO и сооснователь' },
    bio: {
      de: 'Verantwortlich für Strategie, Partnerschaften und Wachstum. Sorgt dafür, dass die Vision in die Realität findet.',
      en: 'Responsible for strategy, partnerships and growth. Ensures the vision becomes reality.',
      ru: 'Отвечает за стратегию, партнёрства и рост. Следит за тем, чтобы видение воплощалось в жизнь.',
    },
    gradient: 'from-blue-600 via-sky-400 to-cyan-300',
    focus: { de: 'Strategie', en: 'Strategy', ru: 'Стратегия' },
  },
  {
    name: 'Frederic Hallier',
    initials: 'FH',
    role: { de: 'CMO & Gründer', en: 'CMO & Co-founder', ru: 'CMO и сооснователь' },
    bio: {
      de: 'Verantwortlich für Marketing, Community und Kommunikation. Bringt NeutraleNachrichten zu den Menschen, die es brauchen.',
      en: 'Responsible for marketing, community and communication. Gets NeutralNews to the people who need it.',
      ru: 'Отвечает за маркетинг, сообщество и коммуникации. Доносит платформу до тех, кому она нужна.',
    },
    gradient: 'from-violet-500 via-purple-400 to-pink-300',
    focus: { de: 'Marketing', en: 'Marketing', ru: 'Маркетинг' },
  },
];

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.12) {
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

// ── Expandable Principle Card ─────────────────────────────────────────────────

const PrincipleCard: React.FC<{
  n: string; title: string; body: string;
  accent: string; visible: boolean; delay: number;
}> = ({ n, title, body, accent, visible, delay }) => {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className={`w-full text-left border-2 border-[#1a1a1a] dark:border-gray-700 transition-all duration-500 group focus:outline-none ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${open ? 'bg-[#1a1a1a] dark:bg-gray-800' : 'hover:bg-[#f5f0e8] dark:hover:bg-[#1e1a14]'}`}
      style={{ transitionDelay: `${delay}ms`, transitionProperty: 'opacity, transform, background-color' }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <span className={`font-serif font-black text-xl leading-none ${open ? 'text-white/40' : accent} transition-colors shrink-0`}>{n}</span>
        <div className={`flex-1 h-px ${open ? 'bg-white/15' : 'bg-[#1a1a1a]/15 dark:bg-gray-600'} transition-colors`} />
        <p className={`font-sans text-[10px] font-bold uppercase tracking-wider ${open ? 'text-white' : 'text-[#1a1a1a] dark:text-[#f0ece4]'} transition-colors leading-tight text-right max-w-[70%]`}>{title}</p>
        <span className={`font-sans text-sm shrink-0 transition-all duration-200 ${open ? 'text-white rotate-45' : 'text-[#1a1a1a]/40 dark:text-gray-500 rotate-0'}`}>+</span>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-48' : 'max-h-0'}`}>
        <p className="px-5 pb-5 font-serif text-xs text-white/65 leading-relaxed">{body}</p>
      </div>
    </button>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const AboutPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const a = t.about;

  const { ref: storyRef,      inView: storyInView      } = useInView(0.08);
  const { ref: archRef,       inView: archInView        } = useInView(0.05);
  const { ref: numbersRef,    inView: numbersInView     } = useInView(0.05);
  const { ref: principlesRef, inView: principlesInView  } = useInView(0.05);
  const { ref: visionRef,     inView: visionInView      } = useInView(0.08);
  const { ref: teamRef,       inView: teamInView        } = useInView(0.05);

  const L = {
    de: {
      heroLabel: 'Über uns',
      heroQuote: 'Verstehen beginnt damit, alle Seiten zu hören.',
      heroSub: 'NeutraleNachrichten ist ein Werkzeug, das das gesamte politische Spektrum der deutschen Presse auf einen Blick zugänglich macht — für alle, nicht nur für Experten.',
      stat1: 'Deutsche Medien',
      stat2: 'Politische Lager',
      stat3: 'RSS-Feeds live',
      stat4: 'Sprachen',

      storyLabel: 'Was wir gebaut haben',
      storyLeft: 'Wir crawlen 18 deutsche Medien aus fünf politischen Lagern in Echtzeit — von taz und junge Welt auf der Linken bis zu Junge Freiheit und Tichys Einblick auf der Rechten. RSS-Algorithmus v2 analysiert Aktualität mit Recency-Gewichtung: Breaking News bekommt 3× höhere Gewichtung als Wochenartikel.',
      storyRight: 'Gemini 2.5 Flash analysiert die RSS-Artikel direkt als Kontext — ohne Google Search. Das spart 78× Kosten ($0,0004 statt $0,035/Anfrage) und liefert Ergebnisse in 3–10s statt 15–45s. Wir zeigen dir nicht nur, was geschrieben wird — sondern auch den Originaltext, damit du die KI-Interpretation selbst überprüfen kannst.',

      archLabel: 'Architektur',
      archTitle: 'Wie Daten fließen',
      archSub: 'Von RSS-Feed bis Analyse — in unter 15 Sekunden.',

      archNodes: [
        { id: 'rss',    label: 'RSS Feeds 18×',     sub: '3–8s',         accent: 'border-rose-500',    subColor: 'text-rose-500'    },
        { id: 'v2',     label: 'v2 Algorithmus',    sub: 'Compound Split + Recency', accent: 'border-orange-400', subColor: 'text-orange-400' },
        { id: 'gemini', label: 'Gemini 2.5 Flash',  sub: '3–10s',        accent: 'border-emerald-500', subColor: 'text-emerald-500' },
        { id: 'out',    label: 'Analyse',           sub: '5 Spektren',   accent: 'border-sky-500',     subColor: 'text-sky-500'     },
      ],

      numbersLabel: 'Zahlen & Fakten',
      numbers: [
        { value: '197', label: lang === 'de' ? 'Tests (alle grün)' : 'Tests (alle grün)', accent: 'text-emerald-600' },
        { value: '78×',  label: 'Günstiger als Grounding', accent: 'text-rose-600' },
        { value: '18×',  label: 'Mehr Artikel (v2 vs. v1)', accent: 'text-orange-500' },
        { value: '0',    label: 'Google-Abhängigkeiten', accent: 'text-slate-500' },
      ],

      principlesLabel: 'Was uns antreibt',
      principles: [
        { n: '01', title: 'Jede Geschichte hat mehr als eine Perspektive', body: 'Wir zeigen dasselbe Thema gleichzeitig aus fünf politischen Richtungen — damit du dir selbst ein Bild machen kannst.' },
        { n: '02', title: 'Ergebnisse in 3–10 Sekunden', body: 'RSS-Direct liefert Ergebnisse ohne Google-Search-Umweg. Gemini 2.5 Flash analysiert die Artikel direkt als Kontext — 3–10s statt 15–45s. RSS-Streaming zeigt erste Artikel noch früher.' },
        { n: '03', title: 'KI-Aussagen sind überprüfbar', body: 'Jede KI-Zusammenfassung zeigt darunter den originalen RSS-Auszug. Du kannst immer sehen, ob die Interpretation dem Original entspricht.' },
        { n: '04', title: 'Transparenz über unsere Methoden', body: 'Du solltest wissen, wie unsere Analyse entsteht — welche Quellen, welche KI, welche Grenzen. Wir dokumentieren alles offen auf der Methodologie-Seite.' },
        { n: '05', title: 'Unabhängig von Verlagen und Investoren', body: 'Wir nehmen keine Investitionen von deutschen Medienverlagen an. Unsere Analyse gehört niemandem außer unseren Nutzern.' },
      ],

      visionLabel: 'Wohin wir wollen',
      visionTitle: 'Ein Werkzeug, das mit der Zeit wächst.',
      visionBody: 'Wir stehen am Anfang. Österreich und die Schweiz folgen als nächstes. Danach: mehr Sprachen, mehr Länder, eine offene API für Forschung und Journalismus.',
      visionItems: [
        { icon: '◈', label: 'AT & CH', desc: 'Österreichische und Schweizer Medien sind in Planung.' },
        { icon: '⟳', label: 'Echtzeit-Alerts', desc: 'Benachrichtigungen bei neuen Entwicklungen zu gespeicherten Themen.' },
        { icon: '≡', label: 'Offene API', desc: 'Datenzugang für Forscher und Redaktionen.' },
      ],

      teamLabel: 'Das Team',
      contactBtn: 'E-Mail schreiben',
      suggestBtn: 'Quelle vorschlagen →',
    },

    en: {
      heroLabel: 'About us',
      heroQuote: 'Understanding begins with hearing all sides.',
      heroSub: 'NeutralNews is a tool that makes the full political spectrum of the German press accessible at a glance — for everyone, not just experts.',
      stat1: 'German outlets',
      stat2: 'Political camps',
      stat3: 'RSS feeds live',
      stat4: 'Languages',

      storyLabel: 'What we built',
      storyLeft: 'We crawl 18 German outlets across five political camps in real time — from taz and junge Welt on the left to Junge Freiheit and Tichys Einblick on the right. RSS algorithm v2 analyses freshness with recency weighting: breaking news gets 3× higher weight than week-old articles.',
      storyRight: 'Gemini 2.5 Flash analyses RSS articles directly as context — no Google Search. This saves 78× in cost ($0.0004 vs $0.035/request) and delivers results in 3–10s instead of 15–45s. We don\'t just show you what\'s written — we also show the original text so you can verify the AI\'s interpretation yourself.',

      archLabel: 'Architecture',
      archTitle: 'How data flows',
      archSub: 'From RSS feed to analysis — in under 15 seconds.',

      archNodes: [
        { id: 'rss',    label: 'RSS Feeds 18×',    sub: '3–8s',                      accent: 'border-rose-500',    subColor: 'text-rose-500'    },
        { id: 'v2',     label: 'v2 Algorithm',     sub: 'Compound Split + Recency',  accent: 'border-orange-400',  subColor: 'text-orange-400'  },
        { id: 'gemini', label: 'Gemini 2.5 Flash', sub: '3–10s',                     accent: 'border-emerald-500', subColor: 'text-emerald-500' },
        { id: 'out',    label: 'Analysis',         sub: '5 Spectra',                 accent: 'border-sky-500',     subColor: 'text-sky-500'     },
      ],

      numbersLabel: 'Numbers & facts',
      numbers: [
        { value: '197', label: 'Tests (all green)', accent: 'text-emerald-600' },
        { value: '78×',  label: 'Cheaper than Grounding', accent: 'text-rose-600' },
        { value: '18×',  label: 'More articles (v2 vs v1)', accent: 'text-orange-500' },
        { value: '0',    label: 'Google dependencies', accent: 'text-slate-500' },
      ],

      principlesLabel: 'What drives us',
      principles: [
        { n: '01', title: 'Every story has more than one perspective', body: 'We show the same topic from five political directions simultaneously — so you can form your own view.' },
        { n: '02', title: 'Results in 3–10 seconds', body: 'RSS-Direct delivers results without a Google Search round-trip. Gemini 2.5 Flash analyses articles directly as context — 3–10s instead of 15–45s. RSS streaming shows first articles even earlier.' },
        { n: '03', title: 'AI claims are verifiable', body: 'Every AI summary shows the original RSS excerpt below it. You can always check whether the interpretation matches the original.' },
        { n: '04', title: 'Transparency about our methods', body: 'You should know how our analysis is produced — which sources, which AI, which limitations. We document everything openly on the Methodology page.' },
        { n: '05', title: 'Independent of publishers and investors', body: 'We accept no investment from German media publishers. Our analysis belongs to nobody but our users.' },
      ],

      visionLabel: 'Where we\'re headed',
      visionTitle: 'A tool that grows with time.',
      visionBody: 'We\'re just getting started. Austria and Switzerland are next. After that: more languages, more countries, an open API for research and journalism.',
      visionItems: [
        { icon: '◈', label: 'AT & CH', desc: 'Austrian and Swiss media are in planning.' },
        { icon: '⟳', label: 'Real-time alerts', desc: 'Notifications on new developments for saved topics.' },
        { icon: '≡', label: 'Open API', desc: 'Data access for researchers and newsrooms.' },
      ],

      teamLabel: 'The Team',
      contactBtn: 'Send email',
      suggestBtn: 'Suggest a source →',
    },

    ru: {
      heroLabel: 'О нас',
      heroQuote: 'Понимание начинается с того, чтобы услышать все точки зрения.',
      heroSub: 'NeutraleNachrichten — инструмент, который делает весь политический спектр немецкой прессы доступным с первого взгляда — для всех, а не только для экспертов.',
      stat1: 'Немецких изданий',
      stat2: 'Политических лагерей',
      stat3: 'RSS-лент в реальном времени',
      stat4: 'Языка',

      storyLabel: 'Что мы построили',
      storyLeft: 'Мы в реальном времени обходим 18 немецких изданий из пяти политических лагерей — от taz и junge Welt слева до Junge Freiheit и Tichys Einblick справа. RSS-алгоритм v2 анализирует актуальность с взвешиванием по свежести: Breaking News получает в 3× больший вес, чем статьи недельной давности.',
      storyRight: 'Gemini 2.5 Flash анализирует RSS-статьи напрямую как контекст — без Google Search. Это снижает затраты в 78× ($0,0004 вместо $0,035/запрос) и даёт результаты за 3–10с вместо 15–45с. Мы показываем не только то, что написано — но и оригинальный текст, чтобы вы могли сами проверить интерпретацию ИИ.',

      archLabel: 'Архитектура',
      archTitle: 'Как движутся данные',
      archSub: 'От RSS-ленты до анализа — менее чем за 15 секунд.',

      archNodes: [
        { id: 'rss',    label: 'RSS-ленты 18×',    sub: '3–8с',                         accent: 'border-rose-500',    subColor: 'text-rose-500'    },
        { id: 'v2',     label: 'Алгоритм v2',      sub: 'Разбивка сложных слов + Recency', accent: 'border-orange-400', subColor: 'text-orange-400' },
        { id: 'gemini', label: 'Gemini 2.5 Flash', sub: '3–10с',                         accent: 'border-emerald-500', subColor: 'text-emerald-500' },
        { id: 'out',    label: 'Анализ',           sub: '5 спектров',                    accent: 'border-sky-500',     subColor: 'text-sky-500'     },
      ],

      numbersLabel: 'Цифры и факты',
      numbers: [
        { value: '197', label: 'Тестов (все зелёные)', accent: 'text-emerald-600' },
        { value: '78×',  label: 'Дешевле Grounding',   accent: 'text-rose-600'   },
        { value: '18×',  label: 'Больше статей (v2 vs v1)', accent: 'text-orange-500' },
        { value: '0',    label: 'Зависимостей от Google', accent: 'text-slate-500' },
      ],

      principlesLabel: 'Что нас движет',
      principles: [
        { n: '01', title: 'У каждой истории больше одной точки зрения', body: 'Мы показываем одну тему с пяти политических направлений одновременно — чтобы вы могли составить собственное мнение.' },
        { n: '02', title: 'Результаты за 3–10 секунд', body: 'RSS-Direct даёт результаты без обращения к Google Search. Gemini 2.5 Flash анализирует статьи напрямую как контекст — 3–10с вместо 15–45с. RSS-стриминг показывает первые статьи ещё раньше.' },
        { n: '03', title: 'Утверждения ИИ проверяемы', body: 'Под каждым AI-резюме показывается оригинальный фрагмент из RSS. Вы всегда можете проверить, соответствует ли интерпретация оригиналу.' },
        { n: '04', title: 'Прозрачность в методах', body: 'Вы должны знать, как создаётся наш анализ — какие источники, какой ИИ, какие ограничения. Мы открыто документируем всё на странице методологии.' },
        { n: '05', title: 'Независимы от издателей и инвесторов', body: 'Мы не принимаем инвестиций от немецких медиаиздателей. Наш анализ не принадлежит никому, кроме наших пользователей.' },
      ],

      visionLabel: 'Куда мы движемся',
      visionTitle: 'Инструмент, который растёт со временем.',
      visionBody: 'Мы только начинаем. Австрия и Швейцария — следующие. Затем — больше языков, больше стран, открытый API для исследований и журналистики.',
      visionItems: [
        { icon: '◈', label: 'AT & CH', desc: 'Австрийские и швейцарские СМИ в разработке.' },
        { icon: '⟳', label: 'Алерты в реальном времени', desc: 'Уведомления о новых событиях по сохранённым темам.' },
        { icon: '≡', label: 'Открытый API', desc: 'Доступ к данным для исследователей и редакций.' },
      ],

      teamLabel: 'Команда',
      contactBtn: 'Написать письмо',
      suggestBtn: 'Предложить источник →',
    },
  }[lang];

  const aboutTitle = lang === 'de'
    ? 'Über uns – NeutralNachrichten'
    : lang === 'ru'
    ? 'О нас – NeutralNachrichten'
    : 'About – NeutralNachrichten';
  const aboutDesc = lang === 'de'
    ? 'NeutralNachrichten analysiert das deutsche Medienspektrum. Erfahre mehr über unser Team, unsere Prinzipien und unsere Vision für unabhängigen Journalismus.'
    : lang === 'ru'
    ? 'NeutralNachrichten анализирует немецкий медиаспектр. Узнайте о нашей команде, принципах и видении независимой журналистики.'
    : 'NeutralNachrichten analyses the German media spectrum. Learn about our team, principles and vision for independent journalism.';

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Helmet>
        <title>{aboutTitle}</title>
        <meta name="description" content={aboutDesc} />
        <link rel="canonical" href="https://www.neutralenachrichten.com/about" />
        <meta property="og:title" content={aboutTitle} />
        <meta property="og:description" content={aboutDesc} />
        <meta property="og:url" content="https://www.neutralenachrichten.com/about" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.neutralenachrichten.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={aboutTitle} />
        <meta name="twitter:description" content={aboutDesc} />
      </Helmet>

      {/* ── Back ── */}
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 dark:hover:bg-rose-600 transition-colors duration-200 mb-8">
        <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
        {t.backToHome}
      </Link>

      {/* ════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden mb-8 animate-fade-in">
        <div className="h-1.5 flex">
          <div className="flex-1 bg-rose-500" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-400" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="px-6 sm:px-10 py-10 bg-[#1a1a1a] dark:bg-[#0a0a0a] relative overflow-hidden">
          <div className="absolute bottom-0 right-0 font-serif font-black text-[140px] leading-none text-white/[0.035] select-none pointer-events-none">
            NN
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/35 mb-4">{L.heroLabel}</p>
          <blockquote className="font-serif font-black text-2xl sm:text-3xl text-white leading-[1.2] mb-5 max-w-xl relative z-10">
            {L.heroQuote}
          </blockquote>
          <div className="h-px bg-white/10 mb-5" />
          <p className="font-serif text-sm text-white/55 leading-relaxed max-w-lg relative z-10">
            {L.heroSub}
          </p>
        </div>
        {/* Live stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-2 divide-y-2 sm:divide-y-0 divide-[#1a1a1a] dark:divide-gray-700 border-t-2 border-[#1a1a1a] dark:border-gray-700">
          {[
            { value: '18',  label: L.stat1, accent: 'text-rose-600'    },
            { value: '5',   label: L.stat2, accent: 'text-orange-500'  },
            { value: '~2s', label: L.stat3, accent: 'text-emerald-600' },
            { value: '3',   label: L.stat4, accent: 'text-sky-600'     },
          ].map(({ value, label, accent }) => (
            <div key={label} className="px-5 py-4 flex flex-col gap-1 dark:bg-[#141414]">
              <span className={`font-serif font-black text-2xl ${accent}`}>{value}</span>
              <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          STORY — two-column origin
      ════════════════════════════════════════════════════════ */}
      <div ref={storyRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.storyLabel}</p>
        </div>
        <div className="grid sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a] dark:divide-gray-700">
          <div className={`p-6 sm:p-8 dark:bg-[#141414] transition-all duration-700 ${storyInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{L.storyLeft}</p>
          </div>
          <div className={`p-6 sm:p-8 dark:bg-[#141414] transition-all duration-700 delay-150 ${storyInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <p className="font-serif text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{L.storyRight}</p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          ARCHITECTURE DIAGRAM — horizontal flow
      ════════════════════════════════════════════════════════ */}
      <div ref={archRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.archLabel}</p>
          <span className="font-sans text-[9px] uppercase tracking-widest text-white/40">{L.archSub}</span>
        </div>
        <div className="p-5 sm:p-6 dark:bg-[#141414]">
          <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-5">{L.archTitle}</p>
          {/* Desktop: horizontal flow */}
          <div className="hidden sm:flex items-start gap-0">
            {L.archNodes.map((node, i) => (
              <React.Fragment key={node.id}>
                <div
                  className={`flex-1 flex flex-col items-center gap-2 transition-all duration-500 ${archInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  {/* Node box */}
                  <div className={`w-full border-2 ${node.accent} px-3 py-3 bg-[#FFF8F0] dark:bg-[#1a1a1a] flex flex-col items-center gap-1.5`}>
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] text-center leading-tight">
                      {node.label}
                    </span>
                    <span className={`font-sans text-[9px] uppercase tracking-widest ${node.subColor} text-center leading-snug`}>
                      {node.sub}
                    </span>
                  </div>
                </div>
                {i < L.archNodes.length - 1 && (
                  <div className={`flex items-start pt-4 px-1 shrink-0 transition-all duration-500 ${archInView ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transitionDelay: `${i * 120 + 80}ms` }}>
                    <span className="font-sans text-lg text-gray-300 dark:text-gray-600">→</span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          {/* Mobile: vertical flow */}
          <div className="sm:hidden flex flex-col gap-0">
            {L.archNodes.map((node, i) => (
              <div key={node.id}>
                <div
                  className={`border-2 ${node.accent} px-4 py-3 bg-[#FFF8F0] dark:bg-[#1a1a1a] flex items-center justify-between transition-all duration-500 ${archInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4]">
                    {node.label}
                  </span>
                  <span className={`font-sans text-[9px] uppercase tracking-widest ${node.subColor}`}>
                    {node.sub}
                  </span>
                </div>
                {i < L.archNodes.length - 1 && (
                  <div className="flex justify-center py-1">
                    <span className="font-sans text-base text-gray-300 dark:text-gray-600">↓</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Accent dots — spectrum colors */}
          <div className="flex gap-1 mt-4">
            {['bg-rose-600', 'bg-orange-400', 'bg-slate-400', 'bg-sky-500', 'bg-blue-700'].map((c) => (
              <div key={c} className={`h-0.5 flex-1 ${c}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          NUMBERS — impressive stats row
      ════════════════════════════════════════════════════════ */}
      <div ref={numbersRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.numbersLabel}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-2 divide-y-2 sm:divide-y-0 divide-[#1a1a1a] dark:divide-gray-700 border-t-2 border-[#1a1a1a] dark:border-gray-700">
          {L.numbers.map((stat, i) => (
            <div
              key={stat.label}
              className={`px-5 py-5 dark:bg-[#141414] transition-all duration-500 ${numbersInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className={`font-serif font-black text-2xl sm:text-3xl ${stat.accent} mb-1`}>{stat.value}</p>
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PRINCIPLES — interactive accordion
      ════════════════════════════════════════════════════════ */}
      <div ref={principlesRef} className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] dark:text-[#f0ece4] shrink-0">{L.principlesLabel}</p>
          <div className="flex-1 h-px bg-[#1a1a1a] dark:bg-gray-600 opacity-15 dark:opacity-100" />
        </div>

        <div className="flex flex-col gap-2">
          {L.principles.map((p, i) => {
            const accents = ['text-rose-500','text-orange-500','text-amber-500','text-sky-500','text-emerald-500'];
            return (
              <PrincipleCard
                key={p.n}
                n={p.n}
                title={p.title}
                body={p.body}
                accent={accents[i % accents.length]}
                visible={principlesInView}
                delay={i * 60}
              />
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          VISION
      ════════════════════════════════════════════════════════ */}
      <div ref={visionRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.visionLabel}</p>
        </div>

        <div className={`px-6 sm:px-8 py-7 border-b-2 border-[#1a1a1a] dark:border-gray-700 dark:bg-[#141414] transition-all duration-700 ${visionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="font-serif font-black text-xl text-[#1a1a1a] dark:text-white mb-3">{L.visionTitle}</h2>
          <p className="font-serif text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">{L.visionBody}</p>
        </div>

        <div className="grid sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a] dark:divide-gray-700">
          {L.visionItems.map((item, i) => (
            <div
              key={item.label}
              className={`p-5 sm:p-6 flex flex-col gap-2 dark:bg-[#141414] transition-all duration-700 ${visionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${120 + i * 90}ms` }}
            >
              <span className="font-serif text-lg text-gray-300 dark:text-gray-600">{item.icon}</span>
              <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4]">{item.label}</p>
              <p className="font-serif text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          TEAM
      ════════════════════════════════════════════════════════ */}
      <div ref={teamRef} className="mb-8 border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.teamLabel}</p>
        </div>
        <div className="grid sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a] dark:divide-gray-700">
          {TEAM.map((member, i) => (
            <div
              key={member.name}
              className={`flex flex-col group cursor-default transition-all duration-700 ${teamInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {/* Gradient strip — expands on hover */}
              <div className={`h-1 bg-gradient-to-r ${member.gradient} transition-all duration-300 group-hover:h-2`} />
              <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1 dark:bg-[#141414]">
                {/* Avatar */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center shrink-0`}>
                    <span className="font-serif font-black text-sm text-white">{member.initials}</span>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] leading-tight">{member.name}</p>
                    <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-0.5">{member.role[lang]}</p>
                  </div>
                </div>
                {/* Bio */}
                <p className="font-serif text-xs text-gray-500 dark:text-gray-400 leading-relaxed flex-1">{member.bio[lang]}</p>
                {/* Focus tag */}
                <span className={`self-start font-sans text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-gradient-to-r ${member.gradient} text-white`}>
                  {member.focus[lang]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          INDEPENDENCE
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 border-2 border-emerald-500 overflow-hidden">
        <div className="bg-emerald-500 px-6 py-3 flex items-center gap-3">
          <span className="text-white font-bold text-base leading-none">✓</span>
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{a.independenceTitle}</p>
        </div>
        <div className="px-6 py-5 bg-emerald-50 dark:bg-emerald-950/30">
          <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{a.independenceBody}</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CONTACT
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
        <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{a.contactTitle}</p>
        </div>
        <div className="px-6 py-6 dark:bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-serif text-sm text-gray-500 dark:text-gray-400 mb-1">{a.contactBody}</p>
            <a href={`mailto:${a.contactEmail}`} className="font-serif font-bold text-base text-[#1a1a1a] dark:text-white hover:text-rose-600 transition-colors">
              {a.contactEmail}
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <a
              href={`mailto:${a.contactEmail}`}
              className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-700 text-white px-4 py-2.5 hover:bg-rose-600 transition-colors text-center"
            >
              ↗ {L.contactBtn}
            </a>
            <Link
              to="/suggest"
              className="font-sans text-[10px] uppercase tracking-widest border-2 border-[#1a1a1a] dark:border-gray-600 text-[#1a1a1a] dark:text-[#f0ece4] px-4 py-2.5 hover:bg-[#1a1a1a] dark:hover:bg-gray-700 hover:text-white transition-colors text-center"
            >
              {L.suggestBtn}
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};
