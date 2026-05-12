import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Language } from '../translations';
import { AuthUser } from './AuthModal';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryEntry = {
  id: number;
  topic: string;
  lang: string;
  coverage_json: Record<string, { percent: number }> | null;
  created_at: string;
};

type Tab = 'overview' | 'history' | 'settings';

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
    strip: 'bg-gray-400', icon: '◎',
    benefits_de: ['10 Analysen pro Tag', 'Alle 5 Perspektiven', 'Tiefenanalyse'],
    benefits_en: ['10 analyses per day', 'All 5 perspectives', 'Deep analysis'],
    benefits_ru: ['10 анализов в день', 'Все 5 перспектив', 'Глубокий анализ'],
  },
  pro: {
    label_de: 'Pro', label_en: 'Pro', label_ru: 'Pro',
    bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-400',
    strip: 'bg-gradient-to-r from-amber-400 to-orange-400', icon: '★',
    benefits_de: ['Erhöhtes Tageslimit', 'Priorität bei Analysen', 'Früher Zugang zu Features'],
    benefits_en: ['Higher daily limit', 'Priority analyses', 'Early feature access'],
    benefits_ru: ['Повышенный дневной лимит', 'Приоритетные анализы', 'Ранний доступ к функциям'],
  },
  enterprise: {
    label_de: 'Enterprise', label_en: 'Enterprise', label_ru: 'Enterprise',
    bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-400',
    strip: 'bg-gradient-to-r from-blue-500 to-sky-500', icon: '◆',
    benefits_de: ['Unbegrenzte Analysen', 'API-Zugang', 'Dedizierter Support'],
    benefits_en: ['Unlimited analyses', 'API access', 'Dedicated support'],
    benefits_ru: ['Безлимитные анализы', 'Доступ к API', 'Выделенная поддержка'],
  },
};

// ── Spectrum constants ────────────────────────────────────────────────────────

const SPECTRUM_KEYS = ['left', 'center_left', 'center', 'center_right', 'right'] as const;
type SpecKey = typeof SPECTRUM_KEYS[number];

