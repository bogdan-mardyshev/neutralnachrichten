import React, { useEffect, useState } from 'react';
import { Language, translations } from '../translations';

interface TrendingTopic {
  topic_de: string;
  topic_en: string;
  topic_ru: string;
  category: string;
  trend_reason_de: string;
}

interface TrendingData {
  week_of: string;
  topics: TrendingTopic[];
}

interface TrendingTopicsProps {
  lang: Language;
  onSelect: (topic: string) => void;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  politics:      { icon: '🏛️', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100' },
  economy:       { icon: '📈', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
  society:       { icon: '👥', color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-100' },
  defense:       { icon: '🛡️', color: 'text-slate-700',   bg: 'bg-slate-50 border-slate-100' },
  environment:   { icon: '🌿', color: 'text-green-700',   bg: 'bg-green-50 border-green-100' },
  international: { icon: '🌍', color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-100' },
  culture:       { icon: '🎭', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-100' },
  justice:       { icon: '⚖️', color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-100' },
};

const DEFAULT_CAT = { icon: '📰', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-100' };

function getTopicText(topic: TrendingTopic, lang: Language) {
  if (lang === 'en') return topic.topic_en;
  if (lang === 'ru') return topic.topic_ru;
  return topic.topic_de;
}

// Skeleton loader card
const SkeletonCard = () => (
  <div className="animate-pulse bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3">
    <div className="w-8 h-8 bg-gray-100 rounded-lg shrink-0" />
    <div className="flex-1 space-y-2 pt-0.5">
      <div className="h-3.5 bg-gray-100 rounded w-3/4" />
      <div className="h-2.5 bg-gray-50 rounded w-full" />
    </div>
  </div>
);

export const TrendingTopics: React.FC<TrendingTopicsProps> = ({ lang, onSelect }) => {
  const t = translations[lang];
  const [data, setData] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/trending')
      .then(r => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  // Format "week of DD.MM.YYYY"
  const weekLabel = data?.week_of
    ? new Date(data.week_of).toLocaleDateString(
        lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'de-DE',
        { day: '2-digit', month: '2-digit', year: 'numeric' }
      )
    : null;

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-0.5">
        <div className="flex items-center gap-2">
          {/* Live dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {t.trendingTitle}
          </span>
        </div>
        {weekLabel && (
          <span className="text-[10px] text-gray-400 font-medium">
            KW {weekLabel}
          </span>
        )}
      </div>

      {/* Content */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {error && !loading && (
        <div className="text-sm text-gray-400 py-4 text-center">
          {lang === 'de' ? 'Trends konnten nicht geladen werden.' :
           lang === 'ru' ? 'Не удалось загрузить тренды.' :
           'Could not load trending topics.'}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-2">
          {/* Top 3 — slightly more prominent */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {data.topics.slice(0, 3).map((topic, idx) => {
              const topicText = getTopicText(topic, lang);
              const cat = CATEGORY_CONFIG[topic.category] ?? DEFAULT_CAT;
              const isHovered = hoveredIdx === idx;
              const rankColors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];

              return (
                <button
                  key={idx}
                  onClick={() => onSelect(topic.topic_de)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="group w-full text-left bg-white border border-gray-100 hover:border-slate-300 hover:shadow-md rounded-xl p-3.5 transition-all duration-200 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border ${cat.bg} transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`}>
                      {cat.icon}
                    </div>
                    <span className={`text-lg font-black tabular-nums ${rankColors[idx]}`}>
                      {idx + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-slate-900 leading-snug line-clamp-2 transition-colors mb-1">
                      {topicText}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 group-hover:text-gray-500 transition-colors">
                      {topic.trend_reason_de}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Ranks 4–8 — compact list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.topics.slice(3).map((topic, i) => {
              const idx = i + 3;
              const topicText = getTopicText(topic, lang);
              const cat = CATEGORY_CONFIG[topic.category] ?? DEFAULT_CAT;
              const isHovered = hoveredIdx === idx;

              return (
                <button
                  key={idx}
                  onClick={() => onSelect(topic.topic_de)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="group w-full text-left bg-white border border-gray-100 hover:border-slate-300 hover:shadow-sm rounded-xl p-3 transition-all duration-200 flex items-center gap-3"
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm border ${cat.bg} transition-transform duration-150 ${isHovered ? 'scale-105' : ''}`}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-black text-gray-300 tabular-nums shrink-0">{idx + 1}</span>
                      <span className="text-[13px] font-semibold text-slate-700 group-hover:text-slate-900 leading-snug line-clamp-1 transition-colors">
                        {topicText}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug line-clamp-1 mt-0.5 group-hover:text-gray-500 transition-colors">
                      {topic.trend_reason_de}
                    </p>
                  </div>
                  <span className={`shrink-0 text-gray-300 text-sm transition-all duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>→</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Powered-by note */}
      {!loading && !error && data && (
        <p className="text-[10px] text-gray-300 text-right mt-2 pr-0.5">
          {lang === 'de' ? '🔍 Echtzeit via Google Search' :
           lang === 'ru' ? '🔍 В реальном времени через Google Search' :
           '🔍 Real-time via Google Search'}
        </p>
      )}
    </div>
  );
};
