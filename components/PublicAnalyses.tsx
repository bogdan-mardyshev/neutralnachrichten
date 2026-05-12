import React, { useEffect, useState } from 'react';
import { Language } from '../translations';

interface PublicEntry {
  topic_norm:   string;
  topic:        string;
  langs:        string[];
  search_count: number | string;
  last_searched: string;
  coverage:     Record<string, { percent: number }> | null;
}

interface Props {
  lang:     Language;
  onSelect: (topic: string, lang: Language) => void;
  recentSearches?: string[]; // local recent topics to highlight
}

// ── Spectrum colours ──────────────────────────────────────────────────────────
const SPEC_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];
const SPEC_BAR: Record<string, string> = {
  left: 'bg-rose-600', center_left: 'bg-orange-400',
  center: 'bg-slate-400', center_right: 'bg-sky-500', right: 'bg-blue-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso: string, lang: Language): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return lang === 'ru' ? 'только что' : lang === 'de' ? 'gerade' : 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === 'ru' ? `${m}м` : lang === 'de' ? `${m}m` : `${m}m`;
  }
  const h = Math.floor(diff / 3600);
  return lang === 'ru' ? `${h}ч` : lang === 'de' ? `${h}h` : `${h}h`;
}

function CoverageBar({ coverage }: { coverage: Record<string, { percent: number }> | null }) {
  if (!coverage) return <div className="h-[3px] bg-[#e0d8cf] w-full" />;
  return (
    <div className="flex h-[3px] w-full overflow-hidden gap-px">
      {SPEC_ORDER.map(k => {
        const pct = coverage[k]?.percent ?? 0;
        if (!pct) return null;
        return <div key={k} className={`${SPEC_BAR[k]} h-full`} style={{ flex: pct }} />;
      })}
    </div>
  );
}

// ── Copy ──────────────────────────────────────────────────────────────────────
const L = {
  de: {
    analyzed: 'Bereits analysiert',
    instant:  'Sofortiger Zugriff',
    recent:   'Zuletzt gesucht',
    times:    (n: number) => `${n}×`,
  },
  en: {
    analyzed: 'Already analyzed',
    instant:  'Instant access',
    recent:   'Recently searched',
    times:    (n: number) => `${n}×`,
  },
  ru: {
    analyzed: 'Уже проанализировано',
    instant:  'Мгновенный доступ',
    recent:   'Недавние поиски',
    times:    (n: number) => `${n}×`,
  },
};

const API_BASE = import.meta.env.VITE_API_BASE || '';

// ── Single row ────────────────────────────────────────────────────────────────
function AnalysisRow({
  item, lang, recentTopics, onSelect,
}: {
  item: PublicEntry;
  lang: Language;
  recentTopics: Set<string>;
  onSelect: (topic: string, lang: Language) => void;
}) {
  const t = L[lang] ?? L.de;
  const isRecent = recentTopics.has(item.topic.toLowerCase());
  const count = Number(item.search_count);

  // Pick best lang to open: prefer current UI lang, then 'de', then first available
  const bestLang = (item.langs.includes(lang)
    ? lang
    : item.langs.includes('de')
      ? 'de'
      : item.langs[0]) as Language;

  return (
    <button
      onClick={() => onSelect(item.topic, bestLang)}
      className="group w-full text-left px-3 py-2.5 hover:bg-[#f5ede0] transition-colors border-b border-[#e0d8cf] last:border-0"
    >
      {/* Coverage strip */}
      <CoverageBar coverage={item.coverage} />

      <div className="mt-2 mb-1.5">
        <p className={`font-serif text-[13px] leading-snug line-clamp-2 transition-colors ${
          isRecent ? 'font-bold text-[#1a1a1a]' : 'text-[#1a1a1a]'
        } group-hover:text-rose-700`}>
          {item.topic}
        </p>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between">
        {/* Lang badges */}
        <div className="flex gap-1">
          {item.langs.map(l => (
            <span
              key={l}
              onClick={e => { e.stopPropagation(); onSelect(item.topic, l as Language); }}
              className={`font-sans text-[8px] uppercase tracking-widest px-1 py-0.5 border transition-colors hover:bg-[#1a1a1a] hover:text-white hover:border-[#1a1a1a] ${
                l === bestLang
                  ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                  : 'text-gray-400 border-[#e0d8cf]'
              }`}
            >
              {l}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isRecent && (
            <span className="font-sans text-[8px] uppercase tracking-widest text-rose-500">↺</span>
          )}
          <span className="font-sans text-[9px] text-gray-300">
            {t.times(count)} · {relativeTime(item.last_searched, lang)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PublicAnalyses({ lang, onSelect, recentSearches = [] }: Props) {
  const [items, setItems]     = useState<PublicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const t = L[lang] ?? L.de;

  const recentTopics = new Set(recentSearches.map(s => s.toLowerCase()));

  useEffect(() => {
    fetch(`${API_BASE}/api/public-analyses`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Sort: recent searches float to top, then by search_count
  const sorted = [...items].sort((a, b) => {
    const aR = recentTopics.has(a.topic.toLowerCase()) ? 1 : 0;
    const bR = recentTopics.has(b.topic.toLowerCase()) ? 1 : 0;
    if (aR !== bR) return bR - aR;
    return Number(b.search_count) - Number(a.search_count);
  });

  if (loading) return (
    <div className="w-64 shrink-0">
      <div className="h-4 bg-[#e0d8cf] animate-pulse rounded mb-2 w-32" />
      {[1,2,3,4].map(i => <div key={i} className="h-14 bg-[#e0d8cf] animate-pulse mb-px" />)}
    </div>
  );

  if (items.length === 0) return null;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex gap-0.5 mb-1">
            {['bg-rose-600','bg-orange-400','bg-slate-400','bg-sky-500','bg-blue-700'].map(c => (
              <div key={c} className={`w-2.5 h-[3px] ${c}`} />
            ))}
          </div>
          <h3 className="font-sans text-[10px] uppercase tracking-widest font-bold text-[#1a1a1a]">
            {t.analyzed}
          </h3>
        </div>
        <span className="font-sans text-[9px] uppercase tracking-widest text-gray-300">
          {t.instant}
        </span>
      </div>

      {/* List */}
      <div className="border border-[#1a1a1a]">
        {sorted.map(item => (
          <AnalysisRow
            key={item.topic_norm}
            item={item}
            lang={lang}
            recentTopics={recentTopics}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
