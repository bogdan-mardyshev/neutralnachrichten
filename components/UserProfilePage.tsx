import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Language } from '../translations';
import { AuthUser } from './AuthModal';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const TIER_STYLE: Record<string, { label_de: string; label_en: string; label_ru: string; cls: string; border: string }> = {
  free:       { label_de: 'Kostenlos',  label_en: 'Free',       label_ru: 'Бесплатный', cls: 'text-gray-600',  border: 'border-gray-400'  },
  pro:        { label_de: 'Pro',        label_en: 'Pro',         label_ru: 'Pro',         cls: 'text-amber-700', border: 'border-amber-500' },
  enterprise: { label_de: 'Enterprise', label_en: 'Enterprise',  label_ru: 'Enterprise',  cls: 'text-blue-700',  border: 'border-blue-500'  },
};

const PROFILE_T = {
  de: {
    title: 'Mein Konto',
    back: '← Zurück',
    account: 'Kontodaten',
    email: 'E-Mail',
    plan: 'Plan',
    joined: 'Dabei seit',
    usage: 'Tagesnutzung',
    usedOf: (used: number, limit: number) => `${used} von ${limit} Analysen heute`,
    remaining: (n: number) => `${n} verbleibend`,
    resetNote: 'Setzt täglich um Mitternacht (UTC) zurück',
    actions: 'Aktionen',
    logout: 'Abmelden',
    loading: 'Lade Profil…',
    upgradeTitle: 'Plan upgraden',
    upgradePro: 'Pro — Höheres Limit & Priorität',
    upgradeNote: 'Schreib uns: feedback@neutralnachrichten.com',
  },
  en: {
    title: 'My Account',
    back: '← Back',
    account: 'Account Details',
    email: 'Email',
    plan: 'Plan',
    joined: 'Member since',
    usage: 'Daily Usage',
    usedOf: (used: number, limit: number) => `${used} of ${limit} analyses today`,
    remaining: (n: number) => `${n} remaining`,
    resetNote: 'Resets daily at midnight UTC',
    actions: 'Actions',
    logout: 'Log out',
    loading: 'Loading profile…',
    upgradeTitle: 'Upgrade plan',
    upgradePro: 'Pro — Higher limit & priority access',
    upgradeNote: 'Contact us: feedback@neutralnachrichten.com',
  },
  ru: {
    title: 'Мой аккаунт',
    back: '← Назад',
    account: 'Данные аккаунта',
    email: 'E-mail',
    plan: 'Тариф',
    joined: 'С нами с',
    usage: 'Использование сегодня',
    usedOf: (used: number, limit: number) => `${used} из ${limit} анализов сегодня`,
    remaining: (n: number) => `осталось ${n}`,
    resetNote: 'Сбрасывается каждый день в полночь (UTC)',
    actions: 'Действия',
    logout: 'Выйти',
    loading: 'Загрузка профиля…',
    upgradeTitle: 'Улучшить тариф',
    upgradePro: 'Pro — Повышенный лимит и приоритет',
    upgradeNote: 'Напишите нам: feedback@neutralnachrichten.com',
  },
};

interface UserProfilePageProps {
  lang: Language;
  authToken: string | null;
  authUser: AuthUser | null;
  onLogout: () => void;
}

