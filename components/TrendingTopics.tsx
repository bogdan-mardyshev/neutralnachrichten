import React, { useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { Language, translations } from '../translations';
import { TRENDING_TOPICS, getCategoryIcon } from '../trendingTopics';

interface TrendingTopicsProps {
  lang: Language;
  onSelect: (topic: string) => void;
}

export const TrendingTopics: React.FC<TrendingTopicsProps> = ({ lang, onSelect }) => {
  const t = translations[lang];
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <TrendingUp className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {t.trendingTitle}
        </span>
      </div>

      {/* Horizontal scroll on mobile, wrap on desktop */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none md:flex-wrap md:overflow-visible md:pb-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {TRENDING_TOPICS.map((item) => {
          const topicText = item.topic[lang];
          const icon = getCategoryIcon(item.category);

          return (
            <button
              key={item.id}
              onClick={() => onSelect(topicText)}
              className="flex-shrink-0 snap-start bg-white border border-gray-200 hover:border-slate-400 hover:shadow-sm rounded-xl px-4 py-3 text-left transition-all duration-150 group min-w-[160px] md:min-w-0"
            >
              <span className="text-lg mb-1 block">{icon}</span>
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 leading-snug line-clamp-2">
                {topicText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
