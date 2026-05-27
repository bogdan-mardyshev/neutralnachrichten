import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

type Spectrum = 'left' | 'center_left' | 'center' | 'center_right' | 'right' | 'unsure' | '';

const SPECTRUM_OPTS: { value: Spectrum; label: Record<Language, string>; dot: string; arrow: string }[] = [
  { value: 'left',         label: { de: 'Links',        en: 'Left',         ru: 'Левые'       }, dot: 'bg-rose-500',   arrow: '←' },
  { value: 'center_left',  label: { de: 'Mitte-Links',  en: 'Center-Left',  ru: 'Центр-Лево'  }, dot: 'bg-orange-400', arrow: '↖' },
  { value: 'center',       label: { de: 'Mitte',        en: 'Center',       ru: 'Центр'       }, dot: 'bg-slate-400',  arrow: '↕' },
  { value: 'center_right', label: { de: 'Mitte-Rechts', en: 'Center-Right', ru: 'Центр-Право' }, dot: 'bg-sky-500',    arrow: '↗' },
  { value: 'right',        label: { de: 'Rechts',       en: 'Right',        ru: 'Правые'      }, dot: 'bg-blue-700',   arrow: '→' },
  { value: 'unsure',       label: { de: 'Unbekannt',    en: 'Not sure',     ru: 'Не знаю'     }, dot: 'bg-gray-400',   arrow: '?' },
];

