import React, { useEffect, useState } from 'react';
import { Language } from '../translations';

interface PublicEntry {
  key:          string;
  topic:        string;
  lang:         string;
  search_count: number;
  last_searched: string;
  coverage:     Record<string, { percent: number }> | null;
}

interface Props {
  lang:     Language;
  onSelect: (topic: string, lang: Language) => void;
}

// ── Spectrum colours matching the brand ──────────────────────────────────────
const SPEC: Record<string, { bar: string; label: Record<string, string> }> = {
  left:         { bar: 'bg-rose-600',   label: { de: 'Links',         en: 'Left',          ru: 'Левые'        } },
  center_left:  { bar: 'bg-orange-400', label: { de: 'Mitte-Links',   en: 'Centre-Left',   ru: 'Центр-левые'  } },
  center:       { bar: 'bg-slate-400',  label: { de: 'Mitte',         en: 'Centre',        ru: 'Центр'        } },
  center_right: { bar: 'bg-sky-500',    label: { de: 'Mitte-Rechts',  en: 'Centre-Right',  ru: 'Центр-правые' } },
  right:        { bar: 'bg-blue-700',   label: { de: 'Rechts',        en: 'Right',         ru: 'Правые'       } },
};
const SPEC_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];

function relativeTime(iso: string, lang: Language): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return lang === 'ru' ? 'только что' : lang === 'de' ? 'gerade eben' : 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === 'ru' ? `${m} мин назад` : lang === 'de' ? `vor ${m} Min.` : `${m}m ago`;
  }
  const h = Math.floor(diff / 3600);
  return lang === 'ru' ? `${h} ч назад` : lang === 'de' ? `vor ${h} Std.` : `${h}h ago`;
}

function CoverageBar({ coverage }: { coverage: Record<string, { percent: number }> | null }) {
  if (!coverage) return null;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-none gap-[1px]">
      {SPEC_ORDER.map(k => {
        const pct = coverage[k]?.percent ?? 0;
        if (pct === 0) return null;
        return (
          <div
            key={k}
            className={`${SPEC[k]?.bar ?? 'bg-gray-300'} h-full transition-all`}
            style={{ flex: pct }}
            title={`${SPEC[k]?.label.de ?? k}: ${pct}%`}
          />
        );
      })}
    </div>
  );
}

const LABELS = {
  de: {
    title:    'Bereits analysiert',
    sub:      'Sofortergebnis — kein Warten',
    open:     'Öffnen →',
    searches: (n: number) => `${n}× gesucht`,
    empty:    'Noch keine Analysen gecacht.',
  },
  en: {
    title:    'Already analyzed',
    sub:      'Instant result — no waiting',
    open:     'Open →',
    searches: (n: number) => `${n}× searched`,
    empty:    'No cached analyses yet.',
  },
  ru: {
    title:    'Уже проанализировано',
    sub:      'Мгновенный результат — без ожидания',
    open:     'Открыть →',
    searches: (n: number) => `${n}× искали`,
    empty:    'Пока нет кэшированных анализов.',
  },
};

const API_BASE = import.meta.env.VITE_API_BASE || '';

export function PublicAnalyses({ lang, onSelect }: Props) {
  const [items, setItems]   = useState<PublicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const t = LABELS[lang] ?? LABELS.de;

  useEffect(() => {
    fetch(`${API_BASE}/api/public-analyses`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="flex gap-0.5 mb-1.5">
            <div className="w-3 h-[3px] bg-rose-600" />
            <div className="w-3 h-[3px] bg-orange-400" />
            <div className="w-3 h-[3px] bg-slate-400" />
            <div className="w-3 h-[3px] bg-sky-500" />
            <div className="w-3 h-[3px] bg-blue-700" />
          </div>
          <h2 className="font-serif font-black text-lg text-[#1a1a1a] leading-none">
            {t.title}
          </h2>
        </div>
        <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 pb-0.5">
          {t.sub}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1a1a1a]">
        {items.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.topic, item.lang as Language)}
            className="group bg-[#FFF8F0] hover:bg-[#f5ede0] transition-colors text-left px-4 py-3 flex flex-col gap-2"
          >
            {/* Top: lang badge + time */}
            <div className="flex items-center justify-between">
              <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400 border border-[#e0d8cf] px-1.5 py-0.5">
                {item.lang.toUpperCase()}
              </span>
              <span className="font-sans text-[9px] text-gray-300">
                {relativeTime(item.last_searched, lang)}
              </span>
            </div>

            {/* Topic */}
            <p className="font-serif font-bold text-sm text-[#1a1a1a] leading-snug line-clamp-2 group-hover:text-rose-700 transition-colors">
              {item.topic}
            </p>

            {/* Coverage bar */}
            <CoverageBar coverage={item.coverage} />

            {/* Bottom: search count + open */}
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-sans text-[9px] text-gray-300">
                {t.searches(item.search_count)}
              </span>
              <span className="font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity">
                {t.open}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
