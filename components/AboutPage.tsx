import React, { useEffect, useRef, useState } from 'react';
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

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
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

// ── Main ──────────────────────────────────────────────────────────────────────

export const AboutPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const a = t.about;

  const { ref: principlesRef, inView: principlesInView } = useInView(0.05);
  const { ref: problemRef,    inView: problemInView    } = useInView(0.1);
  const { ref: nameRef,       inView: nameInView       } = useInView(0.1);
  const { ref: visionRef,     inView: visionInView     } = useInView(0.1);
  const { ref: teamRef,       inView: teamInView       } = useInView(0.05);

  const L = {
    de: {
      contactBtn: 'E-Mail schreiben',
      suggestBtn: 'Quelle vorschlagen →',

      heroLabel: 'Unsere Philosophie',
      heroQuote: 'Was du nicht liest, formt dich genauso wie das, was du liest.',
      heroSub: 'NeutraleNachrichten ist kein Nachrichtenportal. Wir sind ein Werkzeug — gebaut für alle, die verstehen wollen, was wirklich gesagt wird.',

      problemLabel: 'Das Problem',
      problemTitle: 'Deutschland lebt in parallelen Informationswelten.',
      problemBody1: 'Wer täglich den Spiegel liest und wer täglich die Junge Freiheit liest, begegnet nicht nur verschiedenen Meinungen — sondern unterschiedlichen Wirklichkeiten. Verschiedene Fakten. Verschiedene Helden und Schurken. Verschiedene Krisen.',
      problemBody2: 'Das ist kein Zufall, kein Versagen. Es ist Architektur. Algorithmen maximieren Verweildauer, indem sie uns in Blasen halten. Medien bauen Identitäten auf, nicht nur Leser. Und je mehr wir konsumieren, desto weniger sehen wir.',
      problemBody3: 'Das Ergebnis: Politische Polarisierung wird nicht durch schlechte Argumente verursacht — sondern durch das systematische Nichtwissen, was die andere Seite überhaupt denkt.',

      nameLabel: 'Was "Neutral" bedeutet',
      nameTitle: 'Wir sind nicht neutral. Unsere Methode ist es.',
      nameBody1: 'Es gibt ein häufiges Missverständnis über unseren Namen. "NeutraleNachrichten" bedeutet nicht, dass wir keine Überzeugungen haben. Wir haben welche — und sie sind stark: Filterblasen schaden der Demokratie. Blinde Flecken sind gefährlich. Medienkompetenz ist ein Bürgerrecht.',
      nameBody2: 'Was neutral ist, ist unser Werkzeug. Wir analysieren junge Welt und Junge Freiheit mit denselben Prompts, denselben Algorithmen, denselben Maßstäben. Kein Lager wird bevorzugt. Kein Lager wird ausgelassen. Wir nennen das: methodische Neutralität.',
      nameCallout: 'Neutral in der Methode. Klar in der Mission.',

      principlesLabel: 'Was wir glauben',
      principles: [
        {
          n: '01',
          title: 'Blinde Flecken sind nicht harmlos',
          body: 'Was ein Medium nicht berichtet, ist oft bedeutsamer als das, was es berichtet. Wir machen sichtbar, worüber jedes politische Lager schweigt — nicht um zu urteilen, sondern um vollständiger zu informieren.',
          accent: 'border-rose-500',
          num: 'text-rose-500',
        },
        {
          n: '02',
          title: 'Demokratie braucht Pluralismus',
          body: 'Eine Demokratie, in der Bürger nur ihre eigene Seite kennen, ist fragil. Das Recht auf Information umfasst das Recht zu wissen, was andere denken — nicht nur, was man selbst denken soll.',
          accent: 'border-orange-400',
          num: 'text-orange-500',
        },
        {
          n: '03',
          title: 'Medienkompetenz gehört allen',
          body: 'Früher brauchte man ein Abo bei fünf Zeitungen und täglich drei Stunden Zeit, um das Spektrum zu überblicken. Wir glauben, dass dieses Privileg aufhören muss, eines zu sein.',
          accent: 'border-amber-400',
          num: 'text-amber-500',
        },
        {
          n: '04',
          title: 'Transparenz über Algorithmen',
          body: 'Du solltest verstehen, wie unsere Analyse entsteht — welche Quellen wir nutzen, wie wir klassifizieren, wo unsere Methode an Grenzen stößt. Kein Black-Box-Journalismus.',
          accent: 'border-sky-400',
          num: 'text-sky-500',
        },
        {
          n: '05',
          title: 'Unabhängigkeit ist kein Verhandlungspunkt',
          body: 'Wir nehmen keine Investitionen von deutschen Medienverlagen an. Kein Axel Springer, kein Bertelsmann, keine Parteinahen Stiftungen. Wer die Analyse bezahlt, beeinflusst die Analyse.',
          accent: 'border-emerald-500',
          num: 'text-emerald-500',
        },
        {
          n: '06',
          title: 'Wir nehmen Fehler ernst',
          body: 'KI-Systeme irren sich. Quellen sind manchmal unvollständig. Klassifizierungen sind subjektiv. Wir dokumentieren unsere Methodik offen und arbeiten kontinuierlich daran, besser zu werden.',
          accent: 'border-violet-500',
          num: 'text-violet-500',
        },
      ],

      visionLabel: 'Wohin wir wollen',
      visionTitle: 'Eine Öffentlichkeit, die die gesamte Debatte kennt.',
      visionBody: 'Langfristig wollen wir nicht nur ein Werkzeug sein — sondern ein Standard. Eine Infrastruktur für informierte Teilhabe. Wir stellen uns eine Welt vor, in der niemand mehr sagen kann: "Ich wusste nicht, was die andere Seite denkt."',
      visionPillars: [
        { icon: '◈', label: 'Mehr Länder', desc: 'Österreich und Schweiz sind geplant. Danach: andere europäische Medienlandschaften.' },
        { icon: '⟳', label: 'Echtzeit-Alerts', desc: 'Benachrichtigungen, wenn ein Thema plötzlich unterschiedlich bewertet wird.' },
        { icon: '≡', label: 'API für Forscher', desc: 'Öffentlicher Datenzugang für Medien- und Demokratieforschung.' },
      ],

      teamLabel: 'Das Team',
      independenceLabel: 'Unsere Unabhängigkeit',
    },

    en: {
      contactBtn: 'Send email',
      suggestBtn: 'Suggest a source →',

      heroLabel: 'Our Philosophy',
      heroQuote: 'What you don\'t read shapes you just as much as what you do.',
      heroSub: 'NeutralNews is not a news outlet. We\'re a tool — built for anyone who wants to understand what is actually being said.',

      problemLabel: 'The Problem',
      problemTitle: 'Germany lives in parallel information worlds.',
      problemBody1: 'Someone who reads Der Spiegel every day and someone who reads Junge Freiheit every day don\'t just encounter different opinions — they inhabit different realities. Different facts. Different heroes and villains. Different crises.',
      problemBody2: 'This is not an accident, not a failure. It is architecture. Algorithms maximize engagement by keeping us in bubbles. Media builds identities, not just readerships. And the more we consume, the less we see.',
      problemBody3: 'The result: political polarization is not caused by bad arguments — it\'s caused by the systematic ignorance of what the other side even thinks.',

      nameLabel: 'What "Neutral" means',
      nameTitle: 'We are not neutral. Our method is.',
      nameBody1: 'There is a common misconception about our name. "NeutralNews" does not mean we have no convictions. We have them — and they are strong: filter bubbles harm democracy. Blind spots are dangerous. Media literacy is a civic right.',
      nameBody2: 'What is neutral is our tool. We analyze junge Welt and Junge Freiheit with the same prompts, the same algorithms, the same standards. No camp is favored. No camp is excluded. We call this: methodological neutrality.',
      nameCallout: 'Neutral in method. Clear in mission.',

      principlesLabel: 'What we believe',
      principles: [
        {
          n: '01',
          title: 'Blind spots are not harmless',
          body: 'What a medium doesn\'t report is often more significant than what it does. We make visible what each political camp is silent about — not to judge, but to inform more completely.',
          accent: 'border-rose-500',
          num: 'text-rose-500',
        },
        {
          n: '02',
          title: 'Democracy requires pluralism',
          body: 'A democracy in which citizens only know their own side is fragile. The right to information includes the right to know what others think — not just what you are supposed to think.',
          accent: 'border-orange-400',
          num: 'text-orange-500',
        },
        {
          n: '03',
          title: 'Media literacy belongs to everyone',
          body: 'It used to take five newspaper subscriptions and three hours a day to survey the full spectrum. We believe this privilege must stop being a privilege.',
          accent: 'border-amber-400',
          num: 'text-amber-500',
        },
        {
          n: '04',
          title: 'Transparency about algorithms',
          body: 'You should understand how our analysis is produced — which sources we use, how we classify, where our method hits its limits. No black-box journalism.',
          accent: 'border-sky-400',
          num: 'text-sky-500',
        },
        {
          n: '05',
          title: 'Independence is non-negotiable',
          body: 'We accept no investment from German media publishers. No Axel Springer, no Bertelsmann, no party-affiliated foundations. Whoever funds the analysis influences the analysis.',
          accent: 'border-emerald-500',
          num: 'text-emerald-500',
        },
        {
          n: '06',
          title: 'We take mistakes seriously',
          body: 'AI systems make errors. Sources are sometimes incomplete. Classifications are subjective. We document our methodology openly and work continuously to improve.',
          accent: 'border-violet-500',
          num: 'text-violet-500',
        },
      ],

      visionLabel: 'Where we\'re headed',
      visionTitle: 'A public that knows the full debate.',
      visionBody: 'Long term, we want to be more than a tool — we want to be a standard. An infrastructure for informed civic participation. We envision a world where no one can say: "I didn\'t know what the other side thinks."',
      visionPillars: [
        { icon: '◈', label: 'More countries', desc: 'Austria and Switzerland are next. Then: other European media landscapes.' },
        { icon: '⟳', label: 'Real-time alerts', desc: 'Notifications when a topic suddenly diverges across the spectrum.' },
        { icon: '≡', label: 'API for researchers', desc: 'Public data access for media and democracy research.' },
      ],

      teamLabel: 'The Team',
      independenceLabel: 'Our Independence',
    },

    ru: {
      contactBtn: 'Написать письмо',
      suggestBtn: 'Предложить источник →',

      heroLabel: 'Наша философия',
      heroQuote: 'То, что вы не читаете, формирует вас не меньше, чем то, что вы читаете.',
      heroSub: 'NeutraleNachrichten — не новостной портал. Мы инструмент — созданный для тех, кто хочет понять, что на самом деле говорится.',

      problemLabel: 'Проблема',
      problemTitle: 'Германия живёт в параллельных информационных мирах.',
      problemBody1: 'Тот, кто ежедневно читает Spiegel, и тот, кто читает Junge Freiheit, сталкиваются не просто с разными мнениями — они живут в разных реальностях. Разные факты. Разные герои и злодеи. Разные кризисы.',
      problemBody2: 'Это не случайность и не чей-то провал. Это архитектура. Алгоритмы максимизируют вовлечённость, удерживая нас в пузырях. СМИ формируют идентичности, а не просто читательские аудитории. И чем больше мы потребляем, тем меньше видим.',
      problemBody3: 'Результат: политическая поляризация вызвана не плохими аргументами — она вызвана систематическим незнанием того, что вообще думает другая сторона.',

      nameLabel: 'Что означает "Neutral"',
      nameTitle: 'Мы не нейтральны. Наш метод — да.',
      nameBody1: 'Есть распространённое заблуждение о нашем названии. «NeutraleNachrichten» не означает, что у нас нет убеждений. Они есть — и они сильны: фильтр-пузыри вредят демократии. Слепые пятна опасны. Медиаграмотность — гражданское право.',
      nameBody2: 'Нейтрален наш инструмент. Мы анализируем junge Welt и Junge Freiheit с одинаковыми промптами, одинаковыми алгоритмами, одинаковыми критериями. Ни один лагерь не в привилегии. Ни один не игнорируется. Мы называем это: методологическая нейтральность.',
      nameCallout: 'Нейтральны в методе. Ясны в миссии.',

      principlesLabel: 'Во что мы верим',
      principles: [
        {
          n: '01',
          title: 'Слепые пятна не безобидны',
          body: 'То, о чём СМИ молчит, зачастую важнее того, что оно говорит. Мы делаем видимым, о чём умалчивает каждый политический лагерь — не чтобы судить, а чтобы информировать полнее.',
          accent: 'border-rose-500',
          num: 'text-rose-500',
        },
        {
          n: '02',
          title: 'Демократия требует плюрализма',
          body: 'Демократия, в которой граждане знают только свою сторону, хрупка. Право на информацию включает право знать, что думают другие — а не только то, что нужно думать самому.',
          accent: 'border-orange-400',
          num: 'text-orange-500',
        },
        {
          n: '03',
          title: 'Медиаграмотность — для всех',
          body: 'Раньше для обзора всего спектра нужно было подписаться на пять газет и тратить три часа в день. Мы считаем, что эта привилегия должна перестать ею быть.',
          accent: 'border-amber-400',
          num: 'text-amber-500',
        },
        {
          n: '04',
          title: 'Прозрачность алгоритмов',
          body: 'Вы должны понимать, как создаётся наш анализ — какие источники мы используем, как классифицируем, где наш метод упирается в ограничения. Никакой журналистики чёрного ящика.',
          accent: 'border-sky-400',
          num: 'text-sky-500',
        },
        {
          n: '05',
          title: 'Независимость не предмет торга',
          body: 'Мы не принимаем инвестиций от немецких медиаиздателей. Ни Axel Springer, ни Bertelsmann, ни аффилированных с партиями фондов. Кто финансирует анализ — влияет на анализ.',
          accent: 'border-emerald-500',
          num: 'text-emerald-500',
        },
        {
          n: '06',
          title: 'Мы серьёзно относимся к ошибкам',
          body: 'ИИ-системы ошибаются. Источники иногда неполны. Классификации субъективны. Мы открыто документируем нашу методологию и постоянно работаем над её улучшением.',
          accent: 'border-violet-500',
          num: 'text-violet-500',
        },
      ],

      visionLabel: 'Куда мы движемся',
      visionTitle: 'Общество, которое знает всю дискуссию.',
      visionBody: 'В долгосрочной перспективе мы хотим быть не просто инструментом — мы хотим стать стандартом. Инфраструктурой для информированного гражданского участия. Мы представляем мир, в котором никто больше не сможет сказать: «Я не знал, что думает другая сторона».',
      visionPillars: [
        { icon: '◈', label: 'Больше стран', desc: 'Австрия и Швейцария — следующие. Затем: другие европейские медиапространства.' },
        { icon: '⟳', label: 'Алерты в реальном времени', desc: 'Уведомления, когда тема внезапно по-разному оценивается разными лагерями.' },
        { icon: '≡', label: 'API для исследователей', desc: 'Открытый доступ к данным для медиа- и демократических исследований.' },
      ],

      teamLabel: 'Команда',
      independenceLabel: 'Наша независимость',
    },
  }[lang];

  return (
    <div className="max-w-4xl mx-auto pb-16">

      {/* ── Back ──────────────────────────────────────────────── */}
      <Link to="/" className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors flex items-center gap-1.5 mb-8">
        ← {t.backToHome}
      </Link>

      {/* ════════════════════════════════════════════════════════
          HERO — philosophical manifesto masthead
      ════════════════════════════════════════════════════════ */}
      <div className="border-2 border-[#1a1a1a] overflow-hidden mb-8">
        {/* Spectrum bar */}
        <div className="h-2 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <div className="px-6 sm:px-10 py-10 bg-[#1a1a1a] relative overflow-hidden">
          {/* Large decorative quote mark */}
          <div className="absolute top-2 right-6 font-serif font-black text-[160px] leading-none text-white/[0.04] select-none pointer-events-none">
            "
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/40 mb-5">{L.heroLabel}</p>
          <blockquote className="font-serif font-black text-2xl sm:text-3xl md:text-4xl text-white leading-[1.15] mb-6 max-w-2xl relative z-10 italic">
            {L.heroQuote}
          </blockquote>
          <div className="h-px bg-white/10 mb-5" />
          <p className="font-serif text-sm sm:text-base text-white/60 leading-relaxed max-w-xl relative z-10">
            {L.heroSub}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PROBLEM — the filter bubble crisis
      ════════════════════════════════════════════════════════ */}
      <div ref={problemRef} className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.problemLabel}</p>
        </div>

        <div className="grid sm:grid-cols-5">
          {/* Left — big title */}
          <div className={`sm:col-span-2 p-6 sm:p-8 border-b-2 sm:border-b-0 sm:border-r-2 border-[#1a1a1a] flex flex-col justify-center transition-all duration-700 ${problemInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}>
            <p className="font-serif font-black text-xl sm:text-2xl text-[#1a1a1a] leading-tight">{L.problemTitle}</p>
            <div className="mt-4 flex gap-1">
              <div className="w-6 h-0.5 bg-rose-500" />
              <div className="w-6 h-0.5 bg-orange-400" />
              <div className="w-6 h-0.5 bg-slate-400" />
              <div className="w-6 h-0.5 bg-sky-500" />
              <div className="w-6 h-0.5 bg-blue-700" />
            </div>
          </div>

          {/* Right — body text */}
          <div className={`sm:col-span-3 p-6 sm:p-8 flex flex-col gap-4 transition-all duration-700 delay-150 ${problemInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}>
            <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{L.problemBody1}</p>
            <div className="h-px bg-gray-200" />
            <p className="font-serif text-sm text-gray-500 leading-relaxed">{L.problemBody2}</p>
            <div className="h-px bg-gray-200" />
            <p className="font-serif text-sm text-gray-500 leading-relaxed">{L.problemBody3}</p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          "NEUTRAL" — the key philosophical clarification
      ════════════════════════════════════════════════════════ */}
      <div ref={nameRef} className="mb-8 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-4 mb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] shrink-0">{L.nameLabel}</p>
          <div className="flex-1 h-px bg-[#1a1a1a] opacity-15" />
        </div>

        <div className="border-2 border-[#1a1a1a] overflow-hidden">
          {/* Title row */}
          <div className={`px-6 sm:px-8 pt-7 pb-5 transition-all duration-700 ${nameInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h2 className="font-serif font-black text-xl sm:text-2xl text-[#1a1a1a] leading-tight mb-1">{L.nameTitle}</h2>
          </div>

          <div className="grid sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a]">
            <div className={`px-6 sm:px-8 pb-7 sm:py-7 transition-all duration-700 delay-100 ${nameInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <p className="font-serif text-sm text-[#1a1a1a] leading-relaxed">{L.nameBody1}</p>
            </div>
            <div className={`px-6 sm:px-8 py-7 transition-all duration-700 delay-200 ${nameInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <p className="font-serif text-sm text-gray-500 leading-relaxed">{L.nameBody2}</p>
            </div>
          </div>

          {/* Callout strip */}
          <div className={`border-t-2 border-[#1a1a1a] bg-[#1a1a1a] px-6 sm:px-8 py-4 flex items-center gap-4 transition-all duration-700 delay-300 ${nameInView ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex gap-1 shrink-0">
              <div className="w-5 h-0.5 bg-rose-400" />
              <div className="w-5 h-0.5 bg-orange-400" />
              <div className="w-5 h-0.5 bg-amber-400" />
            </div>
            <p className="font-serif font-bold text-base sm:text-lg text-white italic">{L.nameCallout}</p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PRINCIPLES — 6 belief cards
      ════════════════════════════════════════════════════════ */}
      <div ref={principlesRef} className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] shrink-0">{L.principlesLabel}</p>
          <div className="flex-1 h-px bg-[#1a1a1a] opacity-15" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {L.principles.map((p, i) => (
            <div
              key={p.n}
              className={`border-2 border-[#1a1a1a] p-5 flex flex-col gap-3 group hover:bg-[#1a1a1a] transition-all duration-200 cursor-default ${principlesInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
              style={{ transitionDelay: `${i * 70}ms`, transitionProperty: 'opacity, transform, background-color' }}
            >
              {/* Number + accent line */}
              <div className="flex items-center gap-3">
                <span className={`font-serif font-black text-2xl ${p.num} group-hover:text-white transition-colors leading-none`}>{p.n}</span>
                <div className={`flex-1 h-0.5 border-b-2 ${p.accent} group-hover:border-white/30 transition-colors`} />
              </div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] group-hover:text-white transition-colors leading-tight">
                {p.title}
              </p>
              <p className="font-serif text-xs text-gray-500 group-hover:text-white/60 leading-relaxed transition-colors flex-1">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          VISION — where we're headed
      ════════════════════════════════════════════════════════ */}
      <div ref={visionRef} className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.visionLabel}</p>
        </div>

        <div className={`px-6 sm:px-8 py-7 border-b-2 border-[#1a1a1a] transition-all duration-700 ${visionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="font-serif font-black text-xl sm:text-2xl text-[#1a1a1a] leading-tight mb-4">{L.visionTitle}</h2>
          <p className="font-serif text-sm text-gray-500 leading-relaxed max-w-2xl">{L.visionBody}</p>
        </div>

        <div className="grid sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a]">
          {L.visionPillars.map((pillar, i) => (
            <div
              key={pillar.label}
              className={`p-5 flex flex-col gap-2 transition-all duration-700 ${visionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${150 + i * 100}ms` }}
            >
              <span className="text-xl text-[#1a1a1a]">{pillar.icon}</span>
              <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">{pillar.label}</p>
              <p className="font-serif text-xs text-gray-400 leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          TEAM — gradient avatar cards
      ════════════════════════════════════════════════════════ */}
      <div ref={teamRef} className="mb-8 border-2 border-[#1a1a1a] overflow-hidden">
        <div className="bg-[#1a1a1a] px-6 py-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.teamLabel}</p>
        </div>
        <div className="grid sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1a1a1a]">
          {TEAM.map((member, i) => (
            <div
              key={member.name}
              className={`flex flex-col transition-all duration-700 ${teamInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className={`h-1.5 bg-gradient-to-r ${member.gradient}`} />
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center shrink-0 shadow`}>
                    <span className="font-serif font-black text-base text-white">{member.initials}</span>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] leading-tight">{member.name}</p>
                    <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">{member.role[lang]}</p>
                  </div>
                </div>
                <p className="font-serif text-xs text-gray-500 leading-relaxed flex-1">{member.bio[lang]}</p>
                <span className={`self-start font-sans text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-gradient-to-r ${member.gradient} text-white`}>
                  {member.tag[lang]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          INDEPENDENCE — editorial principles banner
      ════════════════════════════════════════════════════════ */}
      <div className="mb-8 overflow-hidden border-2 border-emerald-500">
        <div className="bg-emerald-500 px-6 py-3 flex items-center gap-3">
          <span className="text-white font-bold text-lg leading-none">✓</span>
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{L.independenceLabel}</p>
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
