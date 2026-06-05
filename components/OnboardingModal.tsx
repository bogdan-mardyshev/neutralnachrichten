import React, { useState } from 'react';
import { Language } from '../translations';

interface Props {
  lang: Language;
  onSelectTopic: (topic: string) => void;
  onDismiss: () => void;
}

const SPECTRUM_CHIPS = [
  { label: 'links',        bg: 'bg-rose-100 text-rose-700 border-rose-200',          dot: 'bg-rose-600' },
  { label: 'mitte-links',  bg: 'bg-orange-100 text-orange-700 border-orange-200',    dot: 'bg-orange-400' },
  { label: 'mitte',        bg: 'bg-slate-100 text-slate-600 border-slate-200',       dot: 'bg-slate-400' },
  { label: 'mitte-rechts', bg: 'bg-sky-100 text-sky-700 border-sky-200',             dot: 'bg-sky-500' },
  { label: 'rechts',       bg: 'bg-blue-100 text-blue-800 border-blue-200',          dot: 'bg-blue-700' },
];

const HOW_IT_WORKS_ICONS = ['🔍', '⚡', '📊'];

const onboardingTranslations = {
  de: {
    step1Title: 'Was ist NeutralNachrichten?',
    step1Headline: 'Alle Perspektiven. Ein Blick.',
    step1Body: 'Wir analysieren 33 deutsche Nachrichtenquellen — von links bis rechts — und zeigen dir, wie jedes Lager über ein Thema berichtet.',
    step2Title: 'So funktioniert\'s',
    howItWorks: [
      { icon: '🔍', title: 'Thema eingeben', body: 'z.B. "AfD", "Klimawandel", "Bürgergeld"' },
      { icon: '⚡', title: 'KI analysiert', body: '33 Quellen parallel in ~30 Sekunden' },
      { icon: '📊', title: 'Spektrum sehen', body: 'Wer berichtet wie? Was wird verschwiegen?' },
    ],
    step3Title: 'Womit möchtest du starten?',
    exampleTopics: [
      'AfD Umfragewerte',
      'Klimawandel Deutschland',
      'Migration 2025',
      'Bürgergeld Kürzungen',
      'Ukraine Krieg',
      'Wirtschaftskrise',
    ],
    next: 'Weiter →',
    back: '← Zurück',
    startWithout: 'Starten ohne Beispiel',
    ownTopic: 'Eigenes Thema eingeben',
    source18: '33 Quellen',
    seconds30: '~30 Sekunden',
  },
  en: {
    step1Title: 'What is NeutralNachrichten?',
    step1Headline: 'All Perspectives. One View.',
    step1Body: 'We analyze 33 German news sources — from left to right — and show you how each camp covers a topic.',
    step2Title: 'How it works',
    howItWorks: [
      { icon: '🔍', title: 'Enter a topic', body: 'e.g. "AfD", "Climate change", "Citizen\'s Income"' },
      { icon: '⚡', title: 'AI analyzes', body: '33 sources in parallel in ~30 seconds' },
      { icon: '📊', title: 'See the spectrum', body: 'Who reports what? What\'s being silenced?' },
    ],
    step3Title: 'What would you like to start with?',
    exampleTopics: [
      'AfD poll ratings',
      'Climate change Germany',
      'Migration 2025',
      'Citizen\'s Income cuts',
      'Ukraine war',
      'Economic crisis',
    ],
    next: 'Next →',
    back: '← Back',
    startWithout: 'Start without an example',
    ownTopic: 'Enter your own topic',
    source18: '33 sources',
    seconds30: '~30 seconds',
  },
  ru: {
    step1Title: 'Что такое NeutralNachrichten?',
    step1Headline: 'Все точки зрения. Один взгляд.',
    step1Body: 'Мы анализируем 33 немецких новостных источников — от левых до правых — и показываем, как каждый лагерь освещает тему.',
    step2Title: 'Как это работает',
    howItWorks: [
      { icon: '🔍', title: 'Введите тему', body: 'например "АдГ", "Климат", "Пособие"' },
      { icon: '⚡', title: 'ИИ анализирует', body: '33 источников параллельно за ~30 секунд' },
      { icon: '📊', title: 'Видите спектр', body: 'Кто что пишет? Что замалчивается?' },
    ],
    step3Title: 'С чего хотите начать?',
    exampleTopics: [
      'AfD Umfragewerte',
      'Klimawandel Deutschland',
      'Migration 2025',
      'Bürgergeld Kürzungen',
      'Ukraine Krieg',
      'Wirtschaftskrise',
    ],
    next: 'Далее →',
    back: '← Назад',
    startWithout: 'Начать без примера',
    ownTopic: 'Ввести свою тему',
    source18: '33 источников',
    seconds30: '~30 секунд',
  },
};

