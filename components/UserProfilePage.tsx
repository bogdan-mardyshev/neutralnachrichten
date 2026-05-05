import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Language } from '../translations';
import { AuthUser } from './AuthModal';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// ── Tier config ───────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, {
  label_de: string; label_en: string; label_ru: string;
  bg: string; text: string; border: string;
  strip: string; icon: string;
  benefits_de: string[]; benefits_en: string[]; benefits_ru: string[];
}> = {
  free: {
    label_de: 'Kostenlos', label_en: 'Free', label_ru: 'Бесплатный',
    bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300',
    strip: 'bg-gray-400',
    icon: '◎',
    benefits_de: ['10 Analysen pro Tag', 'Alle 5 Perspektiven', 'Tiefenanalyse'],
    benefits_en: ['10 analyses per day', 'All 5 perspectives', 'Deep analysis'],
    benefits_ru: ['10 анализов в день', 'Все 5 перспектив', 'Глубокий анализ'],
  },
  pro: {
    label_de: 'Pro', label_en: 'Pro', label_ru: 'Pro',
    bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-400',
    strip: 'bg-gradient-to-r from-amber-400 to-orange-400',
    icon: '★',
    benefits_de: ['Erhöhtes Tageslimit', 'Priorität bei Analysen', 'Früher Zugang zu Features'],
    benefits_en: ['Higher daily limit', 'Priority analyses', 'Early feature access'],
    benefits_ru: ['Повышенный дневной лимит', 'Приоритетные анализы', 'Ранний доступ к функциям'],
  },
  enterprise: {
    label_de: 'Enterprise', label_en: 'Enterprise', label_ru: 'Enterprise',
    bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-400',
    strip: 'bg-gradient-to-r from-blue-500 to-sky-500',
    icon: '◆',
    benefits_de: ['Unbegrenzte Analysen', 'API-Zugang', 'Dedizierter Support'],
    benefits_en: ['Unlimited analyses', 'API access', 'Dedicated support'],
    benefits_ru: ['Безлимитные анализы', 'Доступ к API', 'Выделенная поддержка'],
  },
};

// ── Translations ──────────────────────────────────────────────────────────────
const PT = {
  de: {
    back: '← Zurück',
    title: 'Mein Konto',
    avatar_label: 'Ihr Profil',
    member_since: 'Mitglied seit',
    plan_label: 'Plan',
    email_label: 'E-Mail',
    usage_title: 'Tagesnutzung',
    usage_unlimited: 'Unbegrenzt',
    usage_of: (u: number, l: number) => `${u} / ${l} Analysen heute`,
    resets: 'Setzt täglich um Mitternacht UTC zurück',
    benefits_title: 'Ihr Plan enthält',
    upgrade_title: 'Auf Pro upgraden',
    upgrade_sub: 'Mehr Analysen · Priorität · Früher Zugang',
    upgrade_cta: 'feedback@neutralnachrichten.com',
    actions_title: 'Aktionen',
    logout: 'Abmelden',
    loading: 'Lade Profil…',
    searches_label: 'Analysen gesamt',
    unlimited_badge: 'Unbegrenzt ∞',
  },
  en: {
    back: '← Back',
    title: 'My Account',
    avatar_label: 'Your profile',
    member_since: 'Member since',
    plan_label: 'Plan',
    email_label: 'Email',
    usage_title: 'Daily Usage',
    usage_unlimited: 'Unlimited',
    usage_of: (u: number, l: number) => `${u} / ${l} analyses today`,
    resets: 'Resets daily at midnight UTC',
    benefits_title: 'Your plan includes',
    upgrade_title: 'Upgrade to Pro',
    upgrade_sub: 'More analyses · Priority · Early access',
    upgrade_cta: 'feedback@neutralnachrichten.com',
    actions_title: 'Actions',
    logout: 'Log out',
    loading: 'Loading profile…',
    searches_label: 'Total analyses',
    unlimited_badge: 'Unlimited ∞',
  },
  ru: {
    back: '← Назад',
    title: 'Мой аккаунт',
    avatar_label: 'Ваш профиль',
    member_since: 'С нами с',
    plan_label: 'Тариф',
    email_label: 'E-mail',
    usage_title: 'Использование сегодня',
    usage_unlimited: 'Безлимитно',
    usage_of: (u: number, l: number) => `${u} / ${l} анализов сегодня`,
    resets: 'Сбрасывается каждый день в полночь UTC',
    benefits_title: 'Ваш тариф включает',
    upgrade_title: 'Перейти на Pro',
    upgrade_sub: 'Больше анализов · Приоритет · Ранний доступ',
    upgrade_cta: 'feedback@neutralnachrichten.com',
    actions_title: 'Действия',
    logout: 'Выйти',
    loading: 'Загрузка профиля…',
    searches_label: 'Анализов всего',
    unlimited_badge: 'Безлимитно ∞',
  },
};

