import React, { useState } from 'react';
import { DeepAnalysis } from '../types';
import { Language, translations } from '../translations';

interface DeepAnalysisBlockProps {
  data: DeepAnalysis;
  lang: Language;
}

const CheckCircleIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SplitIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const onlyInColors: Record<string, string> = {
  left: 'bg-red-50 text-red-700 border-red-200',
  center: 'bg-slate-50 text-slate-700 border-slate-200',
  right: 'bg-blue-50 text-blue-700 border-blue-200',
  none: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const DeepAnalysisBlock: React.FC<DeepAnalysisBlockProps> = ({ data, lang }) => {
  const t = translations[lang];
  const da = t.deepAnalysis;
  const [openSection, setOpenSection] = useState<'facts' | 'diverging' | 'silenced' | null>('facts');

  const toggle = (section: 'facts' | 'diverging' | 'silenced') =>
    setOpenSection(prev => (prev === section ? null : section));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-500 via-amber-400 to-red-500" />
        <h3 className="text-lg font-bold text-gray-900">{da.title}</h3>
      </div>

      {/* ── SHARED FACTS ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('facts')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-emerald-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircleIcon />
            </span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{da.sharedFactsTitle}</div>
              <div className="text-xs text-gray-500">{da.sharedFactsDesc}</div>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform duration-200 ${openSection === 'facts' ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {openSection === 'facts' && (
          <div className="border-t border-gray-50 divide-y divide-gray-50">
            {data.shared_facts.map((fact, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 text-emerald-500">
                  <CheckCircleIcon />
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{fact.claim}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DIVERGING POINTS ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('diverging')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <SplitIcon />
            </span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{da.divergingTitle}</div>
              <div className="text-xs text-gray-500">{da.divergingDesc}</div>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform duration-200 ${openSection === 'diverging' ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {openSection === 'diverging' && (
          <div className="border-t border-gray-50 divide-y divide-gray-50">
            {data.diverging_points.map((point, i) => (
              <div key={i} className="px-4 py-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600">{point.topic}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
                      {translations[lang].leaningLeft}
                    </div>
                    <p className="text-xs text-red-900 leading-relaxed">{point.left_view}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {translations[lang].leaningCenter}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{point.center_view}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">
                      {translations[lang].leaningRight}
                    </div>
                    <p className="text-xs text-blue-900 leading-relaxed">{point.right_view}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SILENCED TOPICS ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => toggle('silenced')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-red-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
              <EyeOffIcon />
            </span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{da.silencedTitle}</div>
              <div className="text-xs text-gray-500">{da.silencedDesc}</div>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform duration-200 ${openSection === 'silenced' ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {openSection === 'silenced' && (
          <div className="border-t border-gray-50 divide-y divide-gray-50">
            {data.silenced_topics.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{item.topic}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 ${onlyInColors[item.only_in] || onlyInColors.none}`}>
                      {da.onlyIn[item.only_in as keyof typeof da.onlyIn] ?? da.onlyIn.none}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
