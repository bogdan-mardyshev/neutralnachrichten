import React, { useState, useRef } from 'react';
import { translations, Language } from '../translations';

interface Props {
  lang: Language;
  onSelect: (topic: string) => void;
}

interface Story {
  headline_de: string;
  headline_en: string;
  headline_ru: string;
  summary_de: string;
  summary_en: string;
  summary_ru: string;
  source: string;
  search_topic: string;
}

type CategoryKey = 'politics' | 'economy' | 'society' | 'defense' | 'environment' | 'international' | 'culture' | 'justice';

const CATEGORIES: CategoryKey[] = ['politics', 'economy', 'society', 'defense', 'environment', 'international', 'culture', 'justice'];

const CAT_STYLE: Record<CategoryKey, { dot: string; pill: string; pillActive: string }> = {
  politics:      { dot: 'bg-rose-500',    pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-rose-300 hover:text-rose-600',    pillActive: 'bg-rose-500 text-white border-rose-500' },
  economy:       { dot: 'bg-emerald-500', pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-600', pillActive: 'bg-emerald-500 text-white border-emerald-500' },
  society:       { dot: 'bg-violet-500',  pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600',  pillActive: 'bg-violet-500 text-white border-violet-500' },
  defense:       { dot: 'bg-slate-500',   pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-slate-400 hover:text-slate-700',    pillActive: 'bg-slate-700 text-white border-slate-700' },
  environment:   { dot: 'bg-green-500',   pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-600',    pillActive: 'bg-green-500 text-white border-green-500' },
  international: { dot: 'bg-blue-500',    pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600',      pillActive: 'bg-blue-500 text-white border-blue-500' },
  culture:       { dot: 'bg-amber-500',   pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600',    pillActive: 'bg-amber-400 text-white border-amber-400' },
  justice:       { dot: 'bg-orange-500',  pill: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600',  pillActive: 'bg-orange-500 text-white border-orange-500' },
};

// cache fetched results in-memory per session
const fetchedCache: Partial<Record<CategoryKey, Story[]>> = {};

export const CategoryBrowser: React.FC<Props> = ({ lang, onSelect }) => {
  const t = translations[lang];
  const cb = t.categoryBrowser;
  const cats = cb.categories as Record<string, string>;

  const [active, setActive] = useState<CategoryKey | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const headline = (s: Story) =>
    lang === 'en' ? s.headline_en : lang === 'ru' ? s.headline_ru : s.headline_de;
  const summary = (s: Story) =>
    lang === 'en' ? s.summary_en : lang === 'ru' ? s.summary_ru : s.summary_de;

  const handleCategoryClick = async (cat: CategoryKey) => {
    if (active === cat) {
      setActive(null);
      setStories([]);
      return;
    }

    setActive(cat);

    // Use in-session cache first
    if (fetchedCache[cat]) {
      setStories(fetchedCache[cat]!);
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      return;
    }

    setLoading(true);
    setStories([]);

    try {
      const res = await fetch(`/api/category-news?category=${cat}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('[CategoryBrowser] stories:', data.stories?.length);
      const list: Story[] = Array.isArray(data.stories) ? data.stories : [];
      fetchedCache[cat] = list;
      setStories(list);
    } catch (err) {
      console.error('[CategoryBrowser] fetch error:', err);
      setStories([]);
    } finally {
      setLoading(false);
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  };

  return (
    <div className="mt-6">
      {/* Category labels — newspaper style */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 shrink-0">
          {cb.label}
        </span>
        {CATEGORIES.map(cat => {
          const isActive = active === cat;
          const st = CAT_STYLE[cat];
          return (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`font-sans text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-all ${
                isActive
                  ? `${st.pillActive} border-transparent`
                  : 'border-gray-300 text-gray-600 hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${isActive ? 'bg-white/80' : st.dot}`} />
              {cats[cat]}
            </button>
          );
        })}
      </div>

      {/* Stories panel */}
      {active && (
        <div ref={panelRef} className="border-2 border-[#1a1a1a] overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-2 bg-[#1a1a1a] flex items-center justify-between">
            <span className="font-sans text-[10px] font-bold text-white uppercase tracking-widest">
              {cats[active]}
            </span>
            <button
              onClick={() => { setActive(null); setStories([]); }}
              className="font-sans text-white/50 hover:text-white text-base leading-none transition-colors"
            >
              ×
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="divide-y divide-[#e8e0d5]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3 items-start animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e0d8cf] mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-[#e8e0d5] rounded w-full" />
                    <div className="h-2.5 bg-[#e8e0d5] rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Story list */}
          {!loading && stories.length > 0 && (
            <div className="divide-y divide-[#e8e0d5]">
              {stories.map((story, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(story.search_topic)}
                  className="w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-[#f0e8dc] transition-colors group"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${CAT_STYLE[active].dot} mt-1.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-xs font-semibold text-[#1a1a1a] leading-snug line-clamp-2">
                      {headline(story)}
                    </p>
                    <p className="font-sans text-[10px] text-gray-400 leading-relaxed line-clamp-1 mt-0.5">
                      {summary(story)}
                    </p>
                    <span className="font-sans text-[10px] text-gray-300 mt-1 inline-block">{story.source}</span>
                  </div>
                  <span className="font-sans text-[10px] text-gray-300 group-hover:text-[#1a1a1a] mt-0.5 shrink-0 transition-colors">→</span>
                </button>
              ))}
            </div>
          )}

          {!loading && stories.length === 0 && (
            <p className="px-4 py-6 text-center font-sans text-xs text-gray-400">{cb.loading}</p>
          )}
        </div>
      )}
    </div>
  );
};
