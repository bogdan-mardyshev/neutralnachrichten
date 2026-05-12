import React, { useEffect, useState, useCallback } from 'react';
import { Language } from '../translations';

interface PublicEntry {
  topic_norm:   string;
  topic:        string;
  langs:        string[];
  search_count: number | string;
  view_count:   number | string;
  like_count:   number | string;
  user_liked:   boolean;
  last_searched: string;
  coverage:     Record<string, { percent: number }> | null;
  summary:      string | null;
  source_count: number | string | null;
}

interface Props {
  lang:          Language;
  onSelect:      (topic: string, lang: Language) => void;
  recentSearches?: string[];
  authToken?:    string | null;
}

// ── Spectrum ──────────────────────────────────────────────────────────────────
const SPEC_ORDER = ['left', 'center_left', 'center', 'center_right', 'right'];
const SPEC_LABEL: Record<string, Record<Language, string>> = {
  left:         { de: 'Links',        en: 'Left',         ru: 'Левые'       },
  center_left:  { de: 'Mitte-Links',  en: 'Center-left',  ru: 'Лев. центр'  },
  center:       { de: 'Mitte',        en: 'Center',       ru: 'Центр'       },
  center_right: { de: 'Mitte-Rechts', en: 'Center-right', ru: 'Пр. центр'   },
  right:        { de: 'Rechts',       en: 'Right',        ru: 'Правые'      },
};
const SPEC_BAR: Record<string, string> = {
  left: 'bg-rose-600', center_left: 'bg-orange-400',
  center: 'bg-slate-400', center_right: 'bg-sky-500', right: 'bg-blue-700',
};
const SPEC_TEXT: Record<string, string> = {
  left: 'text-rose-600', center_left: 'text-orange-500',
  center: 'text-slate-500', center_right: 'text-sky-600', right: 'text-blue-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso: string, lang: Language): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return lang === 'ru' ? 'только что' : lang === 'de' ? 'gerade' : 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === 'ru' ? `${m}м` : `${m}m`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return lang === 'ru' ? `${h}ч` : `${h}h`;
  }
  const d = Math.floor(diff / 86400);
  return lang === 'ru' ? `${d}д` : `${d}d`;
}

function fmt(n: number | string): string {
  const num = Number(n);
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

// ── Coverage bar ──────────────────────────────────────────────────────────────
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

// ── Coverage mini-legend ──────────────────────────────────────────────────────
function CoverageLegend({ coverage, lang }: { coverage: Record<string, { percent: number }> | null; lang: Language }) {
  if (!coverage) return null;
  const segments = SPEC_ORDER
    .map(k => ({ k, pct: coverage[k]?.percent ?? 0 }))
    .filter(s => s.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);
  if (!segments.length) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
      {segments.map(({ k, pct }) => (
        <span key={k} className={`font-sans text-[8px] uppercase tracking-wide flex items-center gap-0.5 ${SPEC_TEXT[k]}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${SPEC_BAR[k]}`} />
          {SPEC_LABEL[k][lang]} {pct}%
        </span>
      ))}
    </div>
  );
}

// ── Copy ──────────────────────────────────────────────────────────────────────
const L = {
  de: {
    analyzed:  'Bereits analysiert',
    instant:   'Sofortiger Zugriff',
    views:     'Aufrufe',
    sources:   (n: number) => `${n} Quellen`,
    likes:     'Likes',
    loginToLike: 'Anmelden um zu liken',
  },
  en: {
    analyzed:  'Already analyzed',
    instant:   'Instant access',
    views:     'views',
    sources:   (n: number) => `${n} sources`,
    likes:     'likes',
    loginToLike: 'Sign in to like',
  },
  ru: {
    analyzed:  'Уже проанализировано',
    instant:   'Мгновенный доступ',
    views:     'просмотров',
    sources:   (n: number) => `${n} источников`,
    likes:     'лайков',
    loginToLike: 'Войдите чтобы лайкнуть',
  },
};

const API_BASE = import.meta.env.VITE_API_BASE || '';

// ── Like button ───────────────────────────────────────────────────────────────
function LikeButton({
  topicNorm, liked, likeCount, authToken, lang,
  onToggle,
}: {
  topicNorm: string; liked: boolean; likeCount: number;
  authToken?: string | null; lang: Language;
  onToggle: (topicNorm: string, newLiked: boolean, newCount: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const t = L[lang] ?? L.de;

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authToken) { alert(t.loginToLike); return; }
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analyses/${encodeURIComponent(topicNorm)}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        onToggle(topicNorm, data.liked, data.like_count);
      }
    } finally {
      setLoading(false);
    }
  }, [topicNorm, authToken, loading, onToggle]);

  return (
    <button
      onClick={handleClick}
      title={!authToken ? t.loginToLike : undefined}
      className={`flex items-center gap-0.5 font-sans text-[9px] transition-colors select-none ${
        liked
          ? 'text-rose-500'
          : authToken
            ? 'text-gray-300 hover:text-rose-400'
            : 'text-gray-200 cursor-default'
      }`}
    >
      <span className={`text-[11px] leading-none ${loading ? 'opacity-50' : ''}`}>
        {liked ? '♥' : '♡'}
      </span>
      {likeCount > 0 && <span>{fmt(likeCount)}</span>}
    </button>
  );
}

