import React from 'react';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

const SOURCES = {
  left: [
    { name: 'junge Welt', domain: 'jungewelt.de' },
    { name: 'die tageszeitung (taz)', domain: 'taz.de' },
    { name: 'neues deutschland', domain: 'nd-aktuell.de' },
    { name: 'der Freitag', domain: 'freitag.de' },
  ],
  center_left: [
    { name: 'Der Spiegel', domain: 'spiegel.de' },
    { name: 'Süddeutsche Zeitung', domain: 'sueddeutsche.de' },
    { name: 'Die Zeit', domain: 'zeit.de' },
    { name: 'Tagesschau / ARD', domain: 'tagesschau.de' },
    { name: 'ZDF', domain: 'zdf.de' },
    { name: 'Deutsche Welle', domain: 'dw.com' },
  ],
  center: [
    { name: 'Tagesspiegel', domain: 'tagesspiegel.de' },
    { name: 'Frankfurter Allgemeine Zeitung', domain: 'faz.net' },
    { name: 'Handelsblatt', domain: 'handelsblatt.com' },
    { name: 'Stern', domain: 'stern.de' },
    { name: 'NDR / BR / WDR / MDR', domain: 'ndr.de / br.de' },
  ],
  center_right: [
    { name: 'Welt', domain: 'welt.de' },
    { name: 'Focus', domain: 'focus.de' },
    { name: 'ntv', domain: 'n-tv.de' },
    { name: 'NIUS', domain: 'nius.de' },
    { name: 'Cicero', domain: 'cicero.de' },
  ],
  right: [
    { name: 'Bild', domain: 'bild.de' },
    { name: 'Junge Freiheit', domain: 'jungefreiheit.de' },
    { name: "Tichys Einblick", domain: 'tichyseinblick.de' },
    { name: 'Achse des Guten', domain: 'achgut.com' },
  ],
};

const SPECTRUM_CONFIG: Record<string, {
  label: Record<Language, string>;
  bar: string;
  badge: string;
  arrow: string;
}> = {
  left:         { label: { de: 'Links',       en: 'Left',         ru: 'Левые'         }, bar: 'bg-rose-500',   badge: 'bg-rose-50 border-rose-200 text-rose-700',     arrow: '←' },
  center_left:  { label: { de: 'Mitte-Links', en: 'Center-Left',  ru: 'Центр-Лево'    }, bar: 'bg-orange-400', badge: 'bg-orange-50 border-orange-200 text-orange-700', arrow: '↖' },
  center:       { label: { de: 'Mitte',       en: 'Center',       ru: 'Центр'         }, bar: 'bg-slate-400',  badge: 'bg-slate-50 border-slate-200 text-slate-700',   arrow: '·' },
  center_right: { label: { de: 'Mitte-Rechts',en: 'Center-Right', ru: 'Центр-Право'   }, bar: 'bg-sky-500',    badge: 'bg-sky-50 border-sky-200 text-sky-700',         arrow: '↗' },
  right:        { label: { de: 'Rechts',      en: 'Right',        ru: 'Правые'        }, bar: 'bg-blue-700',   badge: 'bg-blue-50 border-blue-200 text-blue-800',      arrow: '→' },
};

const SPECTRUM_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'] as const;

export const MethodologyPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const m = t.methodology;

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

        {/* Pipeline steps */}
        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          {[
            { step: '1', icon: '🔍', label: { de: 'Thema eingeben', en: 'Enter topic', ru: 'Введите тему' } },
            { step: '2', icon: '⚡', label: { de: 'Gemini analysiert 5 Spektren', en: 'Gemini analyses 5 spectra', ru: 'Gemini анализирует 5 лагерей' } },
            { step: '3', icon: '📊', label: { de: 'Tiefenanalyse + Visualisierung', en: 'Deep analysis + visualisation', ru: 'Глубокий анализ + визуализация' } },
          ].map(s => (
            <div key={s.step} className="bg-slate-50 rounded-xl p-4 flex items-start gap-3 border border-slate-100">
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
              <div>
                <span className="text-lg leading-none">{s.icon}</span>
                <p className="text-sm font-medium text-slate-700 mt-1">{s.label[lang]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sources — 5 spectrums */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-2">{m.sourcesTitle}</h2>
        {/* Spectrum gradient bar */}
        <div className="flex gap-0.5 mb-5 rounded-full overflow-hidden h-2">
          {SPECTRUM_ORDER.map(s => (
            <div key={s} className={`flex-1 ${SPECTRUM_CONFIG[s].bar}`} />
          ))}
        </div>
        <div className="space-y-3">
          {SPECTRUM_ORDER.map(s => {
            const cfg = SPECTRUM_CONFIG[s];
            return (
              <div key={s} className={`rounded-xl border p-4 ${cfg.badge}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-black text-lg">{cfg.arrow}</span>
                  <p className="font-bold text-sm uppercase tracking-wide">{cfg.label[lang]}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-1">
                  {SOURCES[s].map(src => (
                    <div key={src.domain} className="flex items-baseline gap-2">
                      <span className="font-medium text-sm">{src.name}</span>
                      <span className="text-xs opacity-50">{src.domain}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Classification */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{m.classifyTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{m.classifyBody}</p>
      </section>

      {/* Deep Analysis */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">{(m as any).deepTitle}</h2>
        <div className="space-y-2">
          {((m as any).deepItems as string[]).map((item: string, i: number) => {
            const icons = ['✅', '↕️', '🙈', '📊', '😐', '🔤', '🎙️'];
            return (
              <div key={i} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <span className="text-lg leading-none shrink-0 mt-0.5">{icons[i]}</span>
                <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trending */}
      <section className="mb-10 bg-slate-50 rounded-xl p-6 border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{(m as any).trendingTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{(m as any).trendingBody}</p>
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