// ── Spectrum accent strip ─────────────────────────────────────────────────────
const SpectrumStrip = () => (
  <div className="flex gap-0.5">
    <div className="w-5 h-[3px] bg-rose-600" />
    <div className="w-5 h-[3px] bg-orange-400" />
    <div className="w-5 h-[3px] bg-slate-400" />
    <div className="w-5 h-[3px] bg-sky-500" />
    <div className="w-5 h-[3px] bg-blue-700" />
  </div>
);

// ── Usage ring (SVG) ──────────────────────────────────────────────────────────
const UsageRing: React.FC<{ used: number; limit: number; unlimited: boolean }> = ({ used, limit, unlimited }) => {
  const size = 88;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = unlimited ? 0 : limit > 0 ? Math.min(used / limit, 1) : 0;
  const dash = pct * circ;

  const color = unlimited ? '#0ea5e9' : pct >= 1 ? '#e11d48' : pct >= 0.7 ? '#fb923c' : '#059669';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Background track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e0d8cf" strokeWidth={stroke} />
      {/* Progress */}
      {!unlimited && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      )}
      {unlimited && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} />
      )}
    </svg>
  );
};

// ── Avatar initials ───────────────────────────────────────────────────────────
const Avatar: React.FC<{ email: string; tier: string }> = ({ email, tier }) => {
  const initials = email.slice(0, 2).toUpperCase();
  const tc = TIER_CONFIG[tier] || TIER_CONFIG.free;
  const gradients: Record<string, string> = {
    free:       'from-gray-700 to-gray-500',
    pro:        'from-amber-500 to-orange-500',
    enterprise: 'from-blue-600 to-sky-500',
  };
  return (
    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradients[tier] || gradients.free} flex items-center justify-center shadow-md`}>
      <span className="font-serif font-black text-2xl text-white">{initials}</span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
interface UserProfilePageProps {
  lang: Language;
  authToken: string | null;
  authUser: AuthUser | null;
  onLogout: () => void;
}

export default function UserProfilePage({ lang, authToken, authUser, onLogout }: UserProfilePageProps) {
  const pt = PT[lang];
  const navigate = useNavigate();

  const [userData, setUserData] = useState<any>(null);
  const [usageData, setUsageData] = useState<{ used: number; limit: number; remaining: number; unlimited?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authToken) { navigate('/', { replace: true }); return; }
    const headers = { Authorization: `Bearer ${authToken}` };
    Promise.all([
      fetch(`${API_BASE}/api/auth/me`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/api/auth/usage`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([meRes, usageRes]) => {
      if (meRes?.user) setUserData(meRes.user);
      if (usageRes) setUsageData(usageRes);
      setLoading(false);
    });
  }, [authToken, navigate]);

  if (!authUser) return null;

  const user = userData || authUser;
  const tier = (user.tier as string) || 'free';
  const tc = TIER_CONFIG[tier] || TIER_CONFIG.free;
  const tierLabel = lang === 'de' ? tc.label_de : lang === 'ru' ? tc.label_ru : tc.label_en;
  const tierBenefits = lang === 'de' ? tc.benefits_de : lang === 'ru' ? tc.benefits_ru : tc.benefits_en;

  const unlimited = usageData?.unlimited === true || user.daily_limit === -1;
  const dailyLimit = unlimited ? -1 : (usageData?.limit ?? user.daily_limit ?? 10);
  const usedToday = usageData?.used ?? 0;
  const remaining = unlimited ? Infinity : (usageData?.remaining ?? dailyLimit);

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(
        lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' }
      )
    : null;

  const handleLogout = () => { onLogout(); navigate('/', { replace: true }); };

  return (
    <div className="animate-fade-in max-w-2xl space-y-6">

      {/* ── Back ──────────────────────────────────────────── */}
      <Link to="/" className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors">
        {pt.back}
      </Link>

      {loading ? (
        <div className="border-2 border-[#1a1a1a] p-14 text-center">
          <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400">{pt.loading}</p>
        </div>
      ) : (
        <>
          {/* ── Hero card ────────────────────────────────── */}
          <div className="border-2 border-[#1a1a1a] overflow-hidden">
            {/* Tier color strip */}
            <div className={`h-1.5 w-full ${tc.strip}`} />

            <div className="px-6 py-6 flex items-start gap-5">
              {/* Avatar */}
              <Avatar email={user.email} tier={tier} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-serif font-black text-xl text-[#1a1a1a] truncate">
                      {user.email.split('@')[0]}
                    </p>
                    <p className="font-sans text-[10px] text-gray-400 truncate">{user.email}</p>
                  </div>
                  {/* Tier badge */}
                  <span className={`font-sans text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border ${tc.bg} ${tc.text} ${tc.border} shrink-0`}>
                    {tc.icon} {tierLabel}
                  </span>
                </div>

                <SpectrumStrip />

                {joinedDate && (
                  <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300 mt-2">
                    {pt.member_since} {joinedDate}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Stats row ────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Usage ring card */}
            <div className="border-2 border-[#1a1a1a] p-4 flex flex-col items-center gap-2 col-span-2 sm:col-span-1">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{pt.usage_title}</p>
              <div className="relative">
                <UsageRing used={usedToday} limit={dailyLimit} unlimited={unlimited} />
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {unlimited ? (
                    <span className="font-serif font-black text-lg text-sky-500">∞</span>
                  ) : (
                    <>
                      <span className="font-serif font-black text-lg text-[#1a1a1a] leading-none">{usedToday}</span>
                      <span className="font-sans text-[9px] text-gray-400">/ {dailyLimit}</span>
                    </>
                  )}
                </div>
              </div>
              {unlimited ? (
                <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-sky-600">{pt.usage_unlimited}</span>
              ) : (
                <span className={`font-sans text-[9px] uppercase tracking-widest font-bold ${remaining === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {remaining} left
                </span>
              )}
            </div>

            {/* Plan card */}
            <div className="border-2 border-[#1a1a1a] p-4 flex flex-col gap-1">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{pt.plan_label}</p>
              <p className={`font-serif font-black text-2xl ${tc.text}`}>{tc.icon} {tierLabel}</p>
              <div className="mt-auto pt-2 border-t border-[#e0d8cf]">
                {tierBenefits.slice(0, 2).map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 mt-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-sans text-[9px] text-gray-500">{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email / since card */}
            <div className="border-2 border-[#1a1a1a] p-4 flex flex-col gap-3">
              <div>
                <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">{pt.email_label}</p>
                <p className="font-sans text-xs text-[#1a1a1a] font-semibold break-all">{user.email}</p>
              </div>
              {joinedDate && (
                <div>
                  <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">{pt.member_since}</p>
                  <p className="font-serif text-sm text-[#1a1a1a]">{joinedDate}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Usage detail ─────────────────────────────── */}
          {!unlimited && (
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3 flex items-center justify-between">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.usage_title}</p>
                <span className="font-sans text-[10px] text-white/40">{pt.usage_of(usedToday, dailyLimit)}</span>
              </div>
              <div className="px-5 py-5 space-y-4">
                {/* Segmented bar */}
                <div className="flex gap-0.5">
                  {Array.from({ length: dailyLimit }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-3 flex-1 transition-all ${
                        i < usedToday
                          ? i < dailyLimit * 0.5 ? 'bg-emerald-500'
                          : i < dailyLimit * 0.8 ? 'bg-orange-400'
                          : 'bg-rose-500'
                          : 'bg-[#e0d8cf]'
                      }`}
                    />
                  ))}
                </div>
                <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300">{pt.resets}</p>
              </div>
            </div>
          )}

          {/* ── Unlimited badge (for unlimited users) ────── */}
          {unlimited && (
            <div className="border-2 border-sky-500 bg-sky-50 overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <span className="text-3xl">∞</span>
                <div>
                  <p className="font-serif font-black text-lg text-sky-800">{pt.unlimited_badge}</p>
                  <p className="font-sans text-[10px] text-sky-600 uppercase tracking-wider">{tierBenefits[0]}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Plan benefits ─────────────────────────────── */}
          <div className="border-2 border-[#1a1a1a] overflow-hidden">
            <div className="bg-[#1a1a1a] px-5 py-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.benefits_title}</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tierBenefits.map((benefit, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-[#f8f3ec] border border-[#e0d8cf]">
                  <span className={`font-serif font-bold text-lg ${tc.text} shrink-0 leading-none mt-0.5`}>
                    {['①', '②', '③'][i]}
                  </span>
                  <p className="font-sans text-xs text-[#1a1a1a] leading-relaxed">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Upgrade CTA (free only) ───────────────────── */}
          {tier === 'free' && (
            <div className="border-2 border-amber-400 bg-amber-50 overflow-hidden">
              <div className="bg-amber-400 px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.upgrade_title}</p>
              </div>
              <div className="px-5 py-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-serif font-bold text-base text-amber-900 mb-1">★ {pt.upgrade_title}</p>
                  <p className="font-sans text-[10px] text-amber-700 uppercase tracking-wider">{pt.upgrade_sub}</p>
                </div>
                <a
                  href={`mailto:${pt.upgrade_cta}`}
                  className="font-sans text-[10px] font-bold uppercase tracking-widest border-2 border-amber-600 text-amber-700 px-4 py-2 hover:bg-amber-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  {pt.upgrade_cta}
                </a>
              </div>
            </div>
          )}

          {/* ── Logout ───────────────────────────────────── */}
          <div className="border-t-2 border-[#1a1a1a] pt-4">
            <button
              onClick={handleLogout}
              className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-rose-600 transition-colors flex items-center gap-2"
            >
              <span className="text-xs">×</span> {pt.logout}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
