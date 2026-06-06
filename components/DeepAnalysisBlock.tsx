import React, { useState } from 'react';
import { DeepAnalysis, SpectrumKey, Sentiment } from '../types';
import { Language, translations } from '../translations';

interface DeepAnalysisBlockProps {
  data: DeepAnalysis;
  lang: Language;
}

const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const SPECTRUM_STYLE: Record<SpectrumKey, { dot: string; text: string; bar: string; hex: string }> = {
  left:         { dot: 'bg-rose-600',   text: 'text-rose-700',   bar: 'bg-rose-600',   hex: '#e11d48' },
  center_left:  { dot: 'bg-orange-400', text: 'text-orange-700', bar: 'bg-orange-400', hex: '#fb923c' },
  center:       { dot: 'bg-slate-500',  text: 'text-slate-600',  bar: 'bg-slate-500',  hex: '#64748b' },
  center_right: { dot: 'bg-sky-500',    text: 'text-sky-700',    bar: 'bg-sky-500',    hex: '#0ea5e9' },
  right:        { dot: 'bg-blue-700',   text: 'text-blue-800',   bar: 'bg-blue-700',   hex: '#1d4ed8' },
};

const onlyInDot: Record<string, string> = {
  left: 'bg-rose-600', center_left: 'bg-orange-400', center: 'bg-slate-500',
  center_right: 'bg-sky-500', right: 'bg-blue-700', none: 'bg-gray-400',
};

const divergingViews = [
  { key: 'left_view',         leaningKey: 'leaningLeft',        citeKey: 'left',         borderHex: '#e11d48' },
  { key: 'center_left_view',  leaningKey: 'leaningCenterLeft',  citeKey: 'center_left',  borderHex: '#fb923c' },
  { key: 'center_view',       leaningKey: 'leaningCenter',      citeKey: 'center',       borderHex: '#64748b' },
  { key: 'center_right_view', leaningKey: 'leaningCenterRight', citeKey: 'center_right', borderHex: '#0ea5e9' },
  { key: 'right_view',        leaningKey: 'leaningRight',       citeKey: 'right',         borderHex: '#1d4ed8' },
] as const;

