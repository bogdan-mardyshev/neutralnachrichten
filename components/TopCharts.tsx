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

const FireIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
  </svg>
);

const BarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-orange-500"><FireIcon /></span>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t.topCharts.title}</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-orange-500"><FireIcon /></span>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t.topCharts.title}</h3>
        </div>
        <p className="text-sm text-gray-400">{t.topCharts.noData}</p>
      </div>
    );
  }

  const maxCount = topics[0]?.count || 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-orange-500"><FireIcon /></span>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t.topCharts.title}</h3>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <BarIcon />
          <span className="text-xs">{t.topCharts.searches}</span>
        </div>
      </div>

      {/* Chart rows */}
      <div className="space-y-2.5">
        {topics.map((item, idx) => {
          const barWidth = Math.max((item.count / maxCount) * 100, 8);
          const isTop3 = idx < 3;

          return (
            <button
              key={item.topic}
              onClick={() => onSelect(item.topic)}
              className="w-full text-left group"
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <span className={`text-xs font-bold w-5 text-center shrink-0 ${
                  idx === 0 ? 'text-orange-500' :
                  idx === 1 ? 'text-gray-500' :
                  idx === 2 ? 'text-amber-700' :
                  'text-gray-300'
                }`}>
                  {idx + 1}
                </span>

                {/* Bar + label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm truncate pr-2 group-hover:text-slate-900 transition-colors ${
                      isTop3 ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'
                    }`}>
                      {item.topic}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-50 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        idx === 0 ? 'bg-orange-400' :
                        idx === 1 ? 'bg-gray-400' :
                        idx === 2 ? 'bg-amber-500' :
                        'bg-slate-200'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
