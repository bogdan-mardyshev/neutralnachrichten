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

const CATEGORY_CONFIG: Record<string, { dot: string; label_de: string; label_en: string; label_ru: string }> = {
  politics:      { dot: 'bg-blue-600',    label_de: 'Politik',        label_en: 'Politics',      label_ru: 'Политика'       },
  economy:       { dot: 'bg-emerald-500', label_de: 'Wirtschaft',     label_en: 'Economy',       label_ru: 'Экономика'      },
  society:       { dot: 'bg-violet-500',  label_de: 'Gesellschaft',   label_en: 'Society',       label_ru: 'Общество'       },
  defense:       { dot: 'bg-slate-500',   label_de: 'Verteidigung',   label_en: 'Defense',       label_ru: 'Оборона'        },
  environment:   { dot: 'bg-green-500',   label_de: 'Umwelt',         label_en: 'Environment',   label_ru: 'Экология'       },
  international: { dot: 'bg-sky-500',     label_de: 'International',  label_en: 'International', label_ru: 'Международное'  },
  culture:       { dot: 'bg-amber-500',   label_de: 'Kultur',         label_en: 'Culture',       label_ru: 'Культура'       },
  justice:       { dot: 'bg-rose-600',    label_de: 'Justiz',         label_en: 'Justice',       label_ru: 'Правосудие'     },
};

const DEFAULT_CAT = { dot: 'bg-gray-400', label_de: '', label_en: '', label_ru: '' };

// Rank accent colors — gold / silver / bronze
const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
const RANK_BG     = ['bg-amber-50 border-amber-200', 'bg-slate-50 border-slate-200', 'bg-amber-50/60 border-amber-100'];

function getTopicText(topic: TrendingTopic, lang: Language) {
  if (lang === 'en') return topic.topic_en;
  if (lang === 'ru') return topic.topic_ru;
  return topic.topic_de;
}

function getCatLabel(cat: typeof DEFAULT_CAT, lang: Language) {
  if (lang === 'en') return cat.label_en;
  if (lang === 'ru') return cat.label_ru;
  return cat.label_de;
}

export const TrendingTopics: React.FC<TrendingTopicsProps> = ({ lang, onSelect }) => {
  const t = translations[lang];
  const [data, setData] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/trending')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const weekLabel = data?.week_of
    ? new Date(data.week_of).toLocaleDateString(
        lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'de-DE',
        { day: '2-digit', month: '2-digit', year: 'numeric' }
      )
    : null;

  return (
    <div className="mt-8">
      {/* Header — newspaper style */}
      <div className="flex items-center justify-between mb-0 border-b-2 border-[#1a1a1a] pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <h2 className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]">
            {t.trendingTitle}
          </h2>
        </div>
        {weekLabel && (
          <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
            KW {weekLabel}
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="divide-y divide-[#e0d8cf] border-b border-[#e0d8cf]">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="py-3 flex items-center gap-4 animate-pulse">
              <div className="font-sans text-[10px] text-gray-200 w-4 shrink-0">{i + 1}</div>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[#e8e0d5] rounded w-3/4" />
                <div className="h-2.5 bg-[#e8e0d5] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <p className="font-sans text-xs text-gray-400 py-4 text-center border-b border-[#e0d8cf]">
          {lang === 'de' ? 'Trends konnten nicht geladen werden.' :
           lang === 'ru' ? 'Не удалось загрузить тренды.' :
           'Could not load trending topics.'}
        </p>
      )}

      {!loading && !error && data && (
        <>
          {/* Top 3 — prominent cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-b-2 border-[#1a1a1a]">
            {data.topics.slice(0, 3).map((topic, idx) => {
              const topicText = getTopicText(topic, lang);
              const cat = CATEGORY_CONFIG[topic.category] ?? DEFAULT_CAT;
              const catLabel = getCatLabel(cat, lang);

              return (
                <button
                  key={idx}
                  onClick={() => onSelect(topic.topic_de)}
                  className={`group text-left border-r last:border-r-0 border-[#1a1a1a] p-4 hover:bg-[#f0e8dc] transition-colors ${idx === 0 ? 'border-l-0' : ''}`}
                >
                  {/* Rank + category */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                      <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{catLabel}</span>
                    </div>
                    <span className={`font-serif font-black text-2xl tabular-nums ${RANK_COLORS[idx]}`}>
                      {idx + 1}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="font-serif font-bold text-sm text-[#1a1a1a] leading-snug line-clamp-2 mb-2 group-hover:opacity-80 transition-opacity">
                    {topicText}
                  </p>

                  {/* Reason */}
                  <p className="font-sans text-[10px] text-gray-400 leading-relaxed line-clamp-2">
                    {topic.trend_reason_de}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Ranks 4–8 — flat list */}
          <div className="divide-y divide-[#e0d8cf] border-b border-[#e0d8cf]">
            {data.topics.slice(3).map((topic, i) => {
              const idx = i + 3;
              const topicText = getTopicText(topic, lang);
              const cat = CATEGORY_CONFIG[topic.category] ?? DEFAULT_CAT;
              const catLabel = getCatLabel(cat, lang);

              return (
                <button
                  key={idx}
                  onClick={() => onSelect(topic.topic_de)}
                  className="group w-full text-left py-3 px-1 flex items-start gap-4 hover:bg-[#f0e8dc] transition-colors"
                >
                  {/* Rank */}
                  <span className="font-sans text-[10px] font-bold text-gray-300 tabular-nums w-4 shrink-0 mt-0.5">
                    {idx + 1}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dot}`} />
                      <span className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{catLabel}</span>
                    </div>
                    <p className="font-serif font-semibold text-sm text-[#1a1a1a] leading-snug line-clamp-1 group-hover:opacity-70 transition-opacity">
                      {topicText}
                    </p>
                    <p className="font-sans text-[10px] text-gray-400 leading-snug line-clamp-1 mt-0.5">
                      {topic.trend_reason_de}
                    </p>
                  </div>

                  <span className="font-sans text-xs text-gray-300 group-hover:text-[#1a1a1a] shrink-0 mt-0.5 transition-colors">→</span>
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300 text-right mt-2">
            {lang === 'de' ? 'Echtzeit via Google Search' :
             lang === 'ru' ? 'В реальном времени · Google Search' :
             'Real-time · Google Search'}
          </p>
        </>
      )}
    </div>
  );
};
