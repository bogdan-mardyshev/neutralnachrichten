import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createT, type AdminLang, type TFn } from './adminTranslations';

const API_BASE = import.meta.env.VITE_API_URL || '';

/* Language for the admin panel only — it is mounted standalone and never gets
   the app's `lang` prop. Choice persists next to adminKey/adminTab. */
const I18nCtx = createContext<TFn>(createT('de'));
const useT = (): TFn => useContext(I18nCtx);

/* ────────────────────────────────────────────────────────────────────────────
   Admin dashboard.

   Reworked from a single flat ops page into tabs, because the panel had to
   answer two different questions with one layout: "is the server alive and what
   does it cost" (ops) and "is anyone using this, are they coming back, is the
   asset compounding" (traction). Those need different maths and different
   framing, so they now live in separate tabs.
   ──────────────────────────────────────────────────────────────────────────── */

type Tab = 'traction' | 'asset' | 'content' | 'quality' | 'ops' | 'users';

const TABS: Array<{ id: Tab; key: 'tab.traction' | 'tab.asset' | 'tab.content' | 'tab.quality' | 'tab.ops' | 'tab.users' }> = [
  { id: 'traction', key: 'tab.traction' },
  { id: 'asset',    key: 'tab.asset' },
  { id: 'content',  key: 'tab.content' },
  { id: 'quality',  key: 'tab.quality' },
  { id: 'ops',      key: 'tab.ops' },
  { id: 'users',    key: 'tab.users' },
];

interface AdminStats {
  server: {
    startedAt: string; uptime_hours: number; totalRequests: number;
    cacheHits: number; cacheMisses: number; cacheHitRate: string;
    errors: number; cachedItems: number; dbAvailable: boolean;
  };
  usage: {
    today: string; totalAnalysesAllTime: number; totalAnalysesToday: number;
    uniqueTopicsAllTime: number; activeIPsToday: number; freeDailyLimit: number;
  };
  costs: {
    estimatedTokensToday: number; estimatedCostToday: string;
    estimatedCostMonth: string; costPerAnalysis: string; note: string;
  };
  topTopics: Array<{ topic: string; count: number }>;
  topIPs: Array<{ ip: string; count: number; tokensEstimate: number }>;
  users: Array<{
    id: number; email: string; tier: string; daily_limit: number;
    created_at: string; last_login: string | null; search_count: string;
  }>;
  hourlyLast24h: Array<{ hour: string; count: string }>;
}

interface Traction {
  window: { days: number; excludedInternalHashes: number; includeInternal: boolean };
  yourIpHash: string;
  totals: { analyses: number; visitors: number; topics: number; degraded: number; cache_hits: number; first_seen: string } | null;
  usersTotal: number;
  growth: {
    analyses: { current: number; previous: number; growthPct: number | null };
    visitors: { current: number; previous: number; growthPct: number | null };
  };
  retention: {
    totalVisitors: number; returningVisitors: number; loyalVisitors: number;
    returningRate: number | null; loyalRate: number | null; avgActiveDays: number | null;
  };
  funnel: Array<{ key: string; label: string; value: number; pct: number | null }>;
  cohorts: Array<{ cohortWeek: string; size: number; cells: Array<{ offset: number; visitors: number | null; pct: number | null }> }>;
  series: {
    weekly: Array<{ bucket: string; count: number; visitors: number; users: number }>;
    daily: Array<{ bucket: string; count: number; visitors: number }>;
    newUsersWeekly: Array<{ bucket: string; count: number }>;
  };
  languages: Array<{ label: string; count: number; pct: number | null }>;
  asset: {
    articles: number; embeddings: number; nliVerdicts: number; outlets: number;
    articlesPerDay: number | null; embeddingCoverage: number | null; observedDays: number;
    bySpectrum: Record<string, number>;
    nliByLabel: Record<string, number>;
    dailyIngest: Array<{ bucket: string; count: number }>;
    feedbackTotal: number; topicsTotal: number; costPerAnalysis: number;
  } | null;
  topViewed: Array<{ topic: string; lang: string; search_count: number; view_count: number; last_searched: string }>;
}

/* ── Shared UI atoms ──────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string;
  accent?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const valueCls =
    accent === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
    accent === 'warn' ? 'text-amber-600 dark:text-amber-400' :
    accent === 'bad'  ? 'text-rose-600 dark:text-rose-400' :
    'text-[#1a1a1a] dark:text-[#f0ece4]';
  return (
    <div className="border-2 border-[#1a1a1a] dark:border-gray-700 p-4 bg-[#FFF8F0] dark:bg-[#141414]">
      <p className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 dark:text-gray-500 mb-1">{label}</p>
      <p className={`font-serif font-black text-3xl ${valueCls}`}>{value}</p>
      {sub && <p className="font-sans text-[10px] text-[#1a1a1a]/40 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="border-2 border-[#1a1a1a] dark:border-gray-700">
      <div className="bg-[#1a1a1a] dark:bg-gray-900 px-4 py-2 flex items-baseline justify-between gap-4">
        <h3 className="font-sans text-xs uppercase tracking-widest text-[#FFF8F0]">{title}</h3>
        {note && <span className="font-sans text-[9px] text-[#FFF8F0]/40 text-right">{note}</span>}
      </div>
      <div className="p-4 dark:bg-[#141414] bg-[#FFF8F0]">{children}</div>
    </div>
  );
}

/** "—" for null, so an unmeasured rate is never shown as 0. */
const nn = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

