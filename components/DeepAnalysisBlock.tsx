import React, { useState } from 'react';
import { DeepAnalysis, SpectrumKey, Sentiment } from '../types';
import { Language, translations } from '../translations';

interface DeepAnalysisBlockProps {
  data: DeepAnalysis;
  lang: Language;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const CheckCircleIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const SplitIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
  </svg>
);
const EyeOffIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);
const BarChartIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const SmileIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const TagIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);
const MicIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);
const ChevronDown = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// ── Spectrum config ───────────────────────────────────────────────────────────
const SPECTRUM_ORDER: SpectrumKey[] = ['left', 'center_left', 'center', 'center_right', 'right'];

const SPECTRUM_STYLE: Record<SpectrumKey, {
  label: string; bar: string; badge: string; tag: string; dot: string; text: string;
}> = {
  left:         { label: '←',  bar: 'bg-rose-500',   badge: 'bg-rose-100 text-rose-700',    tag: 'bg-rose-50 border-rose-200 text-rose-800',   dot: 'bg-rose-500',   text: 'text-rose-700'  },
  center_left:  { label: '↖',  bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', tag: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-400', text: 'text-orange-700' },
  center:       { label: '·',  bar: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-700',  tag: 'bg-slate-50 border-slate-200 text-slate-700',  dot: 'bg-slate-400',  text: 'text-slate-600' },
  center_right: { label: '↗',  bar: 'bg-sky-500',    badge: 'bg-sky-100 text-sky-700',      tag: 'bg-sky-50 border-sky-200 text-sky-800',      dot: 'bg-sky-500',    text: 'text-sky-700'   },
  right:        { label: '→',  bar: 'bg-blue-700',   badge: 'bg-blue-100 text-blue-800',    tag: 'bg-blue-50 border-blue-200 text-blue-800',   dot: 'bg-blue-700',   text: 'text-blue-700'  },
};

const onlyInColors: Record<string, string> = {
  left:         'bg-rose-50 text-rose-700 border-rose-200',
  center_left:  'bg-orange-50 text-orange-700 border-orange-200',
  center:       'bg-slate-50 text-slate-700 border-slate-200',
  center_right: 'bg-sky-50 text-sky-700 border-sky-200',
  right:        'bg-blue-50 text-blue-700 border-blue-200',
  none:         'bg-gray-50 text-gray-600 border-gray-200',
};

const divergingViews = [
  { key: 'left_view',         colorClass: 'bg-rose-50 border-rose-100',     textClass: 'text-rose-900',   labelClass: 'text-rose-400',   leaningKey: 'leaningLeft'        },
  { key: 'center_left_view',  colorClass: 'bg-orange-50 border-orange-100', textClass: 'text-orange-900', labelClass: 'text-orange-400', leaningKey: 'leaningCenterLeft'  },
  { key: 'center_view',       colorClass: 'bg-slate-50 border-slate-100',   textClass: 'text-slate-700',  labelClass: 'text-slate-400',  leaningKey: 'leaningCenter'      },
  { key: 'center_right_view', colorClass: 'bg-sky-50 border-sky-100',       textClass: 'text-sky-900',    labelClass: 'text-sky-400',    leaningKey: 'leaningCenterRight' },
  { key: 'right_view',        colorClass: 'bg-blue-50 border-blue-100',     textClass: 'text-blue-900',   labelClass: 'text-blue-400',   leaningKey: 'leaningRight'       },
] as const;

// ── Accordion wrapper ─────────────────────────────────────────────────────────
const Section: React.FC<{
  id: string;
  open: boolean;
  onToggle: () => void;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: React.ReactNode;
  hoverBg: string;
  children: React.ReactNode;
}> = ({ open, onToggle, iconBg, iconColor, icon, title, desc, badge, hoverBg, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-4 text-left ${hoverBg} transition-colors`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-8 h-8 rounded-full ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
          {icon}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">{title}</span>
            {badge}
          </div>
          <div className="text-xs text-gray-500">{desc}</div>
        </div>
      </div>
      <span className={`text-gray-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>
        <ChevronDown />
      </span>
    </button>
    {open && <div className="border-t border-gray-50">{children}</div>}
  </div>
);

const CountBadge: React.FC<{ n: number; color: string }> = ({ n, color }) => (
  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{n}</span>
);

// ── Sentiment section ─────────────────────────────────────────────────────────
const SENTIMENT_CONFIG: Record<Sentiment, { icon: string; bar: string; label: string; bg: string }> = {
  positive: { icon: '😊', bar: 'bg-emerald-500', label: 'sentimentPositive', bg: 'bg-emerald-50 text-emerald-700' },
  neutral:  { icon: '😐', bar: 'bg-slate-400',   label: 'sentimentNeutral',  bg: 'bg-slate-50 text-slate-600'    },
  negative: { icon: '😠', bar: 'bg-rose-500',    label: 'sentimentNegative', bg: 'bg-rose-50 text-rose-700'      },
};

// ── Coverage bar ──────────────────────────────────────────────────────────────
function maxWeek(cv: Record<SpectrumKey, { week: number; month: number }>) {
  return Math.max(1, ...SPECTRUM_ORDER.map(s => cv[s]?.week ?? 0));
}

// ── Main component ────────────────────────────────────────────────────────────
export const DeepAnalysisBlock: React.FC<DeepAnalysisBlockProps> = ({ data, lang }) => {
  const t = translations[lang];
  const da = t.deepAnalysis;
  type SectionId = 'facts' | 'diverging' | 'silenced' | 'coverage' | 'sentiment' | 'keywords' | 'experts';
  const [open, setOpen] = useState<SectionId>('facts');
  const toggle = (id: SectionId) => setOpen(prev => (prev === id ? ('' as SectionId) : id));

  const leaningLabel: Record<SpectrumKey, string> = {
    left:         t.leaningLeft,
    center_left:  t.leaningCenterLeft,
    center:       t.leaningCenter,
    center_right: t.leaningCenterRight,
    right:        t.leaningRight,
  };

  const hasKeywords       = !!data.keywords       && SPECTRUM_ORDER.some(s => (data.keywords![s]?.length ?? 0) > 0);
  const hasSentiment      = !!data.sentiment;
  const hasExperts        = !!data.experts_cited   && SPECTRUM_ORDER.some(s => (data.experts_cited![s]?.length ?? 0) > 0);
  const hasCoverageVolume = !!data.coverage_volume && SPECTRUM_ORDER.some(s => (data.coverage_volume![s]?.week ?? 0) > 0);

  const totalWeek = data.coverage_volume
    ? SPECTRUM_ORDER.reduce((acc, s) => acc + (data.coverage_volume![s]?.week ?? 0), 0)
    : 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-500 via-amber-400 to-red-500" />
        <h3 className="text-lg font-bold text-gray-900">{da.title}</h3>
      </div>

      {/* ── 1. SHARED FACTS ── */}
      <Section
        id="facts" open={open === 'facts'} onToggle={() => toggle('facts')}
        iconBg="bg-emerald-100" iconColor="text-emerald-600" icon={<CheckCircleIcon />}
        title={da.sharedFactsTitle} desc={da.sharedFactsDesc} hoverBg="hover:bg-emerald-50/50"
        badge={<CountBadge n={data.shared_facts.length} color="bg-emerald-100 text-emerald-700" />}
      >
        <div className="divide-y divide-gray-50">
          {data.shared_facts.map((fact, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 text-emerald-500 shrink-0"><CheckCircleIcon /></span>
              <p className="text-sm text-gray-700 leading-relaxed">{fact.claim}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. DIVERGING POINTS ── */}
      <Section
        id="diverging" open={open === 'diverging'} onToggle={() => toggle('diverging')}
        iconBg="bg-amber-100" iconColor="text-amber-600" icon={<SplitIcon />}
        title={da.divergingTitle} desc={da.divergingDesc} hoverBg="hover:bg-amber-50/50"
        badge={<CountBadge n={data.diverging_points.length} color="bg-amber-100 text-amber-700" />}
      >
        <div className="divide-y divide-gray-50">
          {data.diverging_points.map((point, i) => (
            <div key={i} className="px-4 py-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600">{point.topic}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {divergingViews.map(({ key, colorClass, textClass, labelClass, leaningKey }) => {
                  const text = (point as any)[key];
                  if (!text) return null;
                  return (
                    <div key={key} className={`${colorClass} border rounded-lg px-3 py-2`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${labelClass} mb-1`}>
                        {(t as any)[leaningKey]}
                      </div>
                      <p className={`text-xs ${textClass} leading-relaxed`}>{text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 3. SILENCED TOPICS ── */}
      <Section
        id="silenced" open={open === 'silenced'} onToggle={() => toggle('silenced')}
        iconBg="bg-red-100" iconColor="text-red-500" icon={<EyeOffIcon />}
        title={da.silencedTitle} desc={da.silencedDesc} hoverBg="hover:bg-red-50/50"
        badge={<CountBadge n={data.silenced_topics.length} color="bg-red-100 text-red-600" />}
      >
        <div className="divide-y divide-gray-50">
          {data.silenced_topics.map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-800">{item.topic}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 ${onlyInColors[item.only_in] || onlyInColors.none}`}>
                    {da.onlyIn[item.only_in as keyof typeof da.onlyIn] ?? da.onlyIn.none}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4. COVERAGE VOLUME ── */}
      {hasCoverageVolume && (
        <Section
          id="coverage" open={open === 'coverage'} onToggle={() => toggle('coverage')}
          iconBg="bg-violet-100" iconColor="text-violet-600" icon={<BarChartIcon />}
          title={da.coverageTitle} desc={da.coverageDesc} hoverBg="hover:bg-violet-50/50"
          badge={
            <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
              {totalWeek} {da.coverageArticles}
            </span>
          }
        >
          <div className="px-4 py-4 space-y-4">
            {/* Total week summary cards */}
            <div className="grid grid-cols-5 gap-2">
              {SPECTRUM_ORDER.map(s => {
                const cv = data.coverage_volume![s];
                const st = SPECTRUM_STYLE[s];
                return (
                  <div key={s} className="text-center">
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${st.text}`}>
                      {leaningLabel[s]}
                    </div>
                    <div className="text-xl font-black text-gray-900">{cv.week}</div>
                    <div className="text-[10px] text-gray-400">{da.coverageWeek}</div>
                    <div className="text-xs font-medium text-gray-500 mt-0.5">{cv.month} <span className="text-[10px] text-gray-400">{da.coverageMonth.split(' ')[1] ?? da.coverageMonth}</span></div>
                  </div>
                );
              })}
            </div>

            {/* Bar chart */}
            <div className="space-y-2">
              {SPECTRUM_ORDER.map(s => {
                const cv = data.coverage_volume![s];
                const pct = Math.round((cv.week / maxWeek(data.coverage_volume!)) * 100);
                const st = SPECTRUM_STYLE[s];
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                    <div className="w-24 shrink-0">
                      <span className={`text-[10px] font-semibold ${st.text}`}>{leaningLabel[s]}</span>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${st.bar} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right shrink-0">
                      {cv.week} / {cv.month}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 text-right">
              {da.coverageTotalWeek}: {totalWeek} · {da.coverageArticles} {da.coverageWeek} / {da.coverageMonth}
            </p>
          </div>
        </Section>
      )}

      {/* ── 5. SENTIMENT ── */}
      {hasSentiment && (
        <Section
          id="sentiment" open={open === 'sentiment'} onToggle={() => toggle('sentiment')}
          iconBg="bg-pink-100" iconColor="text-pink-500" icon={<SmileIcon />}
          title={da.sentimentTitle} desc={da.sentimentDesc} hoverBg="hover:bg-pink-50/50"
        >
          <div className="px-4 py-4 space-y-3">
            {/* Spectrum row */}
            <div className="grid grid-cols-5 gap-2">
              {SPECTRUM_ORDER.map(s => {
                const sent: Sentiment = (data.sentiment![s] as Sentiment) ?? 'neutral';
                const cfg = SENTIMENT_CONFIG[sent];
                const st = SPECTRUM_STYLE[s];
                return (
                  <div key={s} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${st.text}`}>
                      {leaningLabel[s]}
                    </span>
                    <span className="text-2xl leading-none">{cfg.icon}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg}`}>
                      {(da as any)[cfg.label]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Stacked bar */}
            <div className="mt-3">
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {SPECTRUM_ORDER.map(s => {
                  const sent: Sentiment = (data.sentiment![s] as Sentiment) ?? 'neutral';
                  const cfg = SENTIMENT_CONFIG[sent];
                  return (
                    <div
                      key={s}
                      className={`flex-1 ${cfg.bar} opacity-80`}
                      title={`${leaningLabel[s]}: ${(da as any)[cfg.label]}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 px-0.5">
                <span className="text-[9px] text-gray-400">{t.leaningLeft}</span>
                <span className="text-[9px] text-gray-400">{t.leaningRight}</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── 6. KEYWORDS / LINGUISTIC ANALYSIS ── */}
      {hasKeywords && (
        <Section
          id="keywords" open={open === 'keywords'} onToggle={() => toggle('keywords')}
          iconBg="bg-teal-100" iconColor="text-teal-600" icon={<TagIcon />}
          title={da.keywordsTitle} desc={da.keywordsDesc} hoverBg="hover:bg-teal-50/50"
        >
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {SPECTRUM_ORDER.map(s => {
                const words = data.keywords![s] ?? [];
                const st = SPECTRUM_STYLE[s];
                return (
                  <div key={s} className="space-y-2">
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${st.text}`}>
                      {leaningLabel[s]}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {words.map((w, i) => (
                        <span
                          key={i}
                          className={`text-[11px] font-medium border rounded-md px-2 py-0.5 ${st.tag}`}
                          style={{ fontSize: `${Math.max(10, 13 - i * 0.5)}px` }}
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

      {/* ── 7. EXPERT MAP ── */}
      {hasExperts && (
        <Section
          id="experts" open={open === 'experts'} onToggle={() => toggle('experts')}
          iconBg="bg-indigo-100" iconColor="text-indigo-600" icon={<MicIcon />}
          title={da.expertsTitle} desc={da.expertsDesc} hoverBg="hover:bg-indigo-50/50"
        >
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {SPECTRUM_ORDER.map(s => {
                const names = data.experts_cited![s] ?? [];
                const st = SPECTRUM_STYLE[s];
                return (
                  <div key={s} className="space-y-2">
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${st.text}`}>
                      {leaningLabel[s]}
                    </div>
                    {names.length === 0 ? (
                      <p className="text-[11px] text-gray-300 italic">{da.expertsNone}</p>
                    ) : (
                      <div className="space-y-1">
                        {names.map((name, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                            <span className="text-[12px] text-gray-700 font-medium leading-tight">{name}</span>
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
