import React from 'react';
import type { NewsAnalysisResult, SpectrumKey, RssArticle } from '../types';

interface Props { data: NewsAnalysisResult; lang: 'de' | 'en' | 'ru'; }
type Lang = Props['lang'];

const SP_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];
const SP_COLOR: Record<SpectrumKey, string> = {
  left: '#e11d48', center_left: '#fb923c', center: '#64748b', center_right: '#0ea5e9', right: '#1d4ed8',
};
const SP_LABEL: Record<SpectrumKey, Record<Lang, string>> = {
  left:         { de: 'Links',        en: 'Left',         ru: 'Левые' },
  center_left:  { de: 'M-Links',      en: 'C-Left',       ru: 'Лево-ц.' },
  center:       { de: 'Mitte',        en: 'Center',       ru: 'Центр' },
  center_right: { de: 'M-Rechts',     en: 'C-Right',      ru: 'Право-ц.' },
  right:        { de: 'Rechts',       en: 'Right',        ru: 'Правые' },
};
const T = {
  de: { reach: 'Abdeckung nach Reichweite', reachHint: 'Gewichtet nach Publikumsreichweite, nicht nur Artikelzahl',
        timeline: 'Berichterstattung über die Zeit', map: 'Quellen-Landkarte', mapY: 'Faktentreue', mapHint: 'Spektrum × Faktentreue · Punktgröße = Reichweite',
        heads: 'Dieselbe Story, fünf Schlagzeilen', high: 'Hoch', mixed: 'Gemischt', low: 'Niedrig', noData: 'Keine Daten' },
  en: { reach: 'Coverage by reach', reachHint: 'Weighted by audience reach, not just article count',
        timeline: 'Coverage over time', map: 'Source map', mapY: 'Factuality', mapHint: 'Spectrum × factuality · dot size = reach',
        heads: 'Same story, five headlines', high: 'High', mixed: 'Mixed', low: 'Low', noData: 'No data' },
  ru: { reach: 'Охват по аудитории', reachHint: 'Взвешено по охвату аудитории, а не по числу статей',
        timeline: 'Освещение во времени', map: 'Карта источников', mapY: 'Фактологичность', mapHint: 'Спектр × фактологичность · размер точки = охват',
        heads: 'Один сюжет, пять заголовков', high: 'Высокая', mixed: 'Смешанная', low: 'Низкая', noData: 'Нет данных' },
} as const;
const T2 = {
  de: { comp: 'Worauf der Bericht beruht', compHint: 'Quellen-Zusammensetzung — Transparenz der Auswahl', flagship: 'Leitmedien', standard: 'Standard', niche: 'Nische', factTitle: 'Faktentreue der Quellen',
        clusters: 'Unterthemen dieser Story', clustersHint: 'Automatisch gruppierte Teilstränge', solo: 'nur ein Lager', camps: 'Lager' },
  en: { comp: 'What this analysis is built on', compHint: 'Source composition — selection transparency', flagship: 'Flagship', standard: 'Standard', niche: 'Niche', factTitle: 'Source factuality',
        clusters: 'Sub-stories within this topic', clustersHint: 'Automatically grouped threads', solo: 'only one camp', camps: 'camps' },
  ru: { comp: 'На чём построен разбор', compHint: 'Состав источников — прозрачность выборки', flagship: 'Флагманы', standard: 'Стандартные', niche: 'Нишевые', factTitle: 'Фактологичность источников',
        clusters: 'Под-сюжеты этой темы', clustersHint: 'Автоматически сгруппированные нити', solo: 'только один лагерь', camps: 'лагерей' },
} as const;

/** Collect corpus articles per spectrum from _rss.spectra. */
function articlesBySpectrum(data: NewsAnalysisResult): Record<SpectrumKey, RssArticle[]> {
  const out = {} as Record<SpectrumKey, RssArticle[]>;
  for (const sp of SP_ORDER) out[sp] = (data._rss?.spectra?.[sp] as RssArticle[]) || [];
  return out;
}
const pubOf = (a: RssArticle) => a.pubDate || a.pub_date || null;

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="border border-[#e0d8cf] dark:border-[#252525] bg-white dark:bg-[#1c1c1c] p-4 sm:p-5">
    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{title}</p>
    {hint && <p className="font-sans text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 mb-3">{hint}</p>}
    {!hint && <div className="mb-3" />}
    {children}
  </div>
);

