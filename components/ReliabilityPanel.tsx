import React from 'react';
import type { ReliabilityEnvelope, SpectrumKey } from '../types';

interface Props {
  reliability: ReliabilityEnvelope;
  lang: 'de' | 'en' | 'ru';
}

type Lang = Props['lang'];

const SPECTRUM_LABEL: Record<SpectrumKey, Record<Lang, string>> = {
  left:         { de: 'Links',        en: 'Left',          ru: 'Левые' },
  center_left:  { de: 'Mitte-Links',  en: 'Center-Left',   ru: 'Лево-центр' },
  center:       { de: 'Mitte',        en: 'Center',        ru: 'Центр' },
  center_right: { de: 'Mitte-Rechts', en: 'Center-Right',  ru: 'Право-центр' },
  right:        { de: 'Rechts',       en: 'Right',         ru: 'Правые' },
};

const T = {
  de: {
    title: 'Verlässlichkeit dieser Analyse',
    high: 'Hoch', medium: 'Mittel', low: 'Niedrig',
    confidence: 'Vertrauenswert',
    sourced: 'Quellen-verifiziert',
    sourcedHint: 'Artikel mit überprüfbarer Originalquelle',
    spectra: 'Lager abgedeckt',
    sources: 'Quellen',
    contradiction: '⚠️ Mindestens eine Aussage wird von ihrer Quelle nicht gestützt — mit Vorsicht lesen.',
    flagshipSilent: (camp: string) => `Leitmedien im Lager „${camp}" berichten nicht über dieses Thema — nur kleinere Titel.`,
    verifiedSilent: (camp: string) => `Verifiziertes Verschweigen: Im Lager „${camp}" berichtet niemand, obwohl alle Quellen erreichbar waren.`,
    unverifiable: (camp: string) => `Lager „${camp}" nicht bewertbar: mindestens eine Quelle war nicht erreichbar.`,
    flagshipTag: 'Leitmedien still', silentTag: 'Verschweigen', unknownTag: 'Nicht bewertbar',
    windowNote: (d: number, o: number) => `Datenbasis: Artikel der letzten ${d} Tage aus ${o} Medien.`,
    howTitle: 'Wie wird der Wert berechnet?',
    factors: { spectrumBreadth: 'Spektrumsbreite (25%)', grounding: 'Quellen-Verifizierung (15%)', claimSupport: 'Aussagen-Abdeckung (35%)', volume: 'Quellenvolumen (25%)' },
    methodologyNote: 'Berechnet aus Spektrumsbreite, Quellen-Verifizierung und Aussagen-Abdeckung.',
  },
  en: {
    title: 'Reliability of this analysis',
    high: 'High', medium: 'Medium', low: 'Low',
    confidence: 'Confidence',
    sourced: 'Source-verified',
    sourcedHint: 'Articles with a checkable original source',
    spectra: 'Camps covered',
    sources: 'Sources',
    contradiction: '⚠️ At least one statement is not supported by its source — read with care.',
    flagshipSilent: (camp: string) => `Flagship outlets in the "${camp}" camp aren’t covering this topic — only smaller titles.`,
    verifiedSilent: (camp: string) => `Verified silence: nobody in the "${camp}" camp reports this, though all their sources were reachable.`,
    unverifiable: (camp: string) => `"${camp}" camp not assessable: at least one source was unreachable.`,
    flagshipTag: 'Flagships silent', silentTag: 'Silenced', unknownTag: 'Not assessable',
    windowNote: (d: number, o: number) => `Data basis: articles from the last ${d} days across ${o} outlets.`,
    howTitle: 'How is this computed?',
    factors: { spectrumBreadth: 'Spectrum breadth (25%)', grounding: 'Source verification (15%)', claimSupport: 'Statement coverage (35%)', volume: 'Source volume (25%)' },
    methodologyNote: 'Computed from spectrum breadth, source verification and statement coverage.',
  },
  ru: {
    title: 'Надёжность этого анализа',
    high: 'Высокая', medium: 'Средняя', low: 'Низкая',
    confidence: 'Доверие',
    sourced: 'Проверено по источнику',
    sourcedHint: 'Статьи с проверяемым первоисточником',
    spectra: 'Лагерей охвачено',
    sources: 'Источников',
    contradiction: '⚠️ Хотя бы одно утверждение не подтверждается источником — читайте с осторожностью.',
    flagshipSilent: (camp: string) => `Ведущие СМИ лагеря «${camp}» не пишут на эту тему — только мелкие издания.`,
    verifiedSilent: (camp: string) => `Подтверждённое замалчивание: в лагере «${camp}» никто не пишет, хотя все источники были доступны.`,
    unverifiable: (camp: string) => `Лагерь «${camp}» не оценить: хотя бы один источник был недоступен.`,
    flagshipTag: 'Флагманы молчат', silentTag: 'Замалчивание', unknownTag: 'Не оценить',
    windowNote: (d: number, o: number) => `База данных: статьи за последние ${d} дней из ${o} изданий.`,
    howTitle: 'Как считается?',
    factors: { spectrumBreadth: 'Охват спектра (25%)', grounding: 'Проверка источников (15%)', claimSupport: 'Подкреплённость утверждений (35%)', volume: 'Объём источников (25%)' },
    methodologyNote: 'Рассчитано из охвата спектра, проверки источников и подкреплённости утверждений.',
  },
} as const;