// Wave 1: fact-verification badge labels (lexical/NLI check against the corpus)
const VERIFY: Record<string, { de: string; en: string; ru: string; cls: string; icon: string }> = {
  supported:     { de: 'Belegt',      en: 'Verified',     ru: 'Подтверждено',    icon: '✓', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
  entailment:    { de: 'Belegt',      en: 'Verified',     ru: 'Подтверждено',    icon: '✓', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
  unsupported:   { de: 'Unbelegt',    en: 'Unverified',   ru: 'Не подтверждено', icon: '⚠', cls: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' },
  contradiction: { de: 'Widerspruch', en: 'Contradicted', ru: 'Противоречие',    icon: '✗', cls: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
};
const SOURCE_LABEL = { de: 'Quelle', en: 'Source', ru: 'Источник' } as const;

const SENTIMENT_CONFIG: Record<Sentiment, { icon: string; bar: string; label: string }> = {
  positive: { icon: '↑', bar: 'bg-emerald-500', label: 'sentimentPositive' },
  neutral:  { icon: '→', bar: 'bg-slate-400',   label: 'sentimentNeutral'  },
  negative: { icon: '↓', bar: 'bg-rose-500',    label: 'sentimentNegative' },
};

// ── Accordion row ─────────────────────────────────────────────────────────────
const Section: React.FC<{
  open: boolean;
  onToggle: () => void;
  label: string;     // short loud editorial tag e.g. "FAKTEN"
  title: string;
  desc: string;
  count?: number;
  accent: string;    // Tailwind text color
  accentBar: string; // Tailwind bg color
  children: React.ReactNode;
}> = ({ open, onToggle, label, title, desc, count, accent, accentBar, children }) => (
  <div className="border-b border-[#e0d8cf] dark:border-[#252525] last:border-0">
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${open ? 'bg-[#1a1a1a]' : 'hover:bg-[#f0e8dc] dark:hover:bg-[#1c1c1c]'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Loud editorial label */}
        <span className={`font-sans text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 shrink-0 transition-colors ${
          open ? `${accentBar} text-white` : `${accent} border border-current`
        }`}>
          {label}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`font-serif font-bold text-sm leading-tight transition-colors ${open ? 'text-white' : 'text-[#1a1a1a] dark:text-[#f0ece4]'}`}>
              {title}
            </span>
            {count !== undefined && (
              <span className={`font-sans text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center shrink-0 transition-colors ${
                open ? 'bg-white/20 text-white' : `${accentBar} text-white`
              }`}>
                {count}
              </span>
            )}
          </div>
          <span className={`font-sans text-[10px] uppercase tracking-wider transition-colors ${open ? 'text-white/40' : 'text-gray-400 dark:text-gray-500'}`}>
            {desc}
          </span>
        </div>
      </div>

      <span className={`font-sans text-lg leading-none transition-all duration-200 shrink-0 ml-3 ${open ? 'text-white rotate-180' : 'text-gray-400'}`}>
        ∨
      </span>
    </button>

    {open && (
      <div className="border-t border-[#e0d8cf] dark:border-[#252525] bg-[#FFF8F0] dark:bg-[#141414]">
        {children}
      </div>
    )}
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
export const DeepAnalysisBlock: React.FC<DeepAnalysisBlockProps> = ({ data, lang }) => {
  const t = translations[lang];
  const da = t.deepAnalysis;
  type SectionId = 'facts' | 'diverging' | 'silenced' | 'coverage' | 'sentiment' | 'keywords' | 'experts';
  const [open, setOpen] = useState<SectionId>('facts');
  const toggle = (id: SectionId) => setOpen(prev => (prev === id ? ('' as SectionId) : id));

  const leaningLabel: Record<SpectrumKey, string> = {
    left: t.leaningLeft, center_left: t.leaningCenterLeft, center: t.leaningCenter,
    center_right: t.leaningCenterRight, right: t.leaningRight,
  };

  const hasKeywords       = !!data.keywords       && SPECTRUM_ORDER.some(s => (data.keywords![s]?.length ?? 0) > 0);
  const hasSentiment      = !!data.sentiment;
  const hasExperts        = !!data.experts_cited   && SPECTRUM_ORDER.some(s => (data.experts_cited![s]?.length ?? 0) > 0);
  const hasCoverageVolume = !!data.coverage_volume && SPECTRUM_ORDER.some(s => (data.coverage_volume![s]?.week ?? 0) > 0);
  const totalWeek         = data.coverage_volume
    ? SPECTRUM_ORDER.reduce((acc, s) => acc + (data.coverage_volume![s]?.week ?? 0), 0) : 0;

  return (
    <div className="border-2 border-[#1a1a1a] dark:border-[#2d2d2d] overflow-hidden bg-[#FFF8F0] dark:bg-[#141414]">
      {/* Black title bar */}
      <div className="bg-[#1a1a1a] px-5 py-3">
        <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{da.title}</p>
      </div>

      {/* ── 1. SHARED FACTS ─── */}
      <Section
        open={open === 'facts'} onToggle={() => toggle('facts')}
        label={lang === 'ru' ? 'Факты' : 'Fakten'}
        title={da.sharedFactsTitle} desc={da.sharedFactsDesc}
        count={data.shared_facts.length}
        accent="text-emerald-600" accentBar="bg-emerald-500"
      >
        <div className="divide-y divide-[#e0d8cf] dark:divide-[#252525]">
          {data.shared_facts.map((fact, i) => {
            const v = fact._verification;
            const vMeta = v ? VERIFY[v.label] : null;
            return (
            <div key={i} className="flex items-start gap-4 px-5 py-3.5">
              <span className="font-sans text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0 mt-0.5 w-4">{i + 1}</span>
              <div className="flex-1">
                <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{fact.claim}</p>
                {vMeta && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className={`font-sans text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${vMeta.cls}`}>
                      {vMeta.icon} {vMeta[lang]}
                    </span>
                    {v?.evidence?.url && (
                      <a href={v.evidence.url} target="_blank" rel="noopener noreferrer"
                         className="font-sans text-[10px] text-rose-600 dark:text-rose-400 hover:underline">
                        {SOURCE_LABEL[lang]}: {v.evidence.source_name} ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </Section>

      {/* ── 2. DIVERGING POINTS ─── */}
      <Section
        open={open === 'diverging'} onToggle={() => toggle('diverging')}
        label={lang === 'ru' ? 'Расхождения' : 'Divergenz'}
        title={da.divergingTitle} desc={da.divergingDesc}
        count={data.diverging_points.length}
        accent="text-amber-600" accentBar="bg-amber-400"
      >
        <div className="divide-y divide-[#e0d8cf] dark:divide-[#252525]">
          {data.diverging_points.map((point, i) => (
            <div key={i} className="px-5 py-4 space-y-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a] dark:text-[#f0ece4] border-b border-[#1a1a1a] dark:border-[#2d2d2d] pb-1.5 mb-3">
                {point.topic}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {divergingViews.map(({ key, leaningKey, citeKey, borderHex }) => {
                  const text = (point as any)[key];
                  if (!text) return null;
                  const cite = point._citations?.[citeKey as SpectrumKey];
                  return (
                    <div key={key} className="border-l-2 pl-3 py-1" style={{ borderColor: borderHex }}>
                      <div className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                        {(t as any)[leaningKey]}
                      </div>
                      <p className="font-sans text-xs text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed">{text}</p>
                      {cite?.url && (
                        <a href={cite.url} target="_blank" rel="noopener noreferrer"
                           className="font-sans text-[9px] text-rose-600 dark:text-rose-400 hover:underline mt-1 inline-block">
                          {cite.source_name} ↗
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 3. SILENCED TOPICS ─── */}
      <Section
        open={open === 'silenced'} onToggle={() => toggle('silenced')}
        label={lang === 'ru' ? 'Молчание' : lang === 'en' ? 'Silence' : 'Blindspot'}
        title={da.silencedTitle} desc={da.silencedDesc}
        count={data.silenced_topics.length}
        accent="text-red-600" accentBar="bg-red-500"
      >
        <div className="divide-y divide-[#e0d8cf] dark:divide-[#252525]">
          {data.silenced_topics.map((item, i) => (
            <div key={i} className="flex items-start gap-4 px-5 py-3.5">
              <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${onlyInDot[item.only_in] ?? 'bg-gray-400'}`} />
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-serif text-sm font-semibold text-[#1a1a1a] dark:text-[#f0ece4]">{item.topic}</p>
                  <span className="font-sans text-[9px] font-bold uppercase tracking-wider border border-[#1a1a1a] dark:border-[#2d2d2d] px-1.5 py-0.5 text-[#1a1a1a] dark:text-[#f0ece4]">
                    {da.onlyIn[item.only_in as keyof typeof da.onlyIn] ?? da.onlyIn.none}
                  </span>
                </div>
                <p className="font-sans text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4. COVERAGE VOLUME ─── */}
      {hasCoverageVolume && (
        <Section
          open={open === 'coverage'} onToggle={() => toggle('coverage')}
          label={lang === 'ru' ? 'Объём' : 'Volumen'}
          title={da.coverageTitle} desc={da.coverageDesc}
          count={totalWeek}
          accent="text-violet-600" accentBar="bg-violet-500"
        >
          <div className="px-5 py-5 space-y-5">
            {/* Stacked bar */}
            <div>
              <div className="flex overflow-hidden h-2 gap-px mb-1.5">
                {SPECTRUM_ORDER.map(s => {
                  const cv = data.coverage_volume![s];
                  const pct = totalWeek > 0 ? (cv.week / totalWeek) * 100 : 0;
                  return <div key={s} className={`${SPECTRUM_STYLE[s].bar} transition-all duration-700`} style={{ width: `${pct}%` }} />;
                })}
              </div>
              <div className="flex justify-between font-sans text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
                <span>{t.leaningLeft}</span><span>{t.leaningCenter}</span><span>{t.leaningRight}</span>
              </div>
            </div>

            {/* Summary numbers — scrollable on mobile */}
            <div className="overflow-x-auto -mx-5 px-5">
              <div className="grid grid-cols-5 gap-2 border-t border-b border-[#e0d8cf] dark:border-[#252525] py-4 min-w-[320px]">
                {SPECTRUM_ORDER.map(s => {
                  const cv = data.coverage_volume![s];
                  const pct = totalWeek > 0 ? Math.round((cv.week / totalWeek) * 100) : 0;
                  return (
                    <div key={s} className="text-center">
                      <div className={`font-sans text-[9px] font-bold uppercase tracking-widest mb-1 ${SPECTRUM_STYLE[s].text}`}>
                        {leaningLabel[s]}
                      </div>
                      <div className="font-serif font-black text-2xl text-[#1a1a1a] dark:text-[#f0ece4]">{pct}%</div>
                      <div className="font-sans text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{cv.week} {da.coverageWeek}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row bars */}
            <div className="space-y-2.5">
              {SPECTRUM_ORDER.map(s => {
                const cv = data.coverage_volume![s];
                const pct = totalWeek > 0 ? Math.round((cv.week / totalWeek) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${SPECTRUM_STYLE[s].dot}`} />
                    <span className={`font-sans text-[10px] uppercase tracking-wider w-16 sm:w-24 shrink-0 ${SPECTRUM_STYLE[s].text}`}>
                      {leaningLabel[s]}
                    </span>
                    <div className="flex-1 bg-[#e8e0d5] dark:bg-[#252525] h-1.5 overflow-hidden">
                      <div className={`h-full ${SPECTRUM_STYLE[s].bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-sans text-xs font-bold text-[#1a1a1a] dark:text-[#f0ece4] w-8 sm:w-10 text-right shrink-0">{pct}%</span>
                    <span className="font-sans text-[10px] text-gray-400 dark:text-gray-500 w-10 sm:w-12 text-right shrink-0">{cv.week}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── 5. SENTIMENT ─── */}
      {hasSentiment && (
        <Section
          open={open === 'sentiment'} onToggle={() => toggle('sentiment')}
          label={lang === 'ru' ? 'Тональность' : 'Sentiment'}
          title={da.sentimentTitle} desc={da.sentimentDesc}
          accent="text-pink-600" accentBar="bg-pink-500"
        >
          <div className="px-5 py-5 space-y-4">
            <div className="overflow-x-auto -mx-5 px-5">
              <div className="grid grid-cols-5 gap-2 min-w-[300px]">
                {SPECTRUM_ORDER.map(s => {
                  const sent: Sentiment = (data.sentiment![s] as Sentiment) ?? 'neutral';
                  const cfg = SENTIMENT_CONFIG[sent];
                  return (
                    <div key={s} className="text-center border border-[#e0d8cf] dark:border-[#252525] py-3">
                      <div className={`font-sans text-[9px] font-bold uppercase tracking-widest mb-2 ${SPECTRUM_STYLE[s].text}`}>
                        {leaningLabel[s]}
                      </div>
                      <div className="font-serif font-bold text-2xl text-[#1a1a1a] dark:text-[#f0ece4] mb-1">{cfg.icon}</div>
                      <span className="font-sans text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {(da as any)[cfg.label]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Sentiment stacked bar */}
            <div className="flex h-2 gap-px overflow-hidden">
              {SPECTRUM_ORDER.map(s => {
                const sent: Sentiment = (data.sentiment![s] as Sentiment) ?? 'neutral';
                return <div key={s} className={`flex-1 ${SENTIMENT_CONFIG[sent].bar}`} />;
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── 6. KEYWORDS ─── */}
      {hasKeywords && (
        <Section
          open={open === 'keywords'} onToggle={() => toggle('keywords')}
          label={lang === 'ru' ? 'Слова' : 'Keywords'}
          title={da.keywordsTitle} desc={da.keywordsDesc}
          accent="text-teal-600" accentBar="bg-teal-500"
        >
          <div className="px-5 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
              {SPECTRUM_ORDER.map(s => {
                const words = data.keywords![s] ?? [];
                return (
                  <div key={s} className="space-y-2">
                    <div className={`font-sans text-[9px] font-bold uppercase tracking-widest border-b border-[#e0d8cf] dark:border-[#252525] pb-1 ${SPECTRUM_STYLE[s].text}`}>
                      {leaningLabel[s]}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {words.map((w, i) => (
                        <span
                          key={i}
                          className="font-sans text-[10px] border border-[#1a1a1a] dark:border-[#2d2d2d] px-2 py-0.5 text-[#1a1a1a] dark:text-[#f0ece4] hover:bg-[#1a1a1a] dark:hover:bg-[#f0ece4] hover:text-white dark:hover:text-[#1a1a1a] transition-colors cursor-default"
                          style={{ fontSize: `${Math.max(10, 12 - i * 0.4)}px` }}
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── 7. EXPERTS ─── */}
      {hasExperts && (
        <Section
          open={open === 'experts'} onToggle={() => toggle('experts')}
          label={lang === 'ru' ? 'Эксперты' : 'Experten'}
          title={da.expertsTitle} desc={da.expertsDesc}
          accent="text-indigo-600" accentBar="bg-indigo-500"
        >
          <div className="px-5 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
              {SPECTRUM_ORDER.map(s => {
                const names = data.experts_cited![s] ?? [];
                return (
                  <div key={s} className="space-y-2">
                    <div className={`font-sans text-[9px] font-bold uppercase tracking-widest border-b border-[#e0d8cf] dark:border-[#252525] pb-1 ${SPECTRUM_STYLE[s].text}`}>
                      {leaningLabel[s]}
                    </div>
                    {names.length === 0 ? (
                      <p className="font-sans text-[10px] text-gray-300 dark:text-gray-600 italic">{da.expertsNone}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {names.map((name, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SPECTRUM_STYLE[s].dot}`} />
                            <span className="font-sans text-xs text-[#1a1a1a] dark:text-[#f0ece4] leading-tight">{name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
};