export const OnboardingModal: React.FC<Props> = ({ lang, onSelectTopic, onDismiss }) => {
  const [step, setStep] = useState(0);
  const t = onboardingTranslations[lang];

  const handleTopicSelect = (topic: string) => {
    onSelectTopic(topic);
  };

  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      // intentionally NOT closing on backdrop click
    >
      <div
        className="relative w-full max-w-[480px] bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spectrum gradient strip at top */}
        <div className="h-[3px] flex">
          <div className="flex-1 bg-rose-600" />
          <div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" />
          <div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-lg leading-none z-10"
          aria-label="Schließen"
        >
          ×
        </button>

        {/* Content area */}
        <div className="p-6 pb-5">
          {/* Step 1 */}
          {step === 0 && (
            <div className="animate-fade-in">
              <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
                {t.step1Title}
              </p>
              <div className="text-4xl mb-4">🗞️</div>
              <h2 className="font-serif font-black text-2xl text-[#1a1a1a] dark:text-white leading-tight mb-3">
                {t.step1Headline}
              </h2>
              <p className="font-sans text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                {t.step1Body}
              </p>

              {/* Spectrum chips */}
              <div className="flex flex-wrap gap-2 mb-6">
                {SPECTRUM_CHIPS.map((chip) => (
                  <span
                    key={chip.label}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-sans font-medium ${chip.bg}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} />
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 1 && (
            <div className="animate-fade-in">
              <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
                {t.step2Title}
              </p>
              <div className="space-y-4 mb-6">
                {t.howItWorks.map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF8F0] dark:bg-[#2a2a2a] flex items-center justify-center text-xl shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-serif font-bold text-[#1a1a1a] dark:text-white text-sm leading-snug">
                        {item.title}
                      </p>
                      <p className="font-sans text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 2 && (
            <div className="animate-fade-in">
              <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
                {t.step3Title}
              </p>
              <div className="flex flex-wrap gap-2 mb-5 mt-4">
                {t.exampleTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleTopicSelect(topic)}
                    className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-[#2a2a2a] text-sm font-sans text-slate-700 dark:text-gray-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:border-rose-800 dark:hover:text-rose-300 transition-colors press-scale"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {/* Back button (steps 2 and 3) or spacer */}
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="font-sans text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {t.back}
              </button>
            ) : (
              <div />
            )}

            {/* Right side: progress dots + action button */}
            <div className="flex items-center gap-4">
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i === step
                        ? 'w-4 h-2 bg-rose-600'
                        : i < step
                        ? 'w-2 h-2 bg-rose-300'
                        : 'w-2 h-2 bg-gray-200 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              {/* Action button */}
              {step < 2 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="font-sans text-xs font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] px-4 py-2 hover:bg-rose-600 dark:hover:bg-rose-600 dark:hover:text-white transition-colors"
                >
                  {t.next}
                </button>
              ) : (
                <button
                  onClick={handleDismiss}
                  className="font-sans text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  {t.startWithout}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
