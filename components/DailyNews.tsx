import React, { useEffect, useState } from 'react';
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
  category: string;
  source: string;
  search_topic: string;
}

interface DailyNewsData {
  date: string;
  stories: Story[];
}

const CATEGORY_DOTS: Record<string, string> = {
  politics:      'bg-rose-600',
  economy:       'bg-emerald-600',
  society:       'bg-violet-600',
  defense:       'bg-slate-500',
  environment:   'bg-green-600',
  international: 'bg-blue-600',
  culture:       'bg-amber-500',
  justice:       'bg-orange-600',
};

export const DailyNews: React.FC<Props> = ({ lang, onSelect }) => {
  const t = translations[lang];
  const dn = t.dailyNews;
  const cats = dn.categories as Record<string, string>;

  const [data, setData] = useState<DailyNewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/daily-news')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const headline = (s: Story) =>
    lang === 'en' ? s.headline_en : lang === 'ru' ? s.headline_ru : s.headline_de;

  return (
    <div className="border-2 border-[#1a1a1a] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b-2 border-[#1a1a1a] bg-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <h2 className="font-sans text-[10px] font-bold text-white uppercase tracking-widest">{dn.title}</h2>
        </div>
        <span className="font-sans text-[9px] text-white/40 uppercase tracking-wider">{dn.updated}</span>
      </div>

      {/* Stories */}
      <div className="divide-y divide-[#e8e0d5]">
        {loading && [...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-3 animate-pulse flex gap-3 items-start">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mt-1.5 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-[#e8e0d5] rounded w-full" />
              <div className="h-2.5 bg-[#e8e0d5] rounded w-3/4" />
            </div>
          </div>
        ))}

        {!loading && data?.stories?.map((story, i) => {
          const catDot   = CATEGORY_DOTS[story.category] ?? 'bg-gray-400';
          const catLabel = cats[story.category] ?? story.category;

          return (
            <button
              key={i}
              onClick={() => onSelect(story.search_topic)}
              className="w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-[#f0e8dc] transition-colors group"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${catDot} mt-1.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="font-serif text-xs font-semibold text-[#1a1a1a] leading-snug line-clamp-2">
                  {headline(story)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-sans text-[9px] uppercase tracking-wider text-gray-400">{catLabel}</span>
                  <span className="text-[9px] text-gray-300">·</span>
                  <span className="font-sans text-[9px] text-gray-400">{story.source}</span>
                </div>
              </div>
              <span className="font-sans text-[10px] text-gray-300 group-hover:text-[#1a1a1a] mt-0.5 shrink-0 transition-colors">→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