const BAND_STYLE: Record<'high' | 'medium' | 'low', string> = {
  high:   'text-emerald-700 dark:text-emerald-400 border-emerald-500',
  medium: 'text-amber-700 dark:text-amber-400 border-amber-500',
  low:    'text-rose-700 dark:text-rose-400 border-rose-500',
};

const ringFor = (band: 'high' | 'medium' | 'low') =>
  band === 'high' ? 'bg-emerald-500' : band === 'medium' ? 'bg-amber-500' : 'bg-rose-500';

export const ReliabilityPanel: React.FC<Props> = ({ reliability, lang }) => {
  const t = T[lang] ?? T.de;
  const conf = reliability?.confidence;
  if (!conf) return null;

  const bandLabel = conf.band === 'high' ? t.high : conf.band === 'medium' ? t.medium : t.low;
  const grounding = reliability.grounding;
  const blind = reliability.blindspots;
  const coveredCount = reliability.coverage
    ? Object.values(reliability.coverage).filter((c: { sources?: number }) => (c?.sources ?? 0) > 0).length
    : undefined;

  const label = (sp: SpectrumKey) => SPECTRUM_LABEL[sp]?.[lang] ?? sp;

  return (
    <div className="border border-[#e0d8cf] dark:border-[#252525] bg-white dark:bg-[#1c1c1c] shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-6 pt-4">
        <div className={`w-1 h-4 ${ringFor(conf.band)}`} />
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
          {t.title}
        </p>
      </div>

      {/* Metrics row */}
      <div className="px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Confidence score */}
        <div className={`flex flex-col border-l-2 pl-3 ${BAND_STYLE[conf.band]}`}>
          <span className="font-serif text-3xl font-black leading-none">{conf.score}</span>
          <span className="font-sans text-[10px] uppercase tracking-wider mt-1">{t.confidence} · {bandLabel}</span>
        </div>

        {/* Grounding */}
        {grounding && grounding.total > 0 && (
          <div className="flex flex-col border-l-2 border-[#e0d8cf] dark:border-[#2d2d2d] pl-3" title={t.sourcedHint}>
            <span className="font-serif text-3xl font-black leading-none text-[#1a1a1a] dark:text-[#f0ece4]">
              {grounding.grounded}/{grounding.total}
            </span>
            <span className="font-sans text-[10px] uppercase tracking-wider mt-1 text-gray-500 dark:text-gray-400">{t.sourced}</span>
          </div>
        )}

        {/* Spectra covered */}
        {typeof coveredCount === 'number' && (
          <div className="flex flex-col border-l-2 border-[#e0d8cf] dark:border-[#2d2d2d] pl-3">
            <span className="font-serif text-3xl font-black leading-none text-[#1a1a1a] dark:text-[#f0ece4]">{coveredCount}/5</span>
            <span className="font-sans text-[10px] uppercase tracking-wider mt-1 text-gray-500 dark:text-gray-400">{t.spectra}</span>
          </div>
        )}

        {/* Source count */}
        {typeof reliability.sourceCount === 'number' && (
          <div className="flex flex-col border-l-2 border-[#e0d8cf] dark:border-[#2d2d2d] pl-3">
            <span className="font-serif text-3xl font-black leading-none text-[#1a1a1a] dark:text-[#f0ece4]">{reliability.sourceCount}</span>
            <span className="font-sans text-[10px] uppercase tracking-wider mt-1 text-gray-500 dark:text-gray-400">{t.sources}</span>
          </div>
        )}
      </div>

      {/* Contradiction warning */}
      {conf.penaltyApplied && (
        <div className="mx-4 sm:mx-6 mb-3 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 border-l-2 border-rose-500">
          <p className="font-sans text-xs text-rose-700 dark:text-rose-300">{t.contradiction}</p>
        </div>
      )}

      {/* Silence banners */}
      {blind && (blind.verifiedSilences.length > 0 || blind.flagshipSilences.length > 0 || blind.unverifiable.length > 0) && (
        <div className="px-4 sm:px-6 pb-4 space-y-2">
          {blind.verifiedSilences.map(sp => (
            <Banner key={`v-${sp}`} tone="red"   tag={t.silentTag}   text={t.verifiedSilent(label(sp))} />
          ))}
          {blind.flagshipSilences.map(sp => (
            <Banner key={`f-${sp}`} tone="amber" tag={t.flagshipTag} text={t.flagshipSilent(label(sp))} />
          ))}
          {blind.unverifiable.map(sp => (
            <Banner key={`u-${sp}`} tone="gray"  tag={t.unknownTag}  text={t.unverifiable(label(sp))} />
          ))}
        </div>
      )}

      {/* Coverage-window honesty badge (B2) + explainable score (D3) */}
      <div className="px-4 sm:px-6 pb-3 space-y-1.5">
        {reliability.coverageWindow && (
          <p className="font-sans text-[10px] text-gray-400 dark:text-gray-500">
            📅 {t.windowNote(reliability.coverageWindow.days, reliability.coverageWindow.outlets)}
          </p>
        )}
        <details className="group">
          <summary className="font-sans text-[10px] text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
            {t.howTitle} <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span>
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(t.factors) as Array<keyof typeof t.factors>).map(k => {
              const v = conf.factors?.[k as keyof typeof conf.factors];
              return (
                <div key={k} className="border border-[#e0d8cf] dark:border-[#2d2d2d] rounded px-2 py-1.5">
                  <div className="font-sans text-[9px] uppercase tracking-wider text-gray-400">{t.factors[k]}</div>
                  <div className="h-1.5 bg-gray-100 dark:bg-[#2a2a2a] rounded mt-1 overflow-hidden">
                    <div className={`h-full ${ringFor(conf.band)}`} style={{ width: `${Math.round(((v as number) ?? 0) * 100)}%` }} />
                  </div>
                  <div className="font-sans text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{v != null ? Math.round((v as number) * 100) : '—'}%</div>
                </div>
              );
            })}
          </div>
          <p className="font-sans text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">{t.methodologyNote}</p>
        </details>
      </div>
    </div>
  );
};

const TONE: Record<'red' | 'amber' | 'gray', string> = {
  red:   'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300',
  amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-800 dark:text-amber-300',
  gray:  'bg-gray-50 dark:bg-[#222] border-gray-400 text-gray-600 dark:text-gray-400',
};
const DOT: Record<'red' | 'amber' | 'gray', string> = { red: '🔴', amber: '🟡', gray: '⚪' };

const Banner: React.FC<{ tone: 'red' | 'amber' | 'gray'; tag: string; text: string }> = ({ tone, tag, text }) => (
  <div className={`flex items-start gap-2 px-3 py-2 border-l-2 ${TONE[tone]}`}>
    <span className="text-xs mt-0.5">{DOT[tone]}</span>
    <div>
      <span className="font-sans text-[9px] font-bold uppercase tracking-widest opacity-70">{tag}</span>
      <p className="font-sans text-xs leading-snug">{text}</p>
    </div>
  </div>
);