export default function UserProfilePage({ lang, authToken, authUser, onLogout }: UserProfilePageProps) {
  const pt = PROFILE_T[lang];
  const navigate = useNavigate();

  const [userData, setUserData] = useState<any>(null);
  const [usageData, setUsageData] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authToken) {
      navigate('/', { replace: true });
      return;
    }
    const headers = { Authorization: `Bearer ${authToken}` };

    Promise.all([
      fetch(`${API_BASE}/api/auth/me`, { headers })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      fetch(`${API_BASE}/api/auth/usage`, { headers })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([meRes, usageRes]) => {
      if (meRes?.user) setUserData(meRes.user);
      if (usageRes) setUsageData(usageRes);
      setLoading(false);
    });
  }, [authToken, navigate]);

  if (!authUser) return null;

  const user = userData || authUser;
  const tier = (user.tier as string) || 'free';
  const ts = TIER_STYLE[tier] || TIER_STYLE.free;
  const tierLabel = lang === 'de' ? ts.label_de : lang === 'ru' ? ts.label_ru : ts.label_en;

  const dailyLimit = usageData?.limit ?? user.daily_limit ?? 10;
  const usedToday = usageData?.used ?? 0;
  const remaining = usageData?.remaining ?? dailyLimit;

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(
        lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' }
      )
    : null;

  const handleLogout = () => {
    onLogout();
    navigate('/', { replace: true });
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-lg">
      {/* Page header */}
      <div>
        <Link
          to="/"
          className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors"
        >
          {pt.back}
        </Link>
        <h1 className="font-serif font-black text-3xl text-[#1a1a1a] mt-3">{pt.title}</h1>
        <div className="flex gap-0.5 mt-2">
          <div className="w-6 h-[3px] bg-rose-600" />
          <div className="w-6 h-[3px] bg-orange-400" />
          <div className="w-6 h-[3px] bg-slate-400" />
          <div className="w-6 h-[3px] bg-sky-500" />
          <div className="w-6 h-[3px] bg-blue-700" />
        </div>
      </div>

      {loading ? (
        <div className="border-2 border-[#1a1a1a] p-10 text-center">
          <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400">{pt.loading}</p>
        </div>
      ) : (
        <>
          {/* ── Account Details ───────────────────────────────── */}
          <div className="border-2 border-[#1a1a1a] overflow-hidden">
            <div className="bg-[#1a1a1a] px-5 py-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.account}</p>
            </div>
            <div className="divide-y divide-[#e0d8cf]">
              <div className="flex items-center justify-between px-5 py-4 gap-4">
                <span className="font-sans text-[10px] uppercase tracking-widest text-gray-400 shrink-0">{pt.email}</span>
                <span className="font-serif text-sm text-[#1a1a1a] font-semibold text-right break-all">{user.email}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <span className="font-sans text-[10px] uppercase tracking-widest text-gray-400 shrink-0">{pt.plan}</span>
                <span className={`font-sans text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${ts.cls} ${ts.border}`}>
                  {tierLabel}
                </span>
              </div>
              {joinedDate && (
                <div className="flex items-center justify-between px-5 py-4">
                  <span className="font-sans text-[10px] uppercase tracking-widest text-gray-400 shrink-0">{pt.joined}</span>
                  <span className="font-serif text-sm text-[#1a1a1a]">{joinedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Daily Usage ───────────────────────────────────── */}
          <div className="border-2 border-[#1a1a1a] overflow-hidden">
            <div className="bg-[#1a1a1a] px-5 py-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.usage}</p>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-sans text-sm text-gray-600">{pt.usedOf(usedToday, dailyLimit)}</span>
                <span className={`font-sans text-[10px] uppercase tracking-widest font-bold ${remaining === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {pt.remaining(remaining)}
                </span>
              </div>
              {/* Dot-bar usage indicator */}
              <div className="flex gap-0.5">
                {Array.from({ length: dailyLimit }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 transition-colors ${i < usedToday ? 'bg-[#1a1a1a]' : 'bg-[#e0d8cf]'}`}
                  />
                ))}
              </div>
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300">{pt.resetNote}</p>
            </div>
          </div>

          {/* ── Upgrade CTA (free tier only) ─────────────────── */}
          {tier === 'free' && (
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.upgradeTitle}</p>
              </div>
              <div className="px-5 py-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-1 h-full bg-amber-400 shrink-0 mt-0.5" style={{ width: 3, alignSelf: 'stretch' }} />
                  <div>
                    <p className="font-serif font-semibold text-sm text-[#1a1a1a] mb-1">{pt.upgradePro}</p>
                    <p className="font-sans text-[10px] text-gray-400 uppercase tracking-wider">{pt.upgradeNote}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Actions ───────────────────────────────────────── */}
          <div className="border-2 border-[#1a1a1a] overflow-hidden">
            <div className="bg-[#1a1a1a] px-5 py-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.actions}</p>
            </div>
            <div className="px-5 py-5">
              <button
                onClick={handleLogout}
                className="w-full font-sans text-[10px] uppercase tracking-widest border-2 border-rose-600 text-rose-600 px-4 py-3 hover:bg-rose-600 hover:text-white transition-colors"
              >
                {pt.logout}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
