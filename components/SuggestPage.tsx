import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { translations, Language } from '../translations';

interface Props { lang: Language }

type Spectrum = 'left' | 'center' | 'right' | 'unsure' | '';

export const SuggestPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const s = t.suggest;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [spectrum, setSpectrum] = useState<Spectrum>('');
  const [why, setWhy] = useState('');
  const [gdpr, setGdpr] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!url.trim()) e.url = s.urlRequired;
    if (!why.trim()) e.why = s.whyRequired;
    if (!gdpr) e.gdpr = s.gdprRequired;
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

  if (status === 'success') {
    return (
      <div className="max-w-lg mx-auto py-24 px-4 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{s.successTitle}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{s.successBody}</p>
        <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200">
          <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
          {t.backToHome}
        </Link>
      </div>
    );
  }

  const inputCls = (field: string) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm text-slate-900 dark:text-[#f0ece4] outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-gray-500 ${
      errors[field] ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1e1a14]'
    }`;

  const suggestTitle = lang === 'de'
    ? 'Quelle vorschlagen – NeutralNachrichten'
    : lang === 'ru'
    ? 'Предложить источник – NeutralNachrichten'
    : 'Suggest a source – NeutralNachrichten';
  const suggestDesc = lang === 'de'
    ? 'Schlage eine neue Medienquelle für NeutralNachrichten vor. Wir analysieren ständig neue Quellen aus dem deutschen Medienspektrum.'
    : lang === 'ru'
    ? 'Предложите новый медиаисточник для NeutralNachrichten. Мы постоянно анализируем новые источники из немецкого медиаспектра.'
    : 'Suggest a new media source for NeutralNachrichten. We constantly analyse new sources from the German media spectrum.';

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <Helmet>
        <title>{suggestTitle}</title>
        <meta name="description" content={suggestDesc} />
        <link rel="canonical" href="https://www.neutralenachrichten.com/suggest" />
        <meta property="og:title" content={suggestTitle} />
        <meta property="og:description" content={suggestDesc} />
        <meta property="og:url" content="https://www.neutralenachrichten.com/suggest" />
      </Helmet>
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
        <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
        {t.backToHome}
      </Link>

      <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">{s.title}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">{s.subtitle}</p>

      {status === 'error' && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
          {s.errorText}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <input
            type="text"
            placeholder={s.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls('name')}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.emailLabel}</label>
          <input
            type="email"
            placeholder={s.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls('email')}
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.urlLabel}</label>
          <input
            type="url"
            placeholder={s.urlPlaceholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputCls('url')}
          />
          {errors.url && <p className="text-red-500 text-xs mt-1">{errors.url}</p>}
        </div>

        {/* Spectrum */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.spectrumLabel}</label>
          <select
            value={spectrum}
            onChange={(e) => setSpectrum(e.target.value as Spectrum)}
            className={inputCls('spectrum')}
          >
            <option value="">—</option>
            <option value="left">{s.spectrumLeft}</option>
            <option value="center">{s.spectrumCenter}</option>
            <option value="right">{s.spectrumRight}</option>
            <option value="unsure">{s.spectrumUnsure}</option>
          </select>
        </div>

        {/* Why */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{s.whyLabel}</label>
          <textarea
            placeholder={s.whyPlaceholder}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={4}
            className={inputCls('why') + ' resize-none'}
          />
          {errors.why && <p className="text-red-500 text-xs mt-1">{errors.why}</p>}
        </div>

        {/* GDPR */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={gdpr}
              onChange={(e) => setGdpr(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-slate-900 focus:ring-slate-400"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">{s.gdprText}</span>
          </label>
          {errors.gdpr && <p className="text-red-500 text-xs mt-1">{errors.gdpr}</p>}
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-slate-900 dark:bg-gray-700 text-white font-semibold py-3 rounded-lg hover:bg-slate-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? '...' : s.submitButton}
        </button>
      </form>
    </div>
  );
};