const L: Record<Language, {
  heroLabel: string; heroTitle: string; heroBadge: string;
  nameLabel: string; namePlaceholder: string;
  emailLabel: string; emailPlaceholder: string;
  urlLabel: string; urlPlaceholder: string;
  spectrumLabel: string; spectrumSub: string;
  whyLabel: string; whyPlaceholder: string;
  gdprText: string; submitBtn: string;
  successTitle: string; successBody: string;
  errorText: string;
  required: string;
  urlRequired: string; whyRequired: string; gdprRequired: string;
  sideTitle: string;
  sideItems: { icon: string; title: string; desc: string }[];
  currentLabel: string;
  currentItems: string[];
}> = {
  de: {
    heroLabel: 'Community',
    heroTitle: 'Quelle vorschlagen',
    heroBadge: 'Wird von uns geprüft',
    nameLabel: 'Name (optional)',
    namePlaceholder: 'Dein Name',
    emailLabel: 'E-Mail (optional)',
    emailPlaceholder: 'Für Rückmeldungen',
    urlLabel: 'URL der Quelle *',
    urlPlaceholder: 'https://beispiel.de/rss',
    spectrumLabel: 'Politisches Spektrum',
    spectrumSub: 'Deine Einschätzung',
    whyLabel: 'Warum sollten wir diese Quelle aufnehmen? *',
    whyPlaceholder: 'Was macht diese Quelle besonders? Welche Perspektive fehlt noch?',
    gdprText: 'Ich bin damit einverstanden, dass meine Angaben für die Bearbeitung meiner Anfrage gespeichert werden.',
    submitBtn: 'Vorschlag einreichen',
    successTitle: 'Danke für deinen Vorschlag',
    successBody: 'Wir prüfen die Quelle auf RSS-Verfügbarkeit, redaktionelle Qualität und politische Einordnung. Du hörst von uns.',
    errorText: 'Fehler beim Senden. Bitte versuche es erneut.',
    required: 'Pflichtfeld',
    urlRequired: 'URL ist erforderlich',
    whyRequired: 'Bitte begründe deinen Vorschlag',
    gdprRequired: 'Zustimmung erforderlich',
    sideTitle: 'Aufnahmekriterien',
    sideItems: [
      { icon: '◎', title: 'RSS-Feed vorhanden', desc: 'Die Quelle muss einen öffentlich zugänglichen RSS- oder Atom-Feed haben.' },
      { icon: '↕', title: 'Aktuelle Berichterstattung', desc: 'Mindestens 3 Artikel pro Woche. Keine reinen Meinungsblogs.' },
      { icon: '◌', title: 'Klare redaktionelle Linie', desc: 'Die politische Einordnung muss eindeutig und beständig sein.' },
      { icon: '≡', title: 'Fehlende Perspektive', desc: 'Quellen werden bevorzugt aufgenommen, wenn ein Spektrum noch unterrepräsentiert ist.' },
    ],
    currentLabel: 'Bereits aufgenommen',
    currentItems: ['taz', 'nd-aktuell', 'Junge Welt', 'Spiegel', 'SZ', 'Zeit', 'Tagesspiegel', 'Tagesschau', 'ZDF', 'DLF', 'FAZ', 'Welt', 'Focus', 'NTV', 'Handelsblatt', 'Bild', 'Junge Freiheit', 'Tichys Einblick'],
  },
  en: {
    heroLabel: 'Community',
    heroTitle: 'Suggest a source',
    heroBadge: 'Reviewed by us',
    nameLabel: 'Name (optional)',
    namePlaceholder: 'Your name',
    emailLabel: 'Email (optional)',
    emailPlaceholder: 'For follow-up',
    urlLabel: 'Source URL *',
    urlPlaceholder: 'https://example.com/rss',
    spectrumLabel: 'Political spectrum',
    spectrumSub: 'Your assessment',
    whyLabel: 'Why should we add this source? *',
    whyPlaceholder: 'What makes this source special? Which perspective is still missing?',
    gdprText: 'I agree to my data being stored for the processing of this request.',
    submitBtn: 'Submit suggestion',
    successTitle: 'Thanks for your suggestion',
    successBody: 'We review the source for RSS availability, editorial quality and political positioning. We\'ll get back to you.',
    errorText: 'Error sending. Please try again.',
    required: 'Required',
    urlRequired: 'URL is required',
    whyRequired: 'Please give a reason for your suggestion',
    gdprRequired: 'Consent required',
    sideTitle: 'Inclusion criteria',
    sideItems: [
      { icon: '◎', title: 'RSS feed available', desc: 'The source must have a publicly accessible RSS or Atom feed.' },
      { icon: '↕', title: 'Active reporting', desc: 'At least 3 articles per week. No pure opinion blogs.' },
      { icon: '◌', title: 'Clear editorial line', desc: 'The political positioning must be clear and consistent.' },
      { icon: '≡', title: 'Missing perspective', desc: 'Sources are prioritised where a spectrum is still underrepresented.' },
    ],
    currentLabel: 'Already included',
    currentItems: ['taz', 'nd-aktuell', 'Junge Welt', 'Spiegel', 'SZ', 'Zeit', 'Tagesspiegel', 'Tagesschau', 'ZDF', 'DLF', 'FAZ', 'Welt', 'Focus', 'NTV', 'Handelsblatt', 'Bild', 'Junge Freiheit', 'Tichys Einblick'],
  },
  ru: {
    heroLabel: 'Сообщество',
    heroTitle: 'Предложить источник',
    heroBadge: 'Проверяется нами',
    nameLabel: 'Имя (необязательно)',
    namePlaceholder: 'Ваше имя',
    emailLabel: 'E-mail (необязательно)',
    emailPlaceholder: 'Для обратной связи',
    urlLabel: 'URL источника *',
    urlPlaceholder: 'https://пример.de/rss',
    spectrumLabel: 'Политический спектр',
    spectrumSub: 'Ваша оценка',
    whyLabel: 'Почему мы должны добавить этот источник? *',
    whyPlaceholder: 'Чем он особенный? Какой перспективы ещё не хватает?',
    gdprText: 'Я согласен с тем, что мои данные будут сохранены для обработки этого запроса.',
    submitBtn: 'Отправить предложение',
    successTitle: 'Спасибо за предложение',
    successBody: 'Мы проверяем источник по наличию RSS, редакционному качеству и политической классификации. Мы вам ответим.',
    errorText: 'Ошибка отправки. Пожалуйста, попробуйте ещё раз.',
    required: 'Обязательно',
    urlRequired: 'URL обязателен',
    whyRequired: 'Пожалуйста, обоснуйте предложение',
    gdprRequired: 'Требуется согласие',
    sideTitle: 'Критерии включения',
    sideItems: [
      { icon: '◎', title: 'Наличие RSS-ленты', desc: 'Источник должен иметь публично доступный RSS- или Atom-фид.' },
      { icon: '↕', title: 'Активное освещение', desc: 'Не менее 3 статей в неделю. Не чисто мнениевые блоги.' },
      { icon: '◌', title: 'Чёткая редакционная позиция', desc: 'Политическая классификация должна быть однозначной и стабильной.' },
      { icon: '≡', title: 'Недостающая перспектива', desc: 'Источники в приоритете, если спектр ещё недостаточно представлен.' },
    ],
    currentLabel: 'Уже включены',
    currentItems: ['taz', 'nd-aktuell', 'Junge Welt', 'Spiegel', 'SZ', 'Zeit', 'Tagesspiegel', 'Tagesschau', 'ZDF', 'DLF', 'FAZ', 'Welt', 'Focus', 'NTV', 'Handelsblatt', 'Bild', 'Junge Freiheit', 'Tichys Einblick'],
  },
};