function GrowthBadge({ pct }: { pct: number | null }) {
  const t = useT();
  if (pct === null) {
    return <span className="font-sans text-[10px] text-[#1a1a1a]/40 dark:text-gray-600">{t('growth.noBase')}</span>;
  }
  const up = pct >= 0;
  return (
    <span className={`font-sans text-[10px] font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

/** Simple bar chart over a bucketed series. */
function BarSeries({ data, valueKey = 'count', labelFmt, height = 128 }: {
  data: Array<Record<string, any>>;
  valueKey?: string;
  labelFmt?: (bucket: string) => string;
  height?: number;
}) {
  const t = useT();
  const rows = data ?? [];
  if (rows.length === 0) {
    return <p className="font-serif text-sm text-[#1a1a1a]/40 dark:text-gray-600">{t('empty.series')}</p>;
  }
  const max = Math.max(...rows.map(r => Number(r[valueKey]) || 0), 1);
  const step = Math.ceil(rows.length / 8);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {rows.map((r, i) => {
        const v = Number(r[valueKey]) || 0;
        const label = labelFmt ? labelFmt(r.bucket) : new Date(r.bucket).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${label}: ${v}`}>
            <span className="font-sans text-[8px] text-[#1a1a1a]/40 dark:text-gray-600">{v > 0 ? v : ''}</span>
            <div className="w-full bg-[#1a1a1a] dark:bg-gray-400" style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
            <span className="font-sans text-[8px] text-[#1a1a1a]/40 dark:text-gray-600 whitespace-nowrap">
              {i % step === 0 ? label : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Traction tab ─────────────────────────────────────────────────────────── */

function InternalTrafficWarning({ data }: { data: Traction }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  if (data.window.excludedInternalHashes > 0 && !data.window.includeInternal) {
    return (
      <div className="border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <p className="font-sans text-[11px] text-emerald-800 dark:text-emerald-300">
          {t('internal.ok', { n: data.window.excludedInternalHashes })}
        </p>
      </div>
    );
  }
  return (
    <div className="border-2 border-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
      <p className="font-sans text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-widest">
        {t('internal.warnTitle')}
      </p>
      <p className="font-serif text-sm text-amber-900 dark:text-amber-200">
        {t('internal.warnBody')}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-sans text-[10px] uppercase tracking-widest text-amber-800 dark:text-amber-400">{t('internal.yourHash')}</span>
        <code className="font-mono text-xs bg-white dark:bg-[#1e1a14] border border-amber-400 px-2 py-1 text-amber-900 dark:text-amber-200">
          {data.yourIpHash}
        </code>
        <button
          onClick={() => { navigator.clipboard?.writeText(data.yourIpHash); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="font-sans text-[9px] uppercase tracking-widest border border-amber-600 text-amber-800 dark:text-amber-300 px-2 py-1 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          {copied ? t('action.copied') : t('action.copy')}
        </button>
        <span className="font-sans text-[10px] text-amber-700 dark:text-amber-400">
          {t('internal.hint')}
        </span>
      </div>
    </div>
  );
}

function CohortTable({ cohorts }: { cohorts: Traction['cohorts'] }) {
  const t = useT();
  if (!cohorts?.length) {
    return <p className="font-serif text-sm text-[#1a1a1a]/40 dark:text-gray-600">{t('empty.cohorts')}</p>;
  }
  const cellCls = (p: number | null) => {
    if (p === null) return 'bg-transparent text-[#1a1a1a]/20 dark:text-gray-700';
    if (p >= 40) return 'bg-emerald-600 text-white';
    if (p >= 20) return 'bg-emerald-400 text-[#1a1a1a]';
    if (p >= 10) return 'bg-amber-300 text-[#1a1a1a]';
    if (p > 0)   return 'bg-amber-100 text-[#1a1a1a]/70';
    return 'bg-[#e8e0d5] dark:bg-gray-800 text-[#1a1a1a]/30 dark:text-gray-600';
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-[#1a1a1a] dark:border-gray-700">
            <th className="text-left py-2 pr-3 font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a]/50 dark:text-gray-500">{t('cohort.header')}</th>
            <th className="text-left py-2 pr-3 font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a]/50 dark:text-gray-500">{t('cohort.size')}</th>
            {[0, 1, 2, 3, 4].map(o => (
              <th key={o} className="text-center py-2 px-1 font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a]/50 dark:text-gray-500">
                {o === 0 ? 'W0' : `+${o}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e0d8cf] dark:divide-gray-700">
          {cohorts.slice(0, 8).map(c => (
            <tr key={c.cohortWeek}>
              <td className="py-1.5 pr-3 font-serif text-[#1a1a1a] dark:text-[#f0ece4] whitespace-nowrap">
                {new Date(c.cohortWeek).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
              </td>
              <td className="py-1.5 pr-3 font-serif font-bold text-[#1a1a1a] dark:text-[#f0ece4]">{c.size}</td>
              {c.cells.map(cell => (
                <td key={cell.offset} className="py-1 px-1 text-center">
                  <div className={`py-1 font-sans text-[10px] font-bold ${cellCls(cell.pct)}`}>
                    {cell.pct === null ? '·' : `${cell.pct}%`}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-sans text-[9px] text-[#1a1a1a]/40 dark:text-gray-600 mt-2">
        {t('cohort.legend')}
      </p>
    </div>
  );
}

const FUNNEL_KEY: Record<string, 'funnel.analysed' | 'funnel.repeat' | 'funnel.returning' | 'funnel.registered'> = {
  analysed: 'funnel.analysed', repeat: 'funnel.repeat',
  returning: 'funnel.returning', registered: 'funnel.registered',
};

function TractionTab({ data }: { data: Traction }) {
  const t = useT();
  const tot = data.totals;
  return (
    <div className="space-y-6">
      <InternalTrafficWarning data={data} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t('traction.visitors')}
          value={tot?.visitors ?? 0}
          sub={t('traction.visitorsSub', { days: data.window.days })}
        />
        <StatCard
          label={t('traction.returning')}
          value={nn(data.retention.returningRate, '%')}
          sub={t('traction.returningSub', { n: data.retention.returningVisitors })}
          accent={data.retention.returningRate !== null && data.retention.returningRate >= 25 ? 'good' : 'neutral'}
        />
        <StatCard
          label={t('traction.analyses')}
          value={tot?.analyses ?? 0}
          sub={t('traction.analysesSub', { n: tot?.topics ?? 0 })}
        />
        <StatCard
          label={t('traction.users')}
          value={data.usersTotal}
          sub={t('traction.usersSub')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title={t('traction.analysesPerWeek')}
          note={t('traction.weekNote', { current: data.growth.analyses.current, previous: data.growth.analyses.previous })}
        >
          <div className="mb-2"><GrowthBadge pct={data.growth.analyses.growthPct} /></div>
          <BarSeries data={data.series.weekly} valueKey="count" />
        </Section>

        <Section
          title={t('traction.visitorsPerWeek')}
          note={t('traction.weekNote', { current: data.growth.visitors.current, previous: data.growth.visitors.previous })}
        >
          <div className="mb-2"><GrowthBadge pct={data.growth.visitors.growthPct} /></div>
          <BarSeries data={data.series.weekly} valueKey="visitors" />
        </Section>
      </div>

      <Section title={t('traction.analysesPerDay')}>
        <BarSeries data={data.series.daily} valueKey="count" />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title={t('traction.cohorts')} note={t('traction.cohortsNote')}>
          <CohortTable cohorts={data.cohorts} />
        </Section>

        <Section title={t('traction.funnel')} note={t('traction.funnelNote')}>
          <div className="space-y-3">
            {data.funnel.map(step => (
              <div key={step.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">
                    {FUNNEL_KEY[step.key] ? t(FUNNEL_KEY[step.key]) : step.label}
                  </span>
                  <span className="font-sans text-xs text-[#1a1a1a]/60 dark:text-gray-500">
                    <b className="font-serif text-base text-[#1a1a1a] dark:text-[#f0ece4]">{step.value}</b>
                    {step.pct !== null && <span className="ml-2">{step.pct}%</span>}
                  </span>
                </div>
                <div className="h-2 bg-[#e0d8cf] dark:bg-gray-700">
                  <div className="h-full bg-[#1a1a1a] dark:bg-gray-400" style={{ width: `${step.pct ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#e0d8cf] dark:border-gray-700 grid grid-cols-2 gap-3">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/40 dark:text-gray-600">{t('traction.avgDays')}</p>
              <p className="font-serif text-lg text-[#1a1a1a] dark:text-[#f0ece4]">{nn(data.retention.avgActiveDays)}</p>
            </div>
            <div>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/40 dark:text-gray-600">{t('traction.languages')}</p>
              <p className="font-serif text-lg text-[#1a1a1a] dark:text-[#f0ece4]">
                {data.languages.map(l => `${l.label} ${l.pct ?? 0}%`).join(' · ') || '—'}
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ── Data-asset tab ───────────────────────────────────────────────────────── */

const SPECTRUM_KEY: Record<string, 'spectrum.left' | 'spectrum.center_left' | 'spectrum.center' | 'spectrum.center_right' | 'spectrum.right'> = {
  left: 'spectrum.left', center_left: 'spectrum.center_left', center: 'spectrum.center',
  center_right: 'spectrum.center_right', right: 'spectrum.right',
};

function AssetTab({ data }: { data: Traction }) {
  const t = useT();
  const a = data.asset;
  if (!a) return <p className="font-serif text-[#1a1a1a]/50 dark:text-gray-500">{t('empty.asset')}</p>;
  const spectrumColor: Record<string, string> = {
    left: 'bg-rose-600', center_left: 'bg-orange-400', center: 'bg-slate-400',
    center_right: 'bg-sky-500', right: 'bg-blue-700',
  };
  const maxSpec = Math.max(...Object.values(a.bySpectrum || {}).map(Number), 1);

  return (
    <div className="space-y-6">
      <div className="border-2 border-[#1a1a1a] dark:border-gray-700 bg-[#1a1a1a] dark:bg-gray-900 p-4">
        <p className="font-serif text-[#FFF8F0] text-sm">{t('asset.banner')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('asset.articles')} value={a.articles.toLocaleString()} sub={t('asset.articlesSub', { n: a.outlets })} />
        <StatCard label={t('asset.embeddings')} value={a.embeddings.toLocaleString()} sub={t('asset.embeddingsSub', { pct: nn(a.embeddingCoverage, '%') })} />
        <StatCard label={t('asset.nli')} value={a.nliVerdicts.toLocaleString()} sub={t('asset.nliSub')} accent="good" />
        <StatCard label={t('asset.perDay')} value={nn(a.articlesPerDay)} sub={t('asset.perDaySub', { n: a.observedDays })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title={t('asset.growth')}>
          <BarSeries data={a.dailyIngest} valueKey="count" />
        </Section>

        <Section title={t('asset.bySpectrum')}>
          <div className="space-y-2">
            {Object.entries(a.bySpectrum || {}).map(([sp, n]) => (
              <div key={sp} className="flex items-center gap-3">
                <span className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 dark:text-gray-500 w-24 shrink-0">
                  {SPECTRUM_KEY[sp] ? t(SPECTRUM_KEY[sp]) : sp}
                </span>
                <div className="flex-1 h-3 bg-[#e0d8cf] dark:bg-gray-700">
                  <div className={`h-full ${spectrumColor[sp] ?? 'bg-[#1a1a1a]'}`} style={{ width: `${(Number(n) / maxSpec) * 100}%` }} />
                </div>
                <span className="font-serif text-sm font-bold text-[#1a1a1a] dark:text-[#f0ece4] w-14 text-right">
                  {Number(n).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('asset.nliEntail')} value={a.nliByLabel?.entailment ?? 0} accent="good" />
        <StatCard label={t('asset.nliContra')} value={a.nliByLabel?.contradiction ?? 0} accent="bad" sub={t('asset.nliContraSub')} />
        <StatCard label={t('asset.feedback')} value={a.feedbackTotal} sub={t('asset.feedbackSub')} />
        <StatCard label={t('asset.cost')} value={`$${a.costPerAnalysis}`} sub={t('asset.costSub')} accent="good" />
      </div>
    </div>
  );
}

/* ── Content tab ──────────────────────────────────────────────────────────── */

function ContentTab({ stats, data, feedback }: { stats: AdminStats; data: Traction | null; feedback: any }) {
  const t = useT();
  const topTopics = stats.topTopics ?? [];
  const maxCount = topTopics[0]?.count || 1;
  return (
    <div className="space-y-6">
      {feedback && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t('content.balanced')} value={feedback.up} sub={t('content.last7', { n: feedback.up7d })} accent="good" />
          <StatCard label={t('content.notBalanced')} value={feedback.down} sub={t('content.last7', { n: feedback.down7d })} accent={feedback.down > feedback.up ? 'bad' : 'neutral'} />
          <StatCard
            label={t('content.positiveRate')}
            value={(feedback.up + feedback.down) > 0 ? `${Math.round((feedback.up / (feedback.up + feedback.down)) * 100)}%` : '—'}
            sub={t('content.positiveRateSub')}
          />
          <StatCard label={t('content.topicsTotal')} value={data?.asset?.topicsTotal ?? stats.usage.uniqueTopicsAllTime} />
        </div>
      )}

      <Section title={t('content.topTopics', { n: topTopics.length })}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {topTopics.map((t2, i) => (
            <div key={t2.topic} className="flex items-center gap-3 py-2.5 border-b border-[#e0d8cf] dark:border-gray-700">
              <span className="font-serif font-black text-sm text-[#1a1a1a]/30 dark:text-gray-600 w-6 shrink-0">
                {i < 3 ? ['①', '②', '③'][i] : `${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] truncate capitalize">{t2.topic}</p>
                <div className="mt-1 h-1 bg-[#e0d8cf] dark:bg-gray-700">
                  <div className="h-full bg-[#1a1a1a] dark:bg-gray-400" style={{ width: `${Math.round((t2.count / maxCount) * 100)}%` }} />
                </div>
              </div>
              <span className="font-serif text-sm font-bold text-[#1a1a1a] dark:text-[#f0ece4] shrink-0">{t2.count}×</span>
            </div>
          ))}
        </div>
      </Section>

      {data?.topViewed && data.topViewed.length > 0 && (
        <Section title={t('content.mostRead')} note={t('content.mostReadNote')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#1a1a1a] dark:border-gray-700">
                {(['content.colTopic', 'content.colLang', 'content.colSearches', 'content.colViews', 'content.colLast'] as const).map(h => (
                  <th key={h} className="text-left py-2 pr-3 font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 dark:text-gray-500">{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0d8cf] dark:divide-gray-700">
              {data.topViewed.map((v, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3 font-serif text-[#1a1a1a] dark:text-[#f0ece4] capitalize">{v.topic}</td>
                  <td className="py-2 pr-3 font-sans text-xs uppercase text-[#1a1a1a]/50 dark:text-gray-500">{v.lang}</td>
                  <td className="py-2 pr-3 font-serif text-[#1a1a1a] dark:text-[#f0ece4]">{v.search_count}</td>
                  <td className="py-2 pr-3 font-serif font-bold text-[#1a1a1a] dark:text-[#f0ece4]">{v.view_count}</td>
                  <td className="py-2 font-sans text-xs text-[#1a1a1a]/40 dark:text-gray-600">
                    {v.last_searched ? new Date(v.last_searched).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

/* ── Quality tab ──────────────────────────────────────────────────────────── */

function QualityTab({ ops, data }: { ops: any; data: Traction | null }) {
  const t = useT();
  if (!ops?.process) return <p className="font-serif text-[#1a1a1a]/50 dark:text-gray-500">{t('empty.quality')}</p>;
  const p = ops.process;
  const degradedRate = data?.totals && data.totals.analyses > 0
    ? Math.round((data.totals.degraded / data.totals.analyses) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('quality.confidence')} value={p.confidence.avg ?? '—'} sub={t('quality.confidenceSub', { n: p.confidence.count })} />
        <StatCard label={t('quality.grounding')} value={p.grounding.avgRatio != null ? `${Math.round(p.grounding.avgRatio * 100)}%` : '—'} sub={t('quality.groundingSub')} />
        <StatCard label={t('quality.split')} value={`${p.analyses.corpus} / ${p.analyses.liveRss}`} sub={t('quality.splitSub', { n: p.analyses.errors })} />
        <StatCard
          label={t('quality.degraded')}
          value={nn(degradedRate, '%')}
          sub={t('quality.degradedSub', { n: data?.totals?.degraded ?? 0 })}
          accent={degradedRate !== null && degradedRate > 10 ? 'warn' : 'good'}
        />
      </div>

      <Section title={t('quality.distribution')} note={t('quality.sinceDeploy')}>
        <div className="flex gap-2 flex-wrap text-xs">
          {Object.entries(p.confidence.buckets as Record<string, number>).map(([b, n]) => (
            <span key={b} className={`px-3 py-1.5 font-sans ${b === '100' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#e8e0d5] dark:bg-[#252525] text-[#1a1a1a]/70 dark:text-gray-400'}`}>
              {b}: <b>{n}</b>
            </span>
          ))}
        </div>
      </Section>

      {ops.measuredFactuality?.length > 0 && (
        <Section title={t('quality.factuality')} note={t('quality.factualityNote')}>
          <div className="flex flex-wrap gap-2 text-xs">
            {ops.measuredFactuality.slice(0, 20).map((s: any) => (
              <span
                key={s.source_domain}
                className={`px-2 py-1 font-sans ${s.supportRate >= 80 ? 'bg-emerald-100 text-emerald-700' : s.supportRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}
                title={s.measured ? `deklariert: ${s.declared ?? '—'} · gemessen: ${s.measured}${s.diverges ? ' (Abweichung!)' : ''}` : `${s.n} Messungen`}
              >
                {s.source_domain}: <b>{s.supportRate}%</b> <span className="opacity-60">({s.n})</span>{s.diverges && <span className="ml-0.5">⚑</span>}
              </span>
            ))}
          </div>
          <p className="font-sans text-[9px] text-[#1a1a1a]/40 dark:text-gray-600 mt-3">
            {t('quality.factualityLegend')}
          </p>
        </Section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('quality.translations')} value={`${p.translations.ok} / ${p.translations.failed}`} />
        <StatCard label={t('quality.deep')} value={`${p.deepAnalysis.ok} / ${p.deepAnalysis.failed}`} />
        <StatCard label={t('quality.latency')} value={p.latency?.stream_total ? `${(p.latency.stream_total.avgMs / 1000).toFixed(1)}s` : '—'} sub={p.latency?.stream_total ? t('quality.latencySub', { n: (p.latency.stream_total.maxMs / 1000).toFixed(1) }) : undefined} />
        <StatCard label={t('quality.geminiCalls')} value={p.gemini.totalCalls} sub={`A:${p.gemini.analysis} D:${p.gemini.deep} T:${p.gemini.translate}`} />
      </div>
    </div>
  );
}

/* ── Ops tab ──────────────────────────────────────────────────────────────── */

function OpsTab({ stats, ops }: { stats: AdminStats; ops: any }) {
  const t = useT();
  const { server, usage, costs, hourlyLast24h, topIPs } = stats;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-3 py-1 border ${server.dbAvailable ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-amber-500 text-amber-700 bg-amber-50'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${server.dbAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {server.dbAvailable ? t('ops.dbOn') : t('ops.dbOff')}
        </span>
        <span className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-3 py-1 border border-sky-500 text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          {t('ops.uptime', { n: server.uptime_hours })}
        </span>
        {ops?.flags && (
          <span className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-3 py-1 border border-[#1a1a1a]/30 text-[#1a1a1a]/60 dark:text-gray-400 dark:border-gray-700">
            {ops.flags.corpusAnalysisEnabled ? 'Corpus ON' : 'Corpus OFF'} · Sentry {ops.flags.sentry ? 'ON' : 'OFF'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('ops.analysesToday')} value={usage.totalAnalysesToday} sub={usage.today} />
        <StatCard label={t('ops.cacheRate')} value={server.cacheHitRate} sub={t('ops.cacheRateSub', { hits: server.cacheHits, misses: server.cacheMisses })} />
        <StatCard label={t('ops.errors')} value={server.errors} accent={server.errors > 0 ? 'warn' : 'good'} sub={t('ops.errorsSub', { n: server.cachedItems })} />
        <StatCard label={t('ops.requests')} value={server.totalRequests.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label={t('ops.costToday')} value={costs.estimatedCostToday} sub={costs.note} />
        <StatCard label={t('ops.costMonth')} value={costs.estimatedCostMonth} sub={t('ops.costMonthSub')} />
        <StatCard label={t('ops.budget')} value={ops?.budget ? `${ops.budget.callsToday}/${ops.budget.dailyLimit}` : '—'} sub={ops?.budget ? t('ops.budgetSub', { n: ops.budget.remaining }) : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hourlyLast24h?.length > 0 && (
          <Section title={t('ops.last24h')}>
            <BarSeries
              data={hourlyLast24h.map(h => ({ bucket: h.hour, count: parseInt(h.count) || 0 }))}
              labelFmt={b => `${new Date(b).getUTCHours()}h`}
            />
          </Section>
        )}
        {topIPs?.length > 0 && (
          <Section title={t('ops.topIPs')} note={t('ops.topIPsNote', { n: usage.freeDailyLimit })}>
            <div className="divide-y divide-[#e0d8cf] dark:divide-gray-700">
              {topIPs.map((ip, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="font-mono text-sm text-[#1a1a1a] dark:text-[#f0ece4]">{ip.ip}</span>
                  <span className="font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">{ip.count}×</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {ops?.corpus && (
        <Section title={t('ops.feedHealth')} note={t('ops.feedHealthNote', { down: ops.corpus.feedsDown, total: ops.corpus.feeds.length })}>
          {ops.corpus.feedsDown > 0 ? (
            <table className="w-full text-xs">
              <tbody>
                {ops.corpus.feeds.filter((f: any) => f.status !== 'ok').map((f: any) => (
                  <tr key={f.feed_url} className="border-t border-[#e0d8cf] dark:border-gray-700">
                    <td className="py-1.5 font-serif text-[#1a1a1a] dark:text-[#f0ece4]">{f.source_name}</td>
                    <td className="py-1.5 font-sans text-[#1a1a1a]/50 dark:text-gray-500">{f.spectrum}</td>
                    <td className="py-1.5 text-rose-600 font-sans">{f.status} ({f.consecutive_failures}×)</td>
                    <td className="py-1.5 font-sans text-[#1a1a1a]/40 dark:text-gray-600">
                      {f.last_failure ? new Date(f.last_failure).toLocaleString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="font-serif text-sm text-emerald-700 dark:text-emerald-400">{t('ops.feedsOk')}</p>
          )}
        </Section>
      )}

      <Section title={t('ops.serverDetails')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
          <div>
            <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40 dark:text-gray-600">{t('ops.started')}</p>
            <p className="font-serif text-[#1a1a1a] dark:text-[#f0ece4]">{new Date(server.startedAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40 dark:text-gray-600">{t('ops.analysesTotal')}</p>
            <p className="font-serif text-[#1a1a1a] dark:text-[#f0ece4]">{usage.totalAnalysesAllTime.toLocaleString()}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40 dark:text-gray-600">{t('ops.cacheItems')}</p>
            <p className="font-serif text-[#1a1a1a] dark:text-[#f0ece4]">{server.cachedItems}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40 dark:text-gray-600">{t('ops.activeIPs')}</p>
            <p className="font-serif text-[#1a1a1a] dark:text-[#f0ece4]">{usage.activeIPsToday}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ── Users tab (unchanged behaviour) ──────────────────────────────────────── */

interface UserRowProps { u: AdminStats['users'][0]; adminKey: string; onSaved: () => void; }

const UserRow: React.FC<UserRowProps> = ({ u, adminKey, onSaved }) => {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [tier, setTier] = useState(u.tier);
  const [limit, setLimit] = useState(String(u.daily_limit));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ tier, daily_limit: parseInt(limit) }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || t('users.error')); return; }
      setEditing(false);
      onSaved();
    } catch { setErr(t('users.netError')); }
    finally { setSaving(false); }
  }

  const tierCls = (t: string) =>
    t === 'pro' ? 'border-amber-500 text-amber-700 bg-amber-50' :
    t === 'enterprise' ? 'border-blue-500 text-blue-700 bg-blue-50' :
    'border-[#1a1a1a]/20 text-[#1a1a1a]/60';

  const isUnlimited = parseInt(limit) === -1;

  return (
    <tr className="hover:bg-[#e8e0d5]/50 dark:hover:bg-gray-800/50 transition-colors align-top">
      <td className="py-2.5 pr-3 font-mono text-xs text-[#1a1a1a]/40 dark:text-gray-600 whitespace-nowrap">{u.id}</td>
      <td className="py-2.5 pr-3 font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">{u.email}</td>
      <td className="py-2.5 pr-3">
        {editing ? (
          <select value={tier} onChange={e => setTier(e.target.value)}
            className="font-sans text-[10px] border border-[#1a1a1a] dark:border-gray-600 px-1.5 py-0.5 bg-white dark:bg-[#1e1a14] dark:text-[#f0ece4]">
            <option value="free">free</option><option value="pro">pro</option><option value="enterprise">enterprise</option>
          </select>
        ) : (
          <span className={`font-sans text-[10px] uppercase tracking-widest px-2 py-0.5 border ${tierCls(u.tier)}`}>{u.tier}</span>
        )}
      </td>
      <td className="py-2.5 pr-3 font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4]">{u.search_count}</td>
      <td className="py-2.5 pr-3">
        {editing ? (
          <div className="space-y-1">
            <input type="number" value={limit} onChange={e => setLimit(e.target.value)}
              className="font-sans text-xs border border-[#1a1a1a] dark:border-gray-600 px-1.5 py-0.5 w-20 bg-white dark:bg-[#1e1a14] dark:text-[#f0ece4]" placeholder="10" />
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={isUnlimited} onChange={e => setLimit(e.target.checked ? '-1' : '10')} className="w-3 h-3" />
              <span className="font-sans text-[9px] text-sky-600 uppercase tracking-widest">{t('users.unlimited')}</span>
            </label>
          </div>
        ) : (
          <span className={`font-serif text-sm ${parseInt(String(u.daily_limit)) === -1 ? 'text-sky-600 font-bold' : 'text-[#1a1a1a]/60 dark:text-gray-400'}`}>
            {parseInt(String(u.daily_limit)) === -1 ? '∞' : u.daily_limit}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 font-sans text-xs text-[#1a1a1a]/50 dark:text-gray-600 whitespace-nowrap">
        {new Date(u.created_at).toLocaleDateString()}
      </td>
      <td className="py-2.5 pr-3 font-sans text-xs text-[#1a1a1a]/50 dark:text-gray-600 whitespace-nowrap">
        {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
      </td>
      <td className="py-2.5">
        {editing ? (
          <div className="flex gap-2 items-center">
            <button onClick={save} disabled={saving}
              className="font-sans text-[9px] uppercase tracking-widest border border-emerald-500 text-emerald-700 px-2 py-0.5 hover:bg-emerald-50 disabled:opacity-40">
              {saving ? '…' : t('users.save')}
            </button>
            <button onClick={() => { setEditing(false); setTier(u.tier); setLimit(String(u.daily_limit)); setErr(''); }}
              className="font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a]/40 hover:text-rose-600">×</button>
            {err && <span className="font-sans text-[9px] text-rose-600">{err}</span>}
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="font-sans text-[9px] uppercase tracking-widest border border-[#1a1a1a]/20 text-[#1a1a1a]/50 dark:text-gray-500 px-2 py-0.5 hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-colors">
            {t('users.edit')}
          </button>
        )}
      </td>
    </tr>
  );
};

function UsersTab({ users, adminKey, onRefresh }: { users: AdminStats['users']; adminKey: string; onRefresh: () => void }) {
  const t = useT();
  if (!users?.length) return <p className="font-serif text-[#1a1a1a]/50 dark:text-gray-500">{t('empty.users')}</p>;
  return (
    <Section title={t('users.title', { n: users.length })}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#1a1a1a] dark:border-gray-700">
              {['ID', 'E-Mail', 'Tier', t('users.colSearches'), t('users.colLimit'), t('users.colRegistered'), t('users.colLogin'), ''].map((h, i) => (
                <th key={i} className="text-left py-2 pr-3 font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 dark:text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e0d8cf] dark:divide-gray-700">
            {users.map(u => <UserRow key={u.id} u={u} adminKey={adminKey} onSaved={onRefresh} />)}
          </tbody>
        </table>
        <p className="font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a]/30 dark:text-gray-700 mt-3">
          {t('users.hint')}
        </p>
      </div>
    </Section>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('adminKey') || '');
  const [keyInput, setKeyInput] = useState('');
  const [lang, setLang] = useState<AdminLang>(() => (localStorage.getItem('adminLang') === 'en' ? 'en' : 'de'));
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('adminTab') as Tab) || 'traction');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ops, setOps] = useState<any | null>(null);
  const [traction, setTraction] = useState<Traction | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async (key: string, days: number) => {
    if (!key) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: { 'x-admin-key': key } });
      if (res.status === 403) {
        setError('__BADKEY__');
        setAdminKey('');
        localStorage.removeItem('adminKey');
        return;
      }
      setStats(await res.json());
      setLastRefresh(new Date());

      // Both are best-effort: an older server may not have these endpoints yet.
      fetch(`${API_BASE}/api/admin/metrics`, { headers: { 'x-admin-key': key } })
        .then(r => (r.ok ? r.json() : null)).then(setOps).catch(() => {});
      fetch(`${API_BASE}/api/admin/traction?days=${days}`, { headers: { 'x-admin-key': key } })
        .then(r => (r.ok ? r.json() : null)).then(setTraction).catch(() => {});
    } catch {
      setError('__NETWORK__');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    fetchAll(adminKey, windowDays);
    const iv = setInterval(() => fetchAll(adminKey, windowDays), 60000);
    return () => clearInterval(iv);
  }, [adminKey, windowDays, fetchAll]);

  useEffect(() => { localStorage.setItem('adminTab', tab); }, [tab]);
  useEffect(() => { localStorage.setItem('adminLang', lang); }, [lang]);

  const t = createT(lang);
  const LangToggle = () => (
    <div className="flex border border-[#FFF8F0]/20">
      {(['de', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1.5 font-sans text-[10px] uppercase tracking-widest transition-colors ${
            lang === l ? 'bg-[#FFF8F0] text-[#1a1a1a]' : 'text-[#FFF8F0]/50 hover:text-[#FFF8F0]'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );

  function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('adminKey', keyInput);
    setAdminKey(keyInput);
  }

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] dark:bg-[#0f0f0f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-[#1a1a1a] dark:bg-gray-900 px-6 py-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 mb-0.5">{t('app.brand')}</p>
              <h1 className="font-serif font-black text-2xl text-[#FFF8F0]">{t('login.title')}</h1>
            </div>
            <LangToggle />
          </div>
          <div className="h-1 flex">
            <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
            <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" /><div className="flex-1 bg-blue-700" />
          </div>
          <form onSubmit={handleKeySubmit} className="border-2 border-t-0 border-[#1a1a1a] dark:border-gray-700 p-6 space-y-4 bg-[#FFF8F0] dark:bg-[#141414]">
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60 dark:text-gray-500 mb-1">{t('login.key')}</label>
              <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="ADMIN_KEY"
                className="w-full border-2 border-[#1a1a1a] dark:border-gray-600 bg-white dark:bg-[#1e1a14] px-3 py-2.5 font-mono text-sm text-[#1a1a1a] dark:text-[#f0ece4] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]" />
            </div>
            {error && <p className="font-serif text-sm text-rose-600">{error === '__BADKEY__' ? t('error.badKey') : error === '__NETWORK__' ? t('error.network') : error}</p>}
            <button type="submit" className="w-full bg-[#1a1a1a] dark:bg-gray-700 text-[#FFF8F0] py-3 font-sans text-xs uppercase tracking-widest hover:bg-[#333] transition-colors">
              {t('login.submit')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] dark:bg-[#0f0f0f] flex items-center justify-center">
        <p className="font-serif text-[#1a1a1a]/50 dark:text-gray-500 animate-pulse">{t('state.loading')}</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] dark:bg-[#0f0f0f] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="font-serif text-rose-600 mb-4">{error === '__BADKEY__' ? t('error.badKey') : error === '__NETWORK__' ? t('error.network') : error}</p>
          <button onClick={() => { setAdminKey(''); setKeyInput(''); }}
            className="border-2 border-[#1a1a1a] dark:border-gray-600 dark:text-[#f0ece4] px-4 py-2 font-sans text-xs uppercase tracking-widest hover:bg-[#1a1a1a] hover:text-[#FFF8F0] transition-colors">
            {t('login.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <I18nCtx.Provider value={t}>
    <div className="min-h-screen bg-[#e8e0d5] dark:bg-[#0a0a0a]">
      <div className="bg-[#1a1a1a] dark:bg-[#0a0a0a] text-[#FFF8F0]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">{t('app.brand')}</p>
            <h1 className="font-serif font-black text-2xl">{t('app.title')}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(tab === 'traction' || tab === 'asset') && (
              <select
                value={windowDays}
                onChange={e => setWindowDays(parseInt(e.target.value))}
                className="bg-transparent border border-[#FFF8F0]/20 text-[#FFF8F0] px-2 py-1.5 font-sans text-[10px] uppercase tracking-widest"
              >
                <option className="text-[#1a1a1a]" value={30}>{t('range.30')}</option>
                <option className="text-[#1a1a1a]" value={90}>{t('range.90')}</option>
                <option className="text-[#1a1a1a]" value={180}>{t('range.180')}</option>
                <option className="text-[#1a1a1a]" value={365}>{t('range.365')}</option>
              </select>
            )}
            {loading && <span className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 animate-pulse">{t('state.refreshing')}</span>}
            {lastRefresh && <span className="font-sans text-[10px] text-[#FFF8F0]/40">{lastRefresh.toLocaleTimeString()}</span>}
            <LangToggle />
            <button onClick={() => fetchAll(adminKey, windowDays)}
              className="border border-[#FFF8F0]/20 px-3 py-1.5 font-sans text-[10px] uppercase tracking-widest hover:bg-[#FFF8F0]/10 transition-colors">
              {t('action.refresh')}
            </button>
            <button onClick={() => { setAdminKey(''); localStorage.removeItem('adminKey'); }}
              className="border border-rose-500/40 text-rose-400 px-3 py-1.5 font-sans text-[10px] uppercase tracking-widest hover:bg-rose-500/10 transition-colors">
              {t('action.logout')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-0 overflow-x-auto">
          {TABS.map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`px-4 py-2.5 font-sans text-[11px] uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                tab === tb.id
                  ? 'border-[#FFF8F0] text-[#FFF8F0]'
                  : 'border-transparent text-[#FFF8F0]/40 hover:text-[#FFF8F0]/70'
              }`}
            >
              {t(tb.key)}
            </button>
          ))}
        </div>

        <div className="h-0.5 flex">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" /><div className="flex-1 bg-blue-700" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'traction' && (traction
          ? <TractionTab data={traction} />
          : <p className="font-serif text-[#1a1a1a]/50 dark:text-gray-500">{t('loading.traction')}</p>)}

        {tab === 'asset' && (traction
          ? <AssetTab data={traction} />
          : <p className="font-serif text-[#1a1a1a]/50 dark:text-gray-500">{t('loading.asset')}</p>)}

        {tab === 'content' && <ContentTab stats={stats} data={traction} feedback={ops?.feedback} />}
        {tab === 'quality' && <QualityTab ops={ops} data={traction} />}
        {tab === 'ops' && <OpsTab stats={stats} ops={ops} />}
        {tab === 'users' && <UsersTab users={stats.users} adminKey={adminKey} onRefresh={() => fetchAll(adminKey, windowDays)} />}
      </div>
    </div>
    </I18nCtx.Provider>
  );
}