const S_STYLE: Record<SpecKey, { bar: string; text: string; bg: string; border: string; dot: string; label_de: string; label_en: string; label_ru: string }> = {
  left:         { bar: 'bg-rose-500',   text: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-200',   dot: 'bg-rose-500',   label_de: 'Links',       label_en: 'Left',        label_ru: 'Лево'          },
  center_left:  { bar: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200', dot: 'bg-orange-400', label_de: 'Mitte-Links', label_en: 'Center-Left', label_ru: 'Центр-Лево'    },
  center:       { bar: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200',  dot: 'bg-slate-400',  label_de: 'Mitte',       label_en: 'Center',      label_ru: 'Центр'         },
  center_right: { bar: 'bg-sky-500',    text: 'text-sky-600',    bg: 'bg-sky-50',     border: 'border-sky-200',    dot: 'bg-sky-500',    label_de: 'Mitte-Rechts',label_en: 'Center-Right',label_ru: 'Центр-Право'   },
  right:        { bar: 'bg-blue-700',   text: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-700',   label_de: 'Rechts',      label_en: 'Right',       label_ru: 'Право'         },
};

// ── Topic suggestion clusters ─────────────────────────────────────────────────

const SUGGESTION_CLUSTERS: [string[], string[]][] = [
  [['ukraine', 'krieg', 'war', 'russland', 'russia', 'nato'],
   ['NATO-Osterweiterung', 'Waffenlieferungen Ukraine', 'Russland-Sanktionen', 'Selenskyj']],
  [['klima', 'klimawandel', 'climate', 'co2', 'energie', 'energy', 'energiewende'],
   ['Kohleausstieg', 'Windkraft', 'Elektroautos', 'CO2-Steuer', 'Solarenergie']],
  [['bürgergeld', 'hartz', 'sozial', 'social', 'armut', 'poverty'],
   ['Mindestlohn', 'Sozialhilfe', 'Arbeitslosigkeit', 'Rentensystem', 'Kindergrundsicherung']],
  [['afd', 'migration', 'flüchtling', 'refugee', 'asyl', 'einwanderung'],
   ['Asylrecht', 'Abschiebungen', 'Integrationsgesetz', 'Grenzschutz', 'BAMF']],
  [['wirtschaft', 'economy', 'inflation', 'rezession', 'konjunktur'],
   ['Bundeshaushalt', 'Schuldenbremse', 'Exportwirtschaft', 'Leitzins', 'Deindustrialisierung']],
  [['gesundheit', 'health', 'krankenhaus', 'krankenkasse', 'pflege'],
   ['Krankenhausreform', 'Pflegenotstand', 'Kassenärzte', 'GKV-Beitrag']],
  [['israel', 'gaza', 'nahost', 'palästina', 'hamas'],
   ['Nahost-Friedensprozess', 'UN-Resolution Gaza', 'Waffenstillstand', 'Zweistaatenlösung']],
  [['heizung', 'wohnen', 'miete', 'rent', 'housing', 'immobilien'],
   ['Mietpreisbremse', 'Wohnungsbau', 'Gebäudesanierung', 'Verdrängung']],
  [['digitalisierung', 'digital', 'ki', 'ai', 'tech', 'internet'],
   ['KI-Regulierung', 'Datenschutz DSGVO', 'Breitbandausbau', 'Digitalsteuer']],
  [['bildung', 'schule', 'education', 'university', 'uni'],
   ['PISA-Studie', 'BAföG-Reform', 'Lehrermangel', 'Schuldigitalisierung']],
];

const DEFAULT_SUGGESTIONS = [
  'Bürgergeld', 'Energiewende', 'Ukraine-Krieg', 'AfD', 'Inflation',
  'Migration', 'Klimawandel', 'Bundeshaushalt', 'Israel-Gaza', 'Wohnungsnot',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string, lang: Language): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (lang === 'de') {
    if (mins < 2) return 'gerade eben';
    if (mins < 60) return `vor ${mins} Min.`;
    if (hours < 24) return `vor ${hours} Std.`;
    return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  } else if (lang === 'ru') {
    if (mins < 2) return 'только что';
    if (mins < 60) return `${mins} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    return `${days} д. назад`;
  } else {
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
}

function computeSpectrumProfile(history: HistoryEntry[]) {
  const sums: Record<SpecKey, number> = { left: 0, center_left: 0, center: 0, center_right: 0, right: 0 };
  let count = 0;
  history.forEach(e => {
    if (!e.coverage_json) return;
    count++;
    SPECTRUM_KEYS.forEach(k => { sums[k] += e.coverage_json![k]?.percent ?? 0; });
  });
  if (count === 0) return null;
  const avg: Record<SpecKey, number> = { left: 0, center_left: 0, center: 0, center_right: 0, right: 0 };
  SPECTRUM_KEYS.forEach(k => { avg[k] = Math.round(sums[k] / count); });
  return avg;
}

function computeTopTopics(history: HistoryEntry[]): { topic: string; count: number; lastLang: string }[] {
  const map: Record<string, { count: number; lastLang: string }> = {};
  history.forEach(e => {
    const key = e.topic.toLowerCase().trim();
    if (!map[key]) map[key] = { count: 0, lastLang: e.lang };
    map[key].count++;
    map[key].lastLang = e.lang;
  });
  return Object.entries(map)
    .map(([topic, { count, lastLang }]) => ({ topic, count, lastLang }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function computeSuggestions(history: HistoryEntry[]): string[] {
  if (history.length === 0) return DEFAULT_SUGGESTIONS.slice(0, 8);
  const allTopics = history.map(e => e.topic.toLowerCase());
  const searched = new Set(allTopics);
  const suggestions: string[] = [];
  const matchedClusters = new Set<number>();
  allTopics.forEach(topic => {
    SUGGESTION_CLUSTERS.forEach(([keywords], i) => {
      if (keywords.some(kw => topic.includes(kw))) matchedClusters.add(i);
    });
  });
  matchedClusters.forEach(i => {
    const [, sug] = SUGGESTION_CLUSTERS[i];
    sug.forEach(s => {
      if (!searched.has(s.toLowerCase()) && !suggestions.includes(s)) suggestions.push(s);
    });
  });
  DEFAULT_SUGGESTIONS.forEach(s => {
    if (!searched.has(s.toLowerCase()) && !suggestions.includes(s)) suggestions.push(s);
  });
  return suggestions.slice(0, 8);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const UsageRing: React.FC<{ used: number; limit: number; unlimited: boolean }> = ({ used, limit, unlimited }) => {
  const size = 88; const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = unlimited ? 0 : limit > 0 ? Math.min(used / limit, 1) : 0;
  const color = unlimited ? '#0ea5e9' : pct >= 1 ? '#e11d48' : pct >= 0.7 ? '#fb923c' : '#059669';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e0d8cf" strokeWidth={stroke} />
      {unlimited
        ? <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} />
        : <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      }
    </svg>
  );
};

const Avatar: React.FC<{ email: string; tier: string }> = ({ email, tier }) => {
  const gradients: Record<string, string> = {
    free: 'from-gray-700 to-gray-500', pro: 'from-amber-500 to-orange-500', enterprise: 'from-blue-600 to-sky-500',
  };
  return (
    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradients[tier] || gradients.free} flex items-center justify-center shadow-md shrink-0`}>
      <span className="font-serif font-black text-2xl text-white">{email.slice(0, 2).toUpperCase()}</span>
    </div>
  );
};

// ── Translations ──────────────────────────────────────────────────────────────

const PT = {
  de: {
    back: '← Zurück', title: 'Mein Konto', member_since: 'Mitglied seit',
    plan_label: 'Plan', email_label: 'E-Mail', usage_title: 'Tagesnutzung',
    usage_unlimited: 'Unbegrenzt', usage_of: (u: number, l: number) => `${u} / ${l} Analysen heute`,
    resets: 'Setzt täglich um Mitternacht UTC zurück', benefits_title: 'Ihr Plan enthält',
    upgrade_title: 'Auf Pro upgraden', upgrade_sub: 'Mehr Analysen · Priorität · Früher Zugang',
    upgrade_cta: 'feedback@neutralnachrichten.com', logout: 'Abmelden', loading: 'Lade Profil…',
    unlimited_badge: 'Unbegrenzt ∞',
    historyLabel: 'Verlauf', historyEmpty: 'Noch keine Analysen gespeichert.',
    historySearch: 'Erneut suchen →', historyDelete: '×',
    profileLabel: 'Dein Leseprofil',
    profileSub: 'Durchschnittliche Medienabdeckung über alle deine Suchanfragen',
    profileNone: 'Analysiere mindestens eine Suchanfrage, um dein Profil zu sehen.',
    profileDominant: (label: string) => `Deine Themen werden am häufigsten von ${label} berichtet.`,
    topicsLabel: 'Häufig gesucht', topicsTime: (n: number) => n === 1 ? '1× gesucht' : `${n}× gesucht`,
    suggestionsLabel: 'Vielleicht interessant', suggestionsSub: 'Themen, die du noch nicht analysiert hast',
    suggestBtn: 'Analysieren →',
    statsTotal: 'Analysen gesamt', statsUnique: 'Unique Themen', statsStreak: 'Aktiv seit',
    statsDay: 'Tag', statsDays: 'Tagen',
    // Tabs
    tabOverview: 'Übersicht', tabHistory: 'Verlauf', tabSettings: 'Einstellungen',
    // Verification
    verifyBanner: 'Bitte bestätige deine E-Mail-Adresse.',
    verifyResend: 'Erneut senden', verifySent: 'Gesendet ✓',
    // Settings
    settingsTitle: 'Kontoeinstellungen',
    pwTitle: 'Passwort ändern', pwCurrent: 'Aktuelles Passwort', pwNew: 'Neues Passwort',
    pwConfirm: 'Passwort bestätigen', pwSave: 'Speichern', pwSaved: 'Passwort gespeichert ✓',
    emailTitle: 'E-Mail ändern', emailNew: 'Neue E-Mail-Adresse', emailPw: 'Passwort bestätigen',
    emailSave: 'E-Mail ändern', emailSaved: 'E-Mail geändert. Bitte bestätige die neue Adresse.',
    exportTitle: 'Daten exportieren', exportSub: 'Lade alle deine Daten als JSON-Datei herunter (DSGVO Art. 20).',
    exportBtn: 'Daten herunterladen',
    dangerTitle: 'Konto löschen', dangerSub: 'Diese Aktion ist unwiderruflich. Alle deine Daten werden gelöscht.',
    dangerConfirm: 'Passwort zur Bestätigung', dangerBtn: 'Konto endgültig löschen',
    dangerCancel: 'Abbrechen', dangerOpen: 'Konto löschen…',
  },
  en: {
    back: '← Back', title: 'My Account', member_since: 'Member since',
    plan_label: 'Plan', email_label: 'Email', usage_title: 'Daily Usage',
    usage_unlimited: 'Unlimited', usage_of: (u: number, l: number) => `${u} / ${l} analyses today`,
    resets: 'Resets daily at midnight UTC', benefits_title: 'Your plan includes',
    upgrade_title: 'Upgrade to Pro', upgrade_sub: 'More analyses · Priority · Early access',
    upgrade_cta: 'feedback@neutralnachrichten.com', logout: 'Log out', loading: 'Loading profile…',
    unlimited_badge: 'Unlimited ∞',
    historyLabel: 'History', historyEmpty: 'No analyses saved yet.',
    historySearch: 'Search again →', historyDelete: '×',
    profileLabel: 'Your reading profile',
    profileSub: 'Average media coverage across all your searches',
    profileNone: 'Analyse at least one topic to see your profile.',
    profileDominant: (label: string) => `Your topics are most often covered by ${label}.`,
    topicsLabel: 'Most searched', topicsTime: (n: number) => n === 1 ? 'searched once' : `searched ${n}×`,
    suggestionsLabel: 'You might like', suggestionsSub: 'Topics you haven\'t analysed yet',
    suggestBtn: 'Analyse →',
    statsTotal: 'Total analyses', statsUnique: 'Unique topics', statsStreak: 'Active for',
    statsDay: 'day', statsDays: 'days',
    tabOverview: 'Overview', tabHistory: 'History', tabSettings: 'Settings',
    verifyBanner: 'Please verify your email address.',
    verifyResend: 'Resend', verifySent: 'Sent ✓',
    settingsTitle: 'Account settings',
    pwTitle: 'Change password', pwCurrent: 'Current password', pwNew: 'New password',
    pwConfirm: 'Confirm password', pwSave: 'Save', pwSaved: 'Password saved ✓',
    emailTitle: 'Change email', emailNew: 'New email address', emailPw: 'Confirm password',
    emailSave: 'Change email', emailSaved: 'Email changed. Please verify your new address.',
    exportTitle: 'Export data', exportSub: 'Download all your data as a JSON file (GDPR Art. 20).',
    exportBtn: 'Download data',
    dangerTitle: 'Delete account', dangerSub: 'This action is irreversible. All your data will be deleted.',
    dangerConfirm: 'Enter password to confirm', dangerBtn: 'Delete account permanently',
    dangerCancel: 'Cancel', dangerOpen: 'Delete account…',
  },
  ru: {
    back: '← Назад', title: 'Мой аккаунт', member_since: 'С нами с',
    plan_label: 'Тариф', email_label: 'E-mail', usage_title: 'Использование сегодня',
    usage_unlimited: 'Безлимитно', usage_of: (u: number, l: number) => `${u} / ${l} анализов сегодня`,
    resets: 'Сбрасывается каждый день в полночь UTC', benefits_title: 'Ваш тариф включает',
    upgrade_title: 'Перейти на Pro', upgrade_sub: 'Больше анализов · Приоритет · Ранний доступ',
    upgrade_cta: 'feedback@neutralnachrichten.com', logout: 'Выйти', loading: 'Загрузка профиля…',
    unlimited_badge: 'Безлимитно ∞',
    historyLabel: 'История', historyEmpty: 'Пока нет сохранённых анализов.',
    historySearch: 'Искать снова →', historyDelete: '×',
    profileLabel: 'Ваш профиль чтения',
    profileSub: 'Среднее медиапокрытие по всем вашим запросам',
    profileNone: 'Проанализируйте хотя бы одну тему, чтобы увидеть профиль.',
    profileDominant: (label: string) => `Ваши темы чаще всего освещаются лагерем: ${label}.`,
    topicsLabel: 'Часто ищете', topicsTime: (n: number) => `${n}× найдено`,
    suggestionsLabel: 'Возможно интересно', suggestionsSub: 'Темы, которые вы ещё не анализировали',
    suggestBtn: 'Анализировать →',
    statsTotal: 'Анализов всего', statsUnique: 'Уникальных тем', statsStreak: 'Активны уже',
    statsDay: 'день', statsDays: 'дней',
    tabOverview: 'Обзор', tabHistory: 'История', tabSettings: 'Настройки',
    verifyBanner: 'Пожалуйста, подтвердите ваш email.',
    verifyResend: 'Отправить снова', verifySent: 'Отправлено ✓',
    settingsTitle: 'Настройки аккаунта',
    pwTitle: 'Изменить пароль', pwCurrent: 'Текущий пароль', pwNew: 'Новый пароль',
    pwConfirm: 'Подтвердите пароль', pwSave: 'Сохранить', pwSaved: 'Пароль сохранён ✓',
    emailTitle: 'Изменить email', emailNew: 'Новый email', emailPw: 'Подтвердите пароль',
    emailSave: 'Изменить email', emailSaved: 'Email изменён. Подтвердите новый адрес.',
    exportTitle: 'Экспорт данных', exportSub: 'Скачайте все ваши данные в формате JSON (GDPR ст. 20).',
    exportBtn: 'Скачать данные',
    dangerTitle: 'Удалить аккаунт', dangerSub: 'Это действие необратимо. Все ваши данные будут удалены.',
    dangerConfirm: 'Введите пароль для подтверждения', dangerBtn: 'Удалить аккаунт навсегда',
    dangerCancel: 'Отмена', dangerOpen: 'Удалить аккаунт…',
  },
};

// ── Field component ───────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}> = ({ label, type = 'text', value, onChange, placeholder }) => (
  <div>
    <label className="block font-sans text-[10px] uppercase tracking-widest text-gray-500 mb-1">{label}</label>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border-b-2 border-[#1a1a1a] bg-transparent py-2 font-sans text-sm focus:outline-none focus:border-blue-600 placeholder:text-gray-300"
    />
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props { lang: Language; authToken: string | null; authUser: AuthUser | null; onLogout: () => void; onAuthUpdate?: (token: string, user: AuthUser) => void; }

export default function UserProfilePage({ lang, authToken, authUser, onLogout, onAuthUpdate }: Props) {
  const pt = PT[lang];
  const navigate = useNavigate();

  // Data
  const [userData, setUserData]   = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Resend verification
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent]       = useState(false);

  // Change password
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew]         = useState('');
  const [cpNew2, setCpNew2]       = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError]     = useState('');
  const [cpOk, setCpOk]           = useState(false);

  // Change email
  const [ceEmail, setCeEmail]       = useState('');
  const [cePassword, setCePassword] = useState('');
  const [ceLoading, setCeLoading]   = useState(false);
  const [ceError, setCeError]       = useState('');
  const [ceOk, setCeOk]             = useState(false);

  // Delete account
  const [showDel, setShowDel]       = useState(false);
  const [delPw, setDelPw]           = useState('');
  const [delLoading, setDelLoading] = useState(false);
  const [delError, setDelError]     = useState('');

  // Data export
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (!authToken) { navigate('/', { replace: true }); return; }
    const h = { Authorization: `Bearer ${authToken}` };
    Promise.all([
      fetch(`${API_BASE}/api/auth/me`,    { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/api/auth/usage`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/api/history`,    { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([meRes, usageRes, histRes]) => {
      if (meRes?.user) setUserData(meRes.user);
      if (usageRes)    setUsageData(usageRes);
      if (histRes?.history) setHistory(histRes.history);
      setLoading(false);
    });
  }, [authToken, navigate]);

  if (!authUser) return null;

  const user        = userData || authUser;
  const tier        = (user.tier as string) || 'free';
  const tc          = TIER_CONFIG[tier] || TIER_CONFIG.free;
  const tierLabel   = lang === 'de' ? tc.label_de : lang === 'ru' ? tc.label_ru : tc.label_en;
  const tierBenefits = lang === 'de' ? tc.benefits_de : lang === 'ru' ? tc.benefits_ru : tc.benefits_en;
  const unlimited   = usageData?.unlimited === true || user.daily_limit === -1;
  const dailyLimit  = unlimited ? -1 : (usageData?.limit ?? user.daily_limit ?? 10);
  const usedToday   = usageData?.used ?? 0;
  const remaining   = unlimited ? Infinity : (usageData?.remaining ?? dailyLimit);
  const emailVerified = user.email_verified ?? authUser.email_verified ?? false;

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(
        lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' }
      )
    : null;

  const spectrumProfile = computeSpectrumProfile(history);
  const topTopics       = computeTopTopics(history);
  const suggestions     = computeSuggestions(history);
  const uniqueTopics    = new Set(history.map(e => e.topic.toLowerCase().trim())).size;
  const activeDays      = history.length > 0
    ? Math.max(1, Math.round((Date.now() - new Date(history[history.length - 1].created_at).getTime()) / 86400000))
    : 0;
  const dominantCamp = spectrumProfile
    ? (Object.entries(spectrumProfile).sort(([,a],[,b]) => b - a)[0]?.[0] as SpecKey | undefined)
    : undefined;

  const handleLogout   = () => { onLogout(); navigate('/', { replace: true }); };
  const handleReSearch = (topic: string) => navigate(`/?topic=${encodeURIComponent(topic)}&lang=${lang}`);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/api/history/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` },
      });
      setHistory(prev => prev.filter(e => e.id !== id));
    } finally { setDeletingId(null); }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` },
      });
      setResendSent(true);
    } finally { setResendLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    if (cpNew !== cpNew2) { setCpError(lang === 'ru' ? 'Пароли не совпадают' : lang === 'de' ? 'Passwörter stimmen nicht überein' : 'Passwords do not match'); return; }
    if (cpNew.length < 8) { setCpError(lang === 'ru' ? 'Минимум 8 символов' : lang === 'de' ? 'Mindestens 8 Zeichen' : 'At least 8 characters'); return; }
    setCpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (!res.ok) { setCpError(data.error || 'Error'); return; }
      setCpOk(true);
      setCpCurrent(''); setCpNew(''); setCpNew2('');
      setTimeout(() => setCpOk(false), 3000);
    } catch { setCpError('Connection error'); }
    finally { setCpLoading(false); }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setCeError('');
    setCeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ email: ceEmail, password: cePassword }),
      });
      const data = await res.json();
      if (!res.ok) { setCeError(data.error || 'Error'); return; }
      setCeOk(true);
      if (data.token && data.user && onAuthUpdate) onAuthUpdate(data.token, data.user);
      setCeEmail(''); setCePassword('');
    } catch { setCeError('Connection error'); }
    finally { setCeLoading(false); }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/export`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `neutralnachrichten-export-${Date.now()}.json`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setExportLoading(false); }
  };

  const handleDeleteAccount = async () => {
    setDelError('');
    setDelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ password: delPw }),
      });
      const data = await res.json();
      if (!res.ok) { setDelError(data.error || 'Error'); return; }
      onLogout();
      navigate('/', { replace: true });
    } catch { setDelError('Connection error'); }
    finally { setDelLoading(false); }
  };

  // ── Tab labels ────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: pt.tabOverview },
    { id: 'history',  label: `${pt.tabHistory} (${history.length})` },
    { id: 'settings', label: pt.tabSettings },
  ];

  return (
    <div className="max-w-3xl space-y-5">

      <Link to="/" className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors">
        {pt.back}
      </Link>

      {loading ? (
        <div className="border-2 border-[#1a1a1a] p-14 text-center">
          <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400">{pt.loading}</p>
        </div>
      ) : (<>

        {/* ─── Email verification banner ─────────────────────────────── */}
        {!emailVerified && (
          <div className="border-2 border-amber-400 bg-amber-50 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              <p className="font-sans text-[11px] text-amber-800">{pt.verifyBanner}</p>
            </div>
            <button
              onClick={handleResend}
              disabled={resendLoading || resendSent}
              className="font-sans text-[10px] uppercase tracking-widest text-amber-700 border border-amber-400 px-3 py-1.5 hover:bg-amber-400 hover:text-white transition-colors disabled:opacity-50 shrink-0"
            >
              {resendSent ? pt.verifySent : resendLoading ? '…' : pt.verifyResend}
            </button>
          </div>
        )}

        {/* ─── Hero Card ────────────────────────────────────────────────── */}
        <div className="border-2 border-[#1a1a1a] overflow-hidden">
          <div className={`h-1.5 w-full ${tc.strip}`} />
          <div className="px-6 py-5 flex items-start gap-4">
            <Avatar email={user.email} tier={tier} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-serif font-black text-xl text-[#1a1a1a] truncate">{user.email.split('@')[0]}</p>
                  <p className="font-sans text-[10px] text-gray-400 truncate flex items-center gap-1.5">
                    {user.email}
                    {emailVerified
                      ? <span className="text-emerald-600 text-[9px]">✓</span>
                      : <span className="text-amber-500 text-[9px]">⚠</span>}
                  </p>
                </div>
                <span className={`font-sans text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border ${tc.bg} ${tc.text} ${tc.border} shrink-0`}>
                  {tc.icon} {tierLabel}
                </span>
              </div>
              <div className="flex gap-0.5 mt-2">
                {(['bg-rose-600','bg-orange-400','bg-slate-400','bg-sky-500','bg-blue-700'] as const).map((c,i) => (
                  <div key={i} className={`w-5 h-[3px] ${c}`} />
                ))}
              </div>
              {joinedDate && (
                <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300 mt-1.5">{pt.member_since} {joinedDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Tab Navigation ───────────────────────────────────────────── */}
        <div className="flex border-b-2 border-[#1a1a1a]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`font-sans text-[10px] uppercase tracking-widest px-4 sm:px-6 py-3 transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-gray-500 hover:text-[#1a1a1a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB: OVERVIEW
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (<>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border-2 border-[#1a1a1a] p-4 flex flex-col items-center gap-2">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{pt.usage_title}</p>
              <div className="relative">
                <UsageRing used={usedToday} limit={dailyLimit} unlimited={unlimited} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {unlimited
                    ? <span className="font-serif font-black text-lg text-sky-500">∞</span>
                    : <><span className="font-serif font-black text-lg text-[#1a1a1a] leading-none">{usedToday}</span>
                       <span className="font-sans text-[9px] text-gray-400">/ {dailyLimit}</span></>}
                </div>
              </div>
              {unlimited
                ? <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-sky-600">{pt.usage_unlimited}</span>
                : <span className={`font-sans text-[9px] uppercase tracking-widest font-bold ${remaining === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{remaining} left</span>}
            </div>
            <div className="border-2 border-[#1a1a1a] p-4 flex flex-col justify-between">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{pt.statsTotal}</p>
              <p className="font-serif font-black text-3xl text-[#1a1a1a]">{history.length}</p>
              <div className="h-0.5 w-full bg-[#e0d8cf]" />
            </div>
            <div className="border-2 border-[#1a1a1a] p-4 flex flex-col justify-between">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{pt.statsUnique}</p>
              <p className="font-serif font-black text-3xl text-[#1a1a1a]">{uniqueTopics}</p>
              <div className="h-0.5 w-full bg-[#e0d8cf]" />
            </div>
            <div className="border-2 border-[#1a1a1a] p-4 flex flex-col justify-between">
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{pt.statsStreak}</p>
              <p className="font-serif font-black text-3xl text-[#1a1a1a]">{activeDays}</p>
              <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300">{activeDays === 1 ? pt.statsDay : pt.statsDays}</p>
            </div>
          </div>

          {/* Reading Profile */}
          <div className="border-2 border-[#1a1a1a] overflow-hidden">
            <div className="bg-[#1a1a1a] px-5 py-3 flex items-center justify-between">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.profileLabel}</p>
              {dominantCamp && (
                <span className={`font-sans text-[9px] px-2 py-0.5 ${S_STYLE[dominantCamp].bg} ${S_STYLE[dominantCamp].text} border ${S_STYLE[dominantCamp].border}`}>
                  {S_STYLE[dominantCamp][`label_${lang === 'de' ? 'de' : lang === 'ru' ? 'ru' : 'en'}`]}
                </span>
              )}
            </div>
            {spectrumProfile ? (
              <div className="px-5 py-5 space-y-3">
                <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">{pt.profileSub}</p>
                {SPECTRUM_KEYS.map(k => {
                  const pct = spectrumProfile[k];
                  const st  = S_STYLE[k];
                  const label = st[`label_${lang === 'de' ? 'de' : lang === 'ru' ? 'ru' : 'en'}`];
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        <span className={`font-sans text-[9px] font-bold uppercase tracking-widest ${st.text}`}>{label}</span>
                      </div>
                      <div className="flex-1 bg-[#e0d8cf] h-2 overflow-hidden">
                        <div className={`h-full ${st.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-sans text-[9px] text-gray-400 w-8 text-right tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
                {dominantCamp && (
                  <p className="font-serif text-xs text-gray-400 italic pt-1">
                    {pt.profileDominant(S_STYLE[dominantCamp][`label_${lang === 'de' ? 'de' : lang === 'ru' ? 'ru' : 'en'}`])}
                  </p>
                )}
              </div>
            ) : (
              <div className="px-5 py-6 text-center">
                <p className="font-serif text-sm text-gray-400">{pt.profileNone}</p>
              </div>
            )}
          </div>

          {/* Top Topics + Suggestions */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.topicsLabel}</p>
              </div>
              {topTopics.length > 0 ? (
                <div className="divide-y divide-[#e0d8cf]">
                  {topTopics.map(({ topic, count }) => (
                    <button key={topic} onClick={() => handleReSearch(topic)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#f5f0e8] transition-colors text-left group">
                      <span className="font-serif text-sm text-[#1a1a1a] group-hover:underline truncate flex-1">{topic}</span>
                      <span className="font-sans text-[9px] uppercase tracking-widest text-gray-300 ml-2 shrink-0">
                        {count > 1 && pt.topicsTime(count)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="font-serif text-sm text-gray-400">{pt.historyEmpty}</p>
                </div>
              )}
            </div>
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.suggestionsLabel}</p>
                <p className="font-sans text-[8px] uppercase tracking-widest text-white/40 mt-0.5">{pt.suggestionsSub}</p>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <button key={s} onClick={() => handleReSearch(s)}
                    className="font-sans text-[10px] uppercase tracking-wider border-2 border-[#1a1a1a] px-3 py-1.5 hover:bg-[#1a1a1a] hover:text-white transition-colors">
                    {s} ↗
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Plan + Usage */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.benefits_title}</p>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {tierBenefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-sans text-xs text-[#1a1a1a]">{b}</span>
                  </div>
                ))}
              </div>
            </div>
            {unlimited ? (
              <div className="border-2 border-sky-500 bg-sky-50 overflow-hidden flex flex-col">
                <div className="px-5 py-5 flex items-center gap-4 flex-1">
                  <span className="text-4xl font-black text-sky-300">∞</span>
                  <div>
                    <p className="font-serif font-black text-base text-sky-800">{pt.unlimited_badge}</p>
                    <p className="font-sans text-[10px] text-sky-600 uppercase tracking-wider mt-0.5">{tierBenefits[0]}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-[#1a1a1a] overflow-hidden">
                <div className="bg-[#1a1a1a] px-5 py-3 flex items-center justify-between">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.usage_title}</p>
                  <span className="font-sans text-[10px] text-white/40">{pt.usage_of(usedToday, dailyLimit)}</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: dailyLimit }).map((_, i) => (
                      <div key={i} className={`h-2.5 flex-1 ${
                        i < usedToday
                          ? i < dailyLimit * 0.5 ? 'bg-emerald-500' : i < dailyLimit * 0.8 ? 'bg-orange-400' : 'bg-rose-500'
                          : 'bg-[#e0d8cf]'
                      }`} />
                    ))}
                  </div>
                  <p className="font-sans text-[9px] uppercase tracking-widest text-gray-300">{pt.resets}</p>
                </div>
              </div>
            )}
          </div>

          {tier === 'free' && (
            <div className="border-2 border-amber-400 bg-amber-50 overflow-hidden">
              <div className="bg-amber-400 px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.upgrade_title}</p>
              </div>
              <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="font-sans text-[10px] text-amber-700 uppercase tracking-wider">{pt.upgrade_sub}</p>
                <a href={`mailto:${pt.upgrade_cta}`}
                  className="font-sans text-[10px] font-bold uppercase tracking-widest border-2 border-amber-600 text-amber-700 px-4 py-2 hover:bg-amber-600 hover:text-white transition-colors whitespace-nowrap shrink-0">
                  {pt.upgrade_cta}
                </a>
              </div>
            </div>
          )}
        </>)}

        {/* ════════════════════════════════════════════════════════════════
            TAB: HISTORY
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="border-2 border-[#1a1a1a] overflow-hidden">
            <div className="bg-[#1a1a1a] px-5 py-3 flex items-center justify-between">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.historyLabel}</p>
              <span className="font-sans text-[9px] text-white/40">{history.length}</span>
            </div>
            {history.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="font-sans text-[10px] uppercase tracking-widest text-gray-300 mb-3">{pt.historyEmpty}</p>
                <Link to="/" className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a] underline">
                  {lang === 'de' ? 'Erste Analyse starten →' : lang === 'ru' ? 'Начать первый анализ →' : 'Start your first analysis →'}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#e0d8cf] max-h-[70vh] overflow-y-auto">
                {history.map(entry => {
                  const cd = entry.coverage_json;
                  const dom = cd
                    ? (Object.entries(cd).sort(([,a],[,b]) => (b as {percent:number}).percent - (a as {percent:number}).percent)[0]?.[0] as SpecKey | undefined)
                    : undefined;
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f9f5f0] group transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${dom ? S_STYLE[dom].dot : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-sm text-[#1a1a1a] truncate">{entry.topic}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-sans text-[9px] uppercase tracking-widest text-gray-300">{entry.lang.toUpperCase()}</span>
                          <span className="text-gray-200">·</span>
                          <span className="font-sans text-[9px] text-gray-300">{relativeTime(entry.created_at, lang)}</span>
                          {dom && (
                            <>
                              <span className="text-gray-200">·</span>
                              <span className={`font-sans text-[8px] uppercase tracking-widest ${S_STYLE[dom].text}`}>
                                {S_STYLE[dom][`label_${lang === 'de' ? 'de' : lang === 'ru' ? 'ru' : 'en'}`]}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => handleReSearch(entry.topic)}
                          className="font-sans text-[9px] uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] transition-colors">
                          {pt.historySearch}
                        </button>
                        <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                          className="font-sans text-base text-gray-300 hover:text-rose-500 transition-colors leading-none disabled:opacity-40">
                          {pt.historyDelete}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: SETTINGS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-4">

            {/* Change Password */}
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.pwTitle}</p>
              </div>
              <form onSubmit={handleChangePassword} className="px-5 py-5 space-y-4">
                <Field label={pt.pwCurrent} type="password" value={cpCurrent} onChange={setCpCurrent} />
                <Field label={pt.pwNew}     type="password" value={cpNew}     onChange={setCpNew}     placeholder="Min. 8 Zeichen" />
                <Field label={pt.pwConfirm} type="password" value={cpNew2}    onChange={setCpNew2} />
                {cpError && <p className="font-sans text-[11px] text-rose-600 border border-rose-100 bg-rose-50 px-3 py-2">{cpError}</p>}
                {cpOk    && <p className="font-sans text-[11px] text-emerald-600 border border-emerald-100 bg-emerald-50 px-3 py-2">{pt.pwSaved}</p>}
                <button type="submit" disabled={cpLoading}
                  className="bg-[#1a1a1a] text-white font-sans text-[10px] uppercase tracking-widest px-6 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40">
                  {cpLoading ? '…' : pt.pwSave}
                </button>
              </form>
            </div>

            {/* Change Email */}
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.emailTitle}</p>
              </div>
              {ceOk ? (
                <div className="px-5 py-5">
                  <p className="font-sans text-[11px] text-emerald-600 border border-emerald-100 bg-emerald-50 px-3 py-2">{pt.emailSaved}</p>
                </div>
              ) : (
                <form onSubmit={handleChangeEmail} className="px-5 py-5 space-y-4">
                  <Field label={pt.emailNew} type="email"    value={ceEmail}    onChange={setCeEmail}    placeholder={user.email} />
                  <Field label={pt.emailPw}  type="password" value={cePassword} onChange={setCePassword} />
                  {ceError && <p className="font-sans text-[11px] text-rose-600 border border-rose-100 bg-rose-50 px-3 py-2">{ceError}</p>}
                  <button type="submit" disabled={ceLoading}
                    className="bg-[#1a1a1a] text-white font-sans text-[10px] uppercase tracking-widest px-6 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40">
                    {ceLoading ? '…' : pt.emailSave}
                  </button>
                </form>
              )}
            </div>

            {/* Data Export */}
            <div className="border-2 border-[#1a1a1a] overflow-hidden">
              <div className="bg-[#1a1a1a] px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.exportTitle}</p>
              </div>
              <div className="px-5 py-5 flex items-center justify-between gap-4 flex-wrap">
                <p className="font-sans text-xs text-gray-500">{pt.exportSub}</p>
                <button onClick={handleExport} disabled={exportLoading}
                  className="font-sans text-[10px] uppercase tracking-widest border-2 border-[#1a1a1a] px-5 py-2.5 hover:bg-[#1a1a1a] hover:text-white transition-colors disabled:opacity-40 shrink-0">
                  {exportLoading ? '…' : `↓ ${pt.exportBtn}`}
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="border-2 border-rose-200 overflow-hidden">
              <div className="bg-rose-600 px-5 py-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{pt.dangerTitle}</p>
              </div>
              <div className="px-5 py-5">
                <p className="font-sans text-xs text-gray-500 mb-4">{pt.dangerSub}</p>
                {!showDel ? (
                  <button onClick={() => setShowDel(true)}
                    className="font-sans text-[10px] uppercase tracking-widest text-rose-600 border-2 border-rose-300 px-5 py-2.5 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors">
                    {pt.dangerOpen}
                  </button>
                ) : (
                  <div className="space-y-3 border border-rose-200 bg-rose-50 p-4">
                    <Field label={pt.dangerConfirm} type="password" value={delPw} onChange={setDelPw} />
                    {delError && <p className="font-sans text-[11px] text-rose-600">{delError}</p>}
                    <div className="flex gap-3">
                      <button onClick={handleDeleteAccount} disabled={delLoading || !delPw}
                        className="font-sans text-[10px] uppercase tracking-widest bg-rose-600 text-white px-5 py-2.5 hover:bg-rose-700 transition-colors disabled:opacity-40">
                        {delLoading ? '…' : pt.dangerBtn}
                      </button>
                      <button onClick={() => { setShowDel(false); setDelPw(''); setDelError(''); }}
                        className="font-sans text-[10px] uppercase tracking-widest text-gray-500 hover:text-[#1a1a1a] transition-colors px-3">
                        {pt.dangerCancel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ─── Logout ────────────────────────────────────────────────────── */}
        <div className="border-t-2 border-[#1a1a1a] pt-4">
          <button onClick={handleLogout}
            className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-rose-600 transition-colors flex items-center gap-2">
            <span>×</span> {pt.logout}
          </button>
        </div>

      </>)}
    </div>
  );
}