export const SuggestPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const lx = L[lang];

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [url,      setUrl]      = useState('');
  const [spectrum, setSpectrum] = useState<Spectrum>('');
  const [why,      setWhy]      = useState('');
  const [gdpr,     setGdpr]     = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!url.trim())  e.url  = lx.urlRequired;
    if (!why.trim())  e.why  = lx.whyRequired;
    if (!gdpr)        e.gdpr = lx.gdprRequired;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/suggest-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, url, spectrum, why }),
      });
      if (!res.ok) throw new Error('server error');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const suggestTitle = lang === 'de'
    ? 'Quelle vorschlagen – NeutralNachrichten'
    : lang === 'ru'
    ? 'Предложить источник – NeutralNachrichten'
    : 'Suggest a source – NeutralNachrichten';
  const suggestDesc = lang === 'de'
    ? 'Schlage eine neue Medienquelle für NeutralNachrichten vor. Wir analysieren ständig neue RSS-Quellen aus dem deutschen Medienspektrum.'
    : lang === 'ru'
    ? 'Предложите новый медиаисточник для NeutralNachrichten. Мы постоянно анализируем новые RSS-источники из немецкого медиаспектра.'
    : 'Suggest a new media source for NeutralNachrichten. We constantly analyse new RSS sources from the German media spectrum.';

  // ── Success State ─────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="max-w-2xl mx-auto pb-16">
        <Helmet>
          <title>{suggestTitle}</title>
          <meta name="description" content={suggestDesc} />
          <link rel="canonical" href="https://www.neutralenachrichten.com/suggest" />
        </Helmet>
        <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
          <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
          {t.backToHome}
        </Link>
        <div className="border-2 border-emerald-500 overflow-hidden">
          <div className="bg-emerald-500 px-6 py-3 flex items-center gap-3">
            <span className="text-white font-bold text-base leading-none">✓</span>
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{lx.successTitle}</p>
          </div>
          <div className="px-8 py-10 bg-emerald-50 dark:bg-emerald-950/30 text-center">
            <div className="flex gap-1 justify-center mb-6">
              {['bg-rose-600', 'bg-orange-400', 'bg-slate-400', 'bg-sky-500', 'bg-blue-700'].map(c => (
                <div key={c} className={`h-1 w-8 ${c}`} />
              ))}
            </div>
            <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed max-w-md mx-auto">
              {lx.successBody}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const inputCls = (field: string) =>
    `w-full border-b-2 ${
      errors[field]
        ? 'border-rose-500 dark:border-rose-500'
        : 'border-[#1a1a1a] dark:border-gray-600'
    } bg-transparent py-2 font-sans text-sm text-[#1a1a1a] dark:text-[#f0ece4] focus:outline-none focus:border-rose-500 dark:focus:border-rose-400 placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-colors`;

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Helmet>
        <title>{suggestTitle}</title>
        <meta name="description" content={suggestDesc} />
        <link rel="canonical" href="https://www.neutralenachrichten.com/suggest" />
        <meta property="og:title" content={suggestTitle} />
        <meta property="og:description" content={suggestDesc} />
        <meta property="og:url" content="https://www.neutralenachrichten.com/suggest" />
      </Helmet>

      {/* ── Back ── */}
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
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
        <div className="bg-[#1a1a1a] dark:bg-[#0a0a0a] px-6 sm:px-10 py-8 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 font-serif font-black text-[120px] leading-none text-white/[0.03] select-none pointer-events-none">
            RSS
          </div>
          <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-white/35 mb-3">{lx.heroLabel}</p>
          <h1 className="font-serif font-black text-2xl sm:text-3xl text-white leading-tight mb-3 relative z-10">
            {lx.heroTitle}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-sans text-[9px] uppercase tracking-widest text-white/40">{lx.heroBadge}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x-2 divide-[#1a1a1a] dark:divide-gray-700 border-t-2 border-[#1a1a1a] dark:border-gray-700">
          {[
            { value: '18', label: lang === 'de' ? 'Aktuelle Quellen' : lang === 'ru' ? 'Текущих источников' : 'Current sources', accent: 'text-emerald-600' },
            { value: '5',  label: lang === 'de' ? 'Politische Lager' : lang === 'ru' ? 'Политических лагерей' : 'Political camps', accent: 'text-orange-500' },
            { value: 'RSS',label: lang === 'de' ? 'Abrufmethode' : lang === 'ru' ? 'Метод получения' : 'Fetch method', accent: 'text-sky-600' },
          ].map(({ value, label, accent }) => (
            <div key={label} className="px-5 py-4 flex flex-col gap-1 dark:bg-[#141414]">
              <span className={`font-serif font-black text-2xl ${accent}`}>{value}</span>
              <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MAIN CONTENT — form + sidebar
      ════════════════════════════════════════════════════════ */}
      <div className="grid sm:grid-cols-[1fr_280px] gap-6 items-start">

        {/* ── LEFT: Form ── */}
        <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
          <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-3">
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">
              {lang === 'de' ? 'Formular' : lang === 'ru' ? 'Форма' : 'Form'}
            </p>
          </div>

          {status === 'error' && (
            <div className="mx-6 mt-5 border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 flex items-center gap-2">
              <span className="font-serif font-bold text-rose-600 shrink-0">✕</span>
              <p className="font-sans text-[11px] text-rose-700 dark:text-rose-400">{lx.errorText}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-6 py-6 dark:bg-[#141414] space-y-6">

            {/* Name + Email — side by side */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{lx.nameLabel}</label>
                <input
                  type="text"
                  placeholder={lx.namePlaceholder}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputCls('name')}
                />
              </div>
              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{lx.emailLabel}</label>
                <input
                  type="email"
                  placeholder={lx.emailPlaceholder}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls('email')}
                />
              </div>
            </div>

            {/* URL */}
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{lx.urlLabel}</label>
              <input
                type="url"
                placeholder={lx.urlPlaceholder}
                value={url}
                onChange={e => setUrl(e.target.value)}
                className={inputCls('url')}
              />
              {errors.url && <p className="font-sans text-[10px] text-rose-500 mt-1.5">{errors.url}</p>}
            </div>

            {/* Spectrum — visual selector */}
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                {lx.spectrumLabel}
                <span className="ml-2 normal-case opacity-60">— {lx.spectrumSub}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECTRUM_OPTS.map(opt => {
                  const active = spectrum === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSpectrum(active ? '' : opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border-2 transition-colors font-sans text-[9px] font-bold uppercase tracking-widest ${
                        active
                          ? 'bg-[#1a1a1a] dark:bg-gray-700 border-[#1a1a1a] dark:border-gray-700 text-white'
                          : 'border-[#1a1a1a] dark:border-gray-600 text-[#1a1a1a] dark:text-[#f0ece4] hover:bg-[#f5f0e8] dark:hover:bg-[#1e1a14]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                      {opt.arrow} {opt.label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Why */}
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{lx.whyLabel}</label>
              <textarea
                placeholder={lx.whyPlaceholder}
                value={why}
                onChange={e => setWhy(e.target.value)}
                rows={4}
                className={`${inputCls('why')} resize-none leading-relaxed border-2 px-0 py-2`}
                style={{ borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
              />
              {errors.why && <p className="font-sans text-[10px] text-rose-500 mt-1.5">{errors.why}</p>}
            </div>

            {/* GDPR */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setGdpr(g => !g)}
                  className={`mt-0.5 w-4 h-4 shrink-0 border-2 flex items-center justify-center transition-colors ${
                    gdpr
                      ? 'bg-[#1a1a1a] dark:bg-gray-600 border-[#1a1a1a] dark:border-gray-600'
                      : errors.gdpr
                      ? 'border-rose-500'
                      : 'border-[#1a1a1a] dark:border-gray-600 hover:bg-[#f5f0e8] dark:hover:bg-[#1e1a14]'
                  }`}
                >
                  {gdpr && <span className="text-white text-[9px] leading-none font-bold">✓</span>}
                </button>
                <span className="font-serif text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{lx.gdprText}</span>
              </label>
              {errors.gdpr && <p className="font-sans text-[10px] text-rose-500 mt-1.5 ml-7">{errors.gdpr}</p>}
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center gap-4">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="font-sans text-[10px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-700 text-white px-8 py-3 hover:bg-rose-600 dark:hover:bg-rose-600 transition-colors duration-200 disabled:opacity-40"
              >
                {status === 'loading' ? '…' : `↗ ${lx.submitBtn}`}
              </button>
              {Object.keys(errors).length > 0 && (
                <p className="font-sans text-[10px] uppercase tracking-widest text-rose-500">{lx.required}</p>
              )}
            </div>

          </form>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-4">

          {/* Criteria */}
          <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
            <div className="bg-[#1a1a1a] dark:bg-gray-900 px-5 py-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{lx.sideTitle}</p>
            </div>
            <div className="dark:bg-[#141414] divide-y divide-[#e0d8cf] dark:divide-gray-800">
              {lx.sideItems.map(item => (
                <div key={item.title} className="px-5 py-3.5 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-[10px] text-gray-300 dark:text-gray-600 shrink-0">{item.icon}</span>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4]">{item.title}</p>
                  </div>
                  <p className="font-serif text-[11px] text-gray-400 dark:text-gray-500 leading-snug pl-5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Current sources */}
          <div className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
            <div className="bg-[#1a1a1a] dark:bg-gray-900 px-5 py-3 flex items-center justify-between">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{lx.currentLabel}</p>
              <span className="font-sans text-[9px] text-white/40">{lx.currentItems.length}</span>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-1.5 dark:bg-[#141414]">
              {lx.currentItems.map(src => (
                <span
                  key={src}
                  className="font-sans text-[9px] uppercase tracking-wider px-2 py-1 border border-[#e0d8cf] dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-white dark:bg-[#1a1a1a]"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>

          {/* Methodology link */}
          <Link
            to="/methodology"
            className="group flex items-center justify-between px-5 py-4 border-2 border-[#1a1a1a] dark:border-gray-700 dark:bg-[#141414] hover:bg-[#1a1a1a] dark:hover:bg-gray-800 transition-colors"
          >
            <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] dark:text-[#f0ece4] group-hover:text-white transition-colors">
              {lang === 'de' ? 'Unsere Methodik →' : lang === 'ru' ? 'Наша методология →' : 'Our methodology →'}
            </p>
          </Link>

        </div>
      </div>
    </div>
  );
};
