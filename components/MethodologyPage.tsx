import React from 'react';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

const SOURCES = {
  left: [
    { name: 'die tageszeitung', domain: 'taz.de' },
    { name: 'neues deutschland', domain: 'nd-aktuell.de' },
    { name: 'junge Welt', domain: 'jungewelt.de' },
    { name: 'der Freitag', domain: 'freitag.de' },
  ],
  center: [
    { name: 'Der Spiegel', domain: 'spiegel.de' },
    { name: 'Süddeutsche Zeitung', domain: 'sueddeutsche.de' },
    { name: 'Die Zeit', domain: 'zeit.de' },
    { name: 'Tagesspiegel', domain: 'tagesspiegel.de' },
    { name: 'Tagesschau / ARD', domain: 'tagesschau.de' },
    { name: 'Deutsche Welle', domain: 'dw.com' },
    { name: 'Frankfurter Allgemeine Zeitung', domain: 'faz.net' },
    { name: 'Handelsblatt', domain: 'handelsblatt.com' },
    { name: 'Stern', domain: 'stern.de' },
    { name: 'NDR / BR / WDR / SWR / MDR', domain: 'ndr.de / br.de / wdr.de' },
    { name: 'ZDF', domain: 'zdf.de' },
  ],
  right: [
    { name: 'Welt', domain: 'welt.de' },
    { name: 'Bild', domain: 'bild.de' },
    { name: 'Focus', domain: 'focus.de' },
    { name: 'Junge Freiheit', domain: 'jungefreiheit.de' },
    { name: 'NIUS', domain: 'nius.de' },
    { name: 'Achse des Guten', domain: 'achgut.com' },
    { name: "Tichys Einblick", domain: 'tichyseinblick.de' },
    { name: 'Cicero', domain: 'cicero.de' },
  ],
};

const SPECTRUM_COLORS = {
  left: 'bg-red-50 border-red-200 text-red-700',
  center: 'bg-slate-50 border-slate-200 text-slate-700',
  right: 'bg-blue-50 border-blue-200 text-blue-700',
};

const SPECTRUM_LABELS: Record<Language, Record<string, string>> = {
  de: { left: 'Links / Progressiv', center: 'Mitte / Mainstream', right: 'Rechts / Konservativ' },
  en: { left: 'Left / Progressive', center: 'Center / Mainstream', right: 'Right / Conservative' },
  ru: { left: 'Левые / Прогрессивные', center: 'Центр / Мейнстрим', right: 'Правые / Консервативные' },
};

export const MethodologyPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const m = t.methodology;
  const labels = SPECTRUM_LABELS[lang];

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <Link to="/" className="text-slate-500 hover:text-slate-800 mb-8 flex items-center gap-2 text-sm">
        ← {t.backToHome}
      </Link>

      <h1 className="text-4xl font-bold text-slate-900 mb-10">{m.title}</h1>

      {/* How we work */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{m.howTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{m.howBody}</p>
      </section>

      {/* Sources */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-5">{m.sourcesTitle}</h2>
        <div className="space-y-4">
          {(['left', 'center', 'right'] as const).map((spectrum) => (
            <div key={spectrum} className={`rounded-xl border p-4 ${SPECTRUM_COLORS[spectrum]}`}>
              <p className="font-bold text-sm uppercase tracking-wide mb-3">{labels[spectrum]}</p>
              <div className="grid sm:grid-cols-2 gap-1">
                {SOURCES[spectrum].map((s) => (
                  <div key={s.domain} className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className="text-xs opacity-60">{s.domain}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Classification */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{m.classifyTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{m.classifyBody}</p>
      </section>

      {/* What we don't do */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{m.notTitle}</h2>
        <ul className="space-y-2">
          {m.notItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-600">
              <span className="text-slate-400 mt-1">✕</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Limitations */}
      <section className="mb-10 bg-amber-50 border border-amber-100 rounded-xl p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{m.limitsTitle}</h2>
        <ul className="space-y-2">
          {m.limitsItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-700 text-sm">
              <span className="text-amber-500 mt-0.5">⚠</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link to="/suggest" className="text-slate-600 hover:text-slate-900 font-medium">
          {m.suggestCta}
        </Link>
      </div>
    </div>
  );
};