// ── 1. Reach-weighted balance ────────────────────────────────────────────────
const ReachBalance: React.FC<{ data: NewsAnalysisResult; t: typeof T[Lang]; lang: Lang }> = ({ data, t, lang }) => {
  const cov = data._reliability?.coverage;
  if (!cov) return null;
  const segs = SP_ORDER.map(sp => ({ sp, pct: cov[sp]?.percent ?? 0 })).filter(s => s.pct > 0);
  if (!segs.length) return null;
  return (
    <Card title={t.reach} hint={t.reachHint}>
      <div className="flex h-7 w-full overflow-hidden rounded">
        {segs.map(s => (
          <div key={s.sp} style={{ width: `${s.pct}%`, backgroundColor: SP_COLOR[s.sp] }}
               className="flex items-center justify-center" title={`${SP_LABEL[s.sp][lang]} ${s.pct}%`}>
            {s.pct >= 8 && <span className="text-[10px] font-bold text-white">{s.pct}%</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {segs.map(s => (
          <span key={s.sp} className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SP_COLOR[s.sp] }} />
            {SP_LABEL[s.sp][lang]} {s.pct}%
          </span>
        ))}
      </div>
    </Card>
  );
};

// ── 2. Coverage timeline (articles per day, stacked by camp) ──────────────────
const Timeline: React.FC<{ data: NewsAnalysisResult; t: typeof T[Lang] }> = ({ data, t }) => {
  const bySp = articlesBySpectrum(data);
  const dayMap = new Map<string, Record<SpectrumKey, number>>();
  for (const sp of SP_ORDER) {
    for (const a of bySp[sp]) {
      const p = pubOf(a); if (!p) continue;
      const day = String(p).slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, { left: 0, center_left: 0, center: 0, center_right: 0, right: 0 });
      dayMap.get(day)![sp]++;
    }
  }
  const days = [...dayMap.keys()].sort().slice(-14);
  if (days.length < 2) return null;
  const max = Math.max(...days.map(d => SP_ORDER.reduce((n, sp) => n + dayMap.get(d)![sp], 0)), 1);
  return (
    <Card title={t.timeline}>
      <div className="flex items-end gap-1 h-28">
        {days.map(d => {
          const counts = dayMap.get(d)!;
          const tot = SP_ORDER.reduce((n, sp) => n + counts[sp], 0);
          return (
            <div key={d} className="flex-1 flex flex-col justify-end items-center gap-px" title={`${d}: ${tot}`}>
              {SP_ORDER.map(sp => counts[sp] > 0 && (
                <div key={sp} style={{ height: `${(counts[sp] / max) * 100}%`, backgroundColor: SP_COLOR[sp] }} className="w-full min-h-[2px]" />
              ))}
              <span className="text-[8px] text-gray-400 mt-1 rotate-0">{d.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ── 3. Source map: spectrum (x) × factuality (y), dot size = reach ────────────
const SourceMap: React.FC<{ data: NewsAnalysisResult; t: typeof T[Lang]; lang: Lang }> = ({ data, t, lang }) => {
  const bySp = articlesBySpectrum(data);
  // distinct outlets → { domain, name, spectrum, factual, reach }
  const seen = new Map<string, { name: string; sp: SpectrumKey; factual: string; reach: number }>();
  for (const sp of SP_ORDER) {
    for (const a of bySp[sp]) {
      const dom = (a.source_domain || '').toLowerCase().replace(/^www\./, '');
      if (!dom || seen.has(dom)) continue;
      seen.set(dom, { name: a.source_name || dom, sp, factual: a._factual || 'mixed', reach: a._reachWeight || 1 });
    }
  }
  const outlets = [...seen.values()];
  if (outlets.length < 2) return null;
  const rows: Array<'high' | 'mixed' | 'low'> = ['high', 'mixed', 'low'];
  const rowLabel = { high: t.high, mixed: t.mixed, low: t.low };
  return (
    <Card title={t.map} hint={t.mapHint}>
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r} className="grid grid-cols-[52px_repeat(5,1fr)] gap-1 items-stretch">
            <div className="font-sans text-[9px] uppercase tracking-wider text-gray-400 flex items-center">{rowLabel[r]}</div>
            {SP_ORDER.map(sp => (
              <div key={sp} className="min-h-[34px] border border-dashed border-[#e7e1d6] dark:border-[#2a2a2a] rounded p-1 flex flex-wrap gap-1 content-start">
                {outlets.filter(o => o.sp === sp && o.factual === r).map(o => (
                  <span key={o.name}
                    className="text-[8px] font-medium px-1 py-0.5 rounded text-white truncate max-w-full"
                    style={{ backgroundColor: SP_COLOR[sp], opacity: 0.55 + Math.min(0.45, o.reach / 4) }}
                    title={`${o.name} · ${SP_LABEL[sp][lang]} · ${rowLabel[r]}`}>
                    {o.name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
        <div className="grid grid-cols-[52px_repeat(5,1fr)] gap-1 pt-1">
          <div />
          {SP_ORDER.map(sp => (
            <div key={sp} className="text-[8px] text-center uppercase tracking-wider" style={{ color: SP_COLOR[sp] }}>{SP_LABEL[sp][lang]}</div>
          ))}
        </div>
      </div>
    </Card>
  );
};

// ── 4. Headline comparison: one headline per camp ─────────────────────────────
const Headlines: React.FC<{ data: NewsAnalysisResult; t: typeof T[Lang]; lang: Lang }> = ({ data, t, lang }) => {
  const cards = SP_ORDER.map(sp => {
    const arr = data.news_spectrum?.[sp] || [];
    const a = arr.find(x => x.article_title && x.source_name !== 'Kein Artikel gefunden');
    return a ? { sp, title: a.article_title, source: a.source_name, url: a.article_url } : null;
  }).filter(Boolean) as Array<{ sp: SpectrumKey; title: string; source: string; url?: string | null }>;
  if (cards.length < 2) return null;
  return (
    <Card title={t.heads}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {cards.map(c => (
          <a key={c.sp} href={c.url || undefined} target="_blank" rel="noopener noreferrer"
             className="block border-t-2 pt-2" style={{ borderColor: SP_COLOR[c.sp] }}>
            <div className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: SP_COLOR[c.sp] }}>{SP_LABEL[c.sp][lang]} · {c.source}</div>
            <p className="font-serif text-xs text-[#1a1a1a] dark:text-[#f0ece4] leading-snug">{c.title}</p>
          </a>
        ))}
      </div>
    </Card>
  );
};

// ── 5. Source composition / selection self-audit (tier + factuality) ──────────
const FACT_COLOR: Record<string, string> = { high: '#0f9d6b', mixed: '#e0992a', low: '#e0445c' };
const TIER_COLOR: Record<string, string> = { flagship: '#11161e', standard: '#64748b', niche: '#b8b2a7' };

const Composition: React.FC<{ data: NewsAnalysisResult; t2: typeof T2[Lang]; t: typeof T[Lang] }> = ({ data, t2, t }) => {
  const bySp = articlesBySpectrum(data);
  const seen = new Map<string, { tier: string; factual: string }>();
  for (const sp of SP_ORDER) for (const a of bySp[sp]) {
    const dom = (a.source_domain || '').toLowerCase().replace(/^www\./, '');
    if (dom && !seen.has(dom)) seen.set(dom, { tier: a._tier || 'standard', factual: a._factual || 'mixed' });
  }
  const outlets = [...seen.values()];
  if (outlets.length < 2) return null;
  const total = outlets.length;
  const tierN = { flagship: 0, standard: 0, niche: 0 } as Record<string, number>;
  const factN = { high: 0, mixed: 0, low: 0 } as Record<string, number>;
  for (const o of outlets) { tierN[o.tier] = (tierN[o.tier] || 0) + 1; factN[o.factual] = (factN[o.factual] || 0) + 1; }

  const Bar: React.FC<{ segs: Array<{ n: number; color: string; label: string }> }> = ({ segs }) => (
    <>
      <div className="flex h-5 w-full overflow-hidden rounded">
        {segs.filter(s => s.n > 0).map((s, i) => (
          <div key={i} style={{ width: `${(s.n / total) * 100}%`, backgroundColor: s.color }}
               className="flex items-center justify-center" title={`${s.label}: ${s.n}`}>
            {s.n / total >= 0.12 && <span className="text-[9px] font-bold text-white">{s.n}</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {segs.filter(s => s.n > 0).map((s, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label} {s.n}
          </span>
        ))}
      </div>
    </>
  );

  return (
    <Card title={`${t2.comp} · ${total}`} hint={t2.compHint}>
      <div className="space-y-3">
        <div>
          <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-1">{t2.factTitle}</p>
          <Bar segs={[
            { n: factN.high, color: FACT_COLOR.high, label: t.high },
            { n: factN.mixed, color: FACT_COLOR.mixed, label: t.mixed },
            { n: factN.low, color: FACT_COLOR.low, label: t.low },
          ]} />
        </div>
        <div>
          <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-1">{t2.flagship} / {t2.standard} / {t2.niche}</p>
          <Bar segs={[
            { n: tierN.flagship, color: TIER_COLOR.flagship, label: t2.flagship },
            { n: tierN.standard, color: TIER_COLOR.standard, label: t2.standard },
            { n: tierN.niche, color: TIER_COLOR.niche, label: t2.niche },
          ]} />
        </div>
      </div>
    </Card>
  );
};

// ── 6. Sub-stories (clusters) ─────────────────────────────────────────────────
const SubStories: React.FC<{ data: NewsAnalysisResult; t2: typeof T2[Lang]; lang: Lang }> = ({ data, t2, lang }) => {
  const clusters = (data._reliability?.clusters || []).filter(c => c.size >= 2);
  if (clusters.length < 2) return null;
  return (
    <Card title={`${t2.clusters} · ${clusters.length}`} hint={t2.clustersHint}>
      <div className="space-y-2">
        {clusters.slice(0, 6).map(c => (
          <div key={c.id} className="border-l-2 pl-3 py-1"
               style={{ borderColor: c.soloCamp ? SP_COLOR[c.soloCamp] : '#94a3b8' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] capitalize">{c.label}</span>
              <span className="font-sans text-[10px] text-gray-400">{c.size} {lang === 'ru' ? 'ст.' : 'art.'}</span>
              {c.soloCamp && (
                <span className="font-sans text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: SP_COLOR[c.soloCamp] }}>
                  {SP_LABEL[c.soloCamp][lang]} · {t2.solo}
                </span>
              )}
            </div>
            {/* camp dots */}
            <div className="flex items-center gap-1 mt-1">
              {c.coveredCamps.map(sp => (
                <span key={sp} className="w-2 h-2 rounded-full" style={{ backgroundColor: SP_COLOR[sp] }} title={SP_LABEL[sp][lang]} />
              ))}
              <span className="font-sans text-[9px] text-gray-400 ml-1">{c.coveredCamps.length} {t2.camps}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const DeepInsights: React.FC<Props> = ({ data, lang }) => {
  const t = T[lang] ?? T.de;
  const t2 = T2[lang] ?? T2.de;
  // Only meaningful for the corpus path (needs _rss.spectra / _reliability)
  if (!data._rss?.spectra && !data._reliability) return null;
  return (
    <div className="space-y-3">
      <ReachBalance data={data} t={t} lang={lang} />
      <SubStories data={data} t2={t2} lang={lang} />
      <Composition data={data} t2={t2} t={t} />
      <Headlines data={data} t={t} lang={lang} />
      <Timeline data={data} t={t} />
      <SourceMap data={data} t={t} lang={lang} />
    </div>
  );
};