// ── Single card ───────────────────────────────────────────────────────────────
function AnalysisCard({
  item, lang, recentTopics, authToken, onSelect, onLikeToggle,
}: {
  item: PublicEntry;
  lang: Language;
  recentTopics: Set<string>;
  authToken?: string | null;
  onSelect: (topic: string, lang: Language) => void;
  onLikeToggle: (topicNorm: string, liked: boolean, count: number) => void;
}) {
  const t = L[lang] ?? L.de;
  const isRecent  = recentTopics.has(item.topic.toLowerCase());
  const viewCount = Number(item.view_count ?? 0);
  const srcCount  = Number(item.source_count ?? 0);

  const bestLang = (item.langs.includes(lang)
    ? lang
    : item.langs.includes('de') ? 'de' : item.langs[0]) as Language;

  return (
    <button
      onClick={() => onSelect(item.topic, bestLang)}
      className="group w-full text-left px-3 py-3 hover:bg-[#f5ede0] transition-colors border-b border-[#e0d8cf] last:border-0"
    >
      {/* Spectrum strip */}
      <CoverageBar coverage={item.coverage} />

      {/* Topic */}
      <div className="mt-2 mb-1">
        <p className={`font-serif text-[13px] leading-snug line-clamp-2 transition-colors ${
          isRecent ? 'font-bold' : ''
        } text-[#1a1a1a] group-hover:text-rose-700`}>
          {isRecent && <span className="text-rose-400 mr-1 text-[10px]">↺</span>}
          {item.topic}
        </p>
      </div>

      {/* Summary */}
      {item.summary && (
        <p className="font-sans text-[10px] text-gray-400 line-clamp-2 leading-relaxed mb-1.5">
          {item.summary}{item.summary.length >= 150 ? '…' : ''}
        </p>
      )}

      {/* Coverage legend */}
      <CoverageLegend coverage={item.coverage} lang={lang} />

      {/* Bottom meta row */}
      <div className="flex items-center justify-between mt-2">
        {/* Left: lang badges */}
        <div className="flex gap-1 items-center">
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
          {srcCount > 0 && (
            <span className="font-sans text-[8px] text-gray-300 ml-0.5">
              · {t.sources(srcCount)}
            </span>
          )}
        </div>

        {/* Right: views + likes + time */}
        <div className="flex items-center gap-2">
          {viewCount > 0 && (
            <span className="font-sans text-[9px] text-gray-300 flex items-center gap-0.5">
              <span className="text-[9px]">👁</span> {fmt(viewCount)}
            </span>
          )}
          <LikeButton
            topicNorm={item.topic_norm}
            liked={item.user_liked}
            likeCount={Number(item.like_count ?? 0)}
            authToken={authToken}
            lang={lang}
            onToggle={onLikeToggle}
          />
          <span className="font-sans text-[9px] text-gray-300">
            {relativeTime(item.last_searched, lang)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PublicAnalyses({ lang, onSelect, recentSearches = [], authToken }: Props) {
  const [items, setItems]     = useState<PublicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const t = L[lang] ?? L.de;

  const recentTopics = new Set(recentSearches.map(s => s.toLowerCase()));

  useEffect(() => {
    fetch(`${API_BASE}/api/public-analyses`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authToken]);

  const handleLikeToggle = useCallback((topicNorm: string, liked: boolean, likeCount: number) => {
    setItems(prev => prev.map(it =>
      it.topic_norm === topicNorm ? { ...it, user_liked: liked, like_count: likeCount } : it
    ));
  }, []);

  // Sort: recent searches float to top, then by search_count
  const sorted = [...items].sort((a, b) => {
    const aR = recentTopics.has(a.topic.toLowerCase()) ? 1 : 0;
    const bR = recentTopics.has(b.topic.toLowerCase()) ? 1 : 0;
    if (aR !== bR) return bR - aR;
    return Number(b.search_count) - Number(a.search_count);
  });

  if (loading) return (
    <div className="w-full">
      <div className="h-4 bg-[#e0d8cf] animate-pulse rounded mb-3 w-36" />
      {[1,2,3].map(i => <div key={i} className="h-24 bg-[#e0d8cf] animate-pulse mb-px" />)}
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

      {/* Cards */}
      <div className="border border-[#1a1a1a]">
        {sorted.map(item => (
          <AnalysisCard
            key={item.topic_norm}
            item={item}
            lang={lang}
            recentTopics={recentTopics}
            authToken={authToken}
            onSelect={onSelect}
            onLikeToggle={handleLikeToggle}
          />
        ))}
      </div>
    </div>
  );
}
