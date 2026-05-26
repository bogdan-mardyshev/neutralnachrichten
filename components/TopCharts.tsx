import React, { useEffect, useState } from 'react';
import { Language, translations } from '../translations';

interface TopicCount {
  topic: string;
  count: number;
  lastSeen: string;
}

interface TopChartsProps {
  lang: Language;
  onSelect: (topic: string) => void;
}

// Gold / silver / bronze rank accent
const RANK_COLORS = [
  'text-amber-500',   // 1
  'text-slate-400',   // 2
  'text-amber-700',   // 3
];

const RANK_BAR = [
  'bg-amber-400',     // 1
  'bg-slate-400',     // 2
  'bg-amber-700',     // 3
];

export const TopCharts: React.FC<TopChartsProps> = ({ lang, onSelect }) => {
  const t = translations[lang];
  const [topics, setTopics] = useState<TopicCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/top-topics?limit=10')
      .then(r => r.json())
      .then(data => {
        setTopics(data.topics || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const maxCount = topics[0]?.count || 1;

  return (
    <div className="border-2 border-[#1a1a1a] dark:border-[#2d2d2d] overflow-hidden mt-8 bg-[#FFF8F0] dark:bg-[#141414]">
      {/* Newspaper-style black header */}
      <div className="bg-[#1a1a1a] px-5 py-3 flex items-center justify-between">
        <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">
          {t.topCharts.title}
        </p>
        <span className="font-sans text-[9px] uppercase tracking-widest text-white/40">
          {t.topCharts.searches}
        </span>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="divide-y divide-[#e0d8cf] dark:divide-[#252525]">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4 animate-pulse">
              <div className="w-4 h-3 bg-[#e8e0d5] dark:bg-[#252525] rounded shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-[#e8e0d5] dark:bg-[#252525] rounded w-3/4" />
                <div className="h-1.5 bg-[#e8e0d5] dark:bg-[#252525] rounded w-full" />
              </div>
              <div className="w-6 h-2.5 bg-[#e8e0d5] dark:bg-[#252525] rounded shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && topics.length === 0 && (
        <p className="px-5 py-6 font-sans text-xs text-gray-400 dark:text-gray-500 text-center">
          {t.topCharts.noData}
        </p>
      )}

      {/* Topic rows */}
      {!loading && topics.length > 0 && (
        <div className="divide-y divide-[#e0d8cf] dark:divide-[#252525]">
          {topics.map((item, idx) => {
            const barWidth = Math.max((item.count / maxCount) * 100, 4);
            const rankColor = RANK_COLORS[idx] ?? 'text-gray-300 dark:text-gray-600';
            const barColor  = RANK_BAR[idx]    ?? 'bg-[#c8c0b7]';

            return (
              <button
                key={item.topic}
                onClick={() => onSelect(item.topic)}
                className="group w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-[#f0e8dc] dark:hover:bg-[#1c1c1c] transition-colors"
              >
                {/* Rank */}
                <span className={`font-serif font-black text-lg tabular-nums w-5 shrink-0 leading-none ${rankColor}`}>
                  {idx + 1}
                </span>

                {/* Topic + bar */}
                <div className="flex-1 min-w-0">
                  <p className={`font-serif text-xs leading-snug truncate mb-1.5 group-hover:opacity-70 transition-opacity ${
                    idx < 3 ? 'font-bold text-[#1a1a1a] dark:text-[#f0ece4]' : 'font-semibold text-[#3a3a3a] dark:text-[#b0a89e]'
                  }`}>
                    {item.topic}
                  </p>
                  {/* Bar track */}
                  <div className="w-full bg-[#e8e0d5] dark:bg-[#252525] h-1 overflow-hidden">
                    <div
                      className={`${barColor} h-full transition-all duration-700 ease-out`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Count */}
                <span className="font-sans text-[10px] font-bold text-gray-400 dark:text-gray-500 tabular-nums shrink-0 w-8 text-right">
                  {item.count}×
                </span>

                {/* Arrow */}
                <span className="font-sans text-[10px] text-gray-300 dark:text-gray-600 group-hover:text-[#1a1a1a] dark:group-hover:text-[#f0ece4] shrink-0 transition-colors">→</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
