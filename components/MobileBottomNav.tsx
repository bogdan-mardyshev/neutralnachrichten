import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Language } from '../translations';

interface Props {
  lang:         Language;
  authUser:     { email: string } | null;
  onSearchTab:  () => void;   // scroll to top / focus search
  onAnalyzed:   () => void;   // open PublicAnalyses sheet
}

const L = {
  de: { search: 'Suchen', analyzed: 'Analysiert', compare: 'Vergleich', profile: 'Profil', login: 'Login' },
  en: { search: 'Search', analyzed: 'Analyzed',  compare: 'Compare',  profile: 'Profile', login: 'Login' },
  ru: { search: 'Поиск',  analyzed: 'Анализы',   compare: 'Сравнить', profile: 'Профиль', login: 'Войти' },
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IconAnalyzed = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    <path d="M7 8h10M7 12h6"/>
  </svg>
);
const IconCompare = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
);
const IconProfile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

interface TabProps {
  icon:     React.ReactNode;
  label:    string;
  active:   boolean;
  badge?:   boolean;
  onClick:  () => void;
}

function Tab({ icon, label, active, badge, onClick }: TabProps) {
  const [bouncing, setBouncing] = useState(false);

  const handleClick = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 400);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
      style={{ minHeight: 56 }}
    >
      {/* Active indicator bar */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] transition-all duration-300 rounded-full"
        style={{
          width:      active ? '28px' : '0px',
          background: active ? '#e11d48' : 'transparent',
        }}
      />

      {/* Icon */}
      <div
        className={`transition-all duration-200 ${bouncing ? 'animate-nav-bounce' : ''} ${
          active ? 'text-rose-600' : 'text-gray-400'
        }`}
        style={{ transform: active ? 'scale(1.05)' : 'scale(1)' }}
      >
        {icon}
        {badge && (
          <span className="absolute top-1.5 right-[calc(50%-10px)] w-2 h-2 bg-rose-500 rounded-full border-2 border-[#FFF8F0]" />
        )}
      </div>

      {/* Label */}
      <span className={`font-sans text-[9px] uppercase tracking-widest leading-none transition-colors duration-200 ${
        active ? 'text-rose-600 font-bold' : 'text-gray-400'
      }`}>
        {label}
      </span>
    </button>
  );
}

export function MobileBottomNav({ lang, authUser, onSearchTab, onAnalyzed }: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const t = L[lang] ?? L.de;

  const path = location.pathname;
  const isHome    = path === '/';
  const isCompare = path === '/compare';
  const isProfile = path === '/profile';

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FFF8F0] border-t-2 border-[#1a1a1a]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Spectrum strip at top */}
      <div className="h-[2px] flex">
        <div className="flex-1 bg-rose-600" />
        <div className="flex-1 bg-orange-400" />
        <div className="flex-1 bg-slate-400" />
        <div className="flex-1 bg-sky-500" />
        <div className="flex-1 bg-blue-700" />
      </div>

      <div className="flex">
        <Tab
          icon={<IconSearch />}
          label={t.search}
          active={isHome}
          onClick={() => { if (isHome) onSearchTab(); else navigate('/'); }}
        />
        <Tab
          icon={<IconAnalyzed />}
          label={t.analyzed}
          active={false}
          onClick={onAnalyzed}
        />
        <Tab
          icon={<IconCompare />}
          label={t.compare}
          active={isCompare}
          onClick={() => navigate('/compare')}
        />
        <Tab
          icon={<IconProfile />}
          label={authUser ? t.profile : t.login}
          active={isProfile}
          badge={!authUser}
          onClick={() => navigate('/profile')}
        />
      </div>
    </nav>
  );
}
