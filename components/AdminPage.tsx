import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AdminStats {
  server: {
    startedAt: string;
    uptime_hours: number;
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: string;
    errors: number;
    cachedItems: number;
    dbAvailable: boolean;
  };
  usage: {
    today: string;
    totalAnalysesAllTime: number;
    totalAnalysesToday: number;
    uniqueTopicsAllTime: number;
    activeIPsToday: number;
    freeDailyLimit: number;
  };
  costs: {
    estimatedTokensToday: number;
    estimatedCostToday: string;
    estimatedCostMonth: string;
    costPerAnalysis: string;
    note: string;
  };
  topTopics: Array<{ topic: string; count: number; first_seen?: string; last_seen?: string }>;
  topIPs: Array<{ ip: string; count: number; tokensEstimate: number }>;
  users: Array<{
    id: number;
    email: string;
    tier: string;
    daily_limit: number;
    created_at: string;
    last_login: string | null;
    search_count: string;
  }>;
  hourlyLast24h: Array<{ hour: string; count: string }>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border-2 border-[#1a1a1a] p-4 bg-[#FFF8F0]">
      <p className="font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50 mb-1">{label}</p>
      <p className="font-serif font-black text-3xl text-[#1a1a1a]">{value}</p>
      {sub && <p className="font-sans text-[10px] text-[#1a1a1a]/40 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[#1a1a1a]">
      <div className="bg-[#1a1a1a] px-4 py-2">
        <h3 className="font-sans text-xs uppercase tracking-widest text-[#FFF8F0]">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── User management section with inline tier editor ──────────────────────────
interface UserRowProps {
  u: AdminStats['users'][0];
  adminKey: string;
  onSaved: () => void;
}

function UserRow({ u, adminKey, onSaved }: UserRowProps) {
  const [editing, setEditing] = useState(false);
  const [tier, setTier] = useState(u.tier);
  const [limit, setLimit] = useState(String(u.daily_limit));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ tier, daily_limit: parseInt(limit) }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Fehler'); return; }
      setEditing(false);
      onSaved();
    } catch { setErr('Netzwerkfehler'); }
    finally { setSaving(false); }
  }

  const tierCls = (t: string) =>
    t === 'pro' ? 'border-amber-500 text-amber-700 bg-amber-50' :
    t === 'enterprise' ? 'border-blue-500 text-blue-700 bg-blue-50' :
    'border-[#1a1a1a]/20 text-[#1a1a1a]/60';

  const isUnlimited = parseInt(limit) === -1;

  return (
    <tr className="hover:bg-[#e8e0d5]/50 transition-colors align-top">
      <td className="py-2.5 pr-3 font-mono text-xs text-[#1a1a1a]/40 whitespace-nowrap">{u.id}</td>
      <td className="py-2.5 pr-3 font-serif text-sm text-[#1a1a1a]">{u.email}</td>

      <td className="py-2.5 pr-3">
        {editing ? (
          <select
            value={tier}
            onChange={e => setTier(e.target.value)}
            className="font-sans text-[10px] border border-[#1a1a1a] px-1.5 py-0.5 bg-white"
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="enterprise">enterprise</option>
          </select>
        ) : (
          <span className={`font-sans text-[10px] uppercase tracking-widest px-2 py-0.5 border ${tierCls(u.tier)}`}>
            {u.tier}
          </span>
        )}
      </td>

      <td className="py-2.5 pr-3 font-serif text-sm text-[#1a1a1a]">{u.search_count}</td>

      <td className="py-2.5 pr-3">
        {editing ? (
          <div className="space-y-1">
            <input
              type="number"
              value={limit}
              onChange={e => setLimit(e.target.value)}
              className="font-sans text-xs border border-[#1a1a1a] px-1.5 py-0.5 w-20 bg-white"
              placeholder="10"
            />
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isUnlimited}
                onChange={e => setLimit(e.target.checked ? '-1' : '10')}
                className="w-3 h-3"
              />
              <span className="font-sans text-[9px] text-sky-600 uppercase tracking-widest">∞ Unbegrenzt</span>
            </label>
          </div>
        ) : (
          <span className={`font-serif text-sm ${parseInt(String(u.daily_limit)) === -1 ? 'text-sky-600 font-bold' : 'text-[#1a1a1a]/60'}`}>
            {parseInt(String(u.daily_limit)) === -1 ? '∞' : u.daily_limit}
          </span>
        )}
      </td>

      <td className="py-2.5 pr-3 font-sans text-xs text-[#1a1a1a]/50 whitespace-nowrap">
        {new Date(u.created_at).toLocaleDateString('de-DE')}
      </td>
      <td className="py-2.5 pr-3 font-sans text-xs text-[#1a1a1a]/50 whitespace-nowrap">
        {u.last_login ? new Date(u.last_login).toLocaleDateString('de-DE') : '—'}
      </td>

      <td className="py-2.5">
        {editing ? (
          <div className="flex gap-2 items-center">
            <button
              onClick={save}
              disabled={saving}
              className="font-sans text-[9px] uppercase tracking-widest border border-emerald-500 text-emerald-700 px-2 py-0.5 hover:bg-emerald-50 disabled:opacity-40"
            >
              {saving ? '…' : '✓ Speichern'}
            </button>
            <button
              onClick={() => { setEditing(false); setTier(u.tier); setLimit(String(u.daily_limit)); setErr(''); }}
              className="font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a]/40 hover:text-rose-600"
            >
              ×
            </button>
            {err && <span className="font-sans text-[9px] text-rose-600">{err}</span>}
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-sans text-[9px] uppercase tracking-widest border border-[#1a1a1a]/20 text-[#1a1a1a]/50 px-2 py-0.5 hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-colors"
          >
            Bearbeiten
          </button>
        )}
      </td>
    </tr>
  );
}

function UserManagementSection({
  users,
  adminKey,
  onRefresh,
}: {
  users: AdminStats['users'];
  adminKey: string;
  onRefresh: () => void;
}) {
  return (
    <Section title={`Registrierte Nutzer (${users.length}) — Tier & Limit verwalten`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#1a1a1a]">
              {['ID', 'E-Mail', 'Tier', 'Suchen', 'Limit/Tag', 'Registriert', 'Login', ''].map(h => (
                <th key={h} className="text-left py-2 pr-3 font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e0d8cf]">
            {users.map(u => (
              <UserRow key={u.id} u={u} adminKey={adminKey} onSaved={onRefresh} />
            ))}
          </tbody>
        </table>
        <p className="font-sans text-[9px] uppercase tracking-widest text-[#1a1a1a]/30 mt-3">
          Limit -1 = unbegrenzte Analysen · Tier-Änderungen werden sofort aktiv (nach erneutem Login)
        </p>
      </div>
    </Section>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('adminKey') || '');
  const [keyInput, setKeyInput] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStats = useCallback(async (key: string) => {
    if (!key) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { 'x-admin-key': key },
      });
      if (res.status === 403) {
        setError('Ungültiger Admin-Schlüssel');
        setAdminKey('');
        localStorage.removeItem('adminKey');
        return;
      }
      const data = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30s when logged in
  useEffect(() => {
    if (!adminKey) return;
    fetchStats(adminKey);
    const iv = setInterval(() => fetchStats(adminKey), 30000);
    return () => clearInterval(iv);
  }, [adminKey, fetchStats]);

  function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('adminKey', keyInput);
    setAdminKey(keyInput);
  }

  // ── Login screen ──────────────────────────────────────────────────────────────
  if (!adminKey) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-[#1a1a1a] px-6 py-4 mb-0">
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 mb-0.5">
              NeutralNachrichten
            </p>
            <h1 className="font-serif font-black text-2xl text-[#FFF8F0]">Admin-Zugang</h1>
          </div>
          <div className="h-1 flex">
            <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
            <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
            <div className="flex-1 bg-blue-700" />
          </div>
          <form
            onSubmit={handleKeySubmit}
            className="border-2 border-t-0 border-[#1a1a1a] p-6 space-y-4 bg-[#FFF8F0]"
          >
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest text-[#1a1a1a]/60 mb-1">
                Admin-Schlüssel
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="ADMIN_KEY"
                className="w-full border-2 border-[#1a1a1a] bg-white px-3 py-2.5 font-mono text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]"
              />
            </div>
            {error && (
              <p className="font-serif text-sm text-rose-600">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-[#1a1a1a] text-[#FFF8F0] py-3 font-sans text-xs uppercase tracking-widest hover:bg-[#333] transition-colors"
            >
              Zugang
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
        <p className="font-serif text-[#1a1a1a]/50 animate-pulse">Lade Statistiken…</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="font-serif text-rose-600 mb-4">{error}</p>
          <button
            onClick={() => { setAdminKey(''); setKeyInput(''); }}
            className="border-2 border-[#1a1a1a] px-4 py-2 font-sans text-xs uppercase tracking-widest hover:bg-[#1a1a1a] hover:text-[#FFF8F0] transition-colors"
          >
            Erneut anmelden
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { server, usage, costs, topTopics, topIPs, users, hourlyLast24h } = stats;

  // Build simple bar chart data
  const maxHourly = Math.max(...(hourlyLast24h ?? []).map(h => parseInt(h.count) || 0), 1);

  return (
    <div className="min-h-screen bg-[#e8e0d5]">
      {/* Header */}
      <div className="bg-[#1a1a1a] text-[#FFF8F0]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
              NeutralNachrichten
            </p>
            <h1 className="font-serif font-black text-2xl">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            {loading && (
              <span className="font-sans text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 animate-pulse">
                Aktualisiere…
              </span>
            )}
            {lastRefresh && (
              <span className="font-sans text-[10px] text-[#FFF8F0]/40">
                Zuletzt: {lastRefresh.toLocaleTimeString('de-DE')}
              </span>
            )}
            <button
              onClick={() => fetchStats(adminKey)}
              className="border border-[#FFF8F0]/20 px-3 py-1.5 font-sans text-[10px] uppercase tracking-widest hover:bg-[#FFF8F0]/10 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => { setAdminKey(''); localStorage.removeItem('adminKey'); }}
              className="border border-rose-500/40 text-rose-400 px-3 py-1.5 font-sans text-[10px] uppercase tracking-widest hover:bg-rose-500/10 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
        <div className="h-0.5 flex">
          <div className="flex-1 bg-rose-600"/><div className="flex-1 bg-orange-400"/>
          <div className="flex-1 bg-slate-400"/><div className="flex-1 bg-sky-500"/>
          <div className="flex-1 bg-blue-700"/>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-3 py-1 border ${server.dbAvailable ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-amber-500 text-amber-700 bg-amber-50'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${server.dbAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {server.dbAvailable ? 'PostgreSQL verbunden' : 'Kein DB (nur RAM)'}
          </span>
          <span className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-3 py-1 border border-sky-500 text-sky-700 bg-sky-50">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Uptime {server.uptime_hours}h
          </span>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Analysen gesamt" value={usage.totalAnalysesAllTime.toLocaleString()} sub="Alle Zeiten" />
          <StatCard label="Analysen heute" value={usage.totalAnalysesToday} sub={usage.today} />
          <StatCard label="Cache-Trefferquote" value={server.cacheHitRate} sub={`${server.cacheHits} Hits / ${server.cacheMisses} Misses`} />
          <StatCard label="Fehler" value={server.errors} sub={`${server.cachedItems} Einträge im Cache`} />
        </div>

        {/* Costs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Geschätzte Kosten heute" value={costs.estimatedCostToday} sub={costs.note} />
          <StatCard label="Hochrechnung Monat" value={costs.estimatedCostMonth} sub="Basierend auf heutigem Volumen" />
          <StatCard label="Kosten pro Analyse" value={costs.costPerAnalysis} sub={`${costs.estimatedTokensToday.toLocaleString()} Tokens heute`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly chart */}
          {hourlyLast24h && hourlyLast24h.length > 0 && (
            <Section title="Analysen — letzte 24 Stunden">
              <div className="flex items-end gap-1 h-32">
                {hourlyLast24h.map((h, i) => {
                  const count = parseInt(h.count) || 0;
                  const pct = maxHourly > 0 ? (count / maxHourly) * 100 : 0;
                  const hour = new Date(h.hour).getUTCHours();
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${hour}:00 — ${count} Analysen`}>
                      <div
                        className="w-full bg-[#1a1a1a] transition-all"
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                      {i % 4 === 0 && (
                        <span className="font-sans text-[8px] text-[#1a1a1a]/40">{hour}h</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Top IPs */}
          {topIPs && topIPs.length > 0 && (
            <Section title={`Aktivste IPs heute (${usage.freeDailyLimit}/Tag Limit)`}>
              <div className="divide-y divide-[#e0d8cf]">
                {topIPs.map((ip, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-sans text-[10px] text-[#1a1a1a]/40 w-5">{i + 1}</span>
                      <span className="font-mono text-sm text-[#1a1a1a]">{ip.ip}</span>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className="font-serif text-sm text-[#1a1a1a]">{ip.count}×</span>
                      <span className="font-sans text-[10px] text-[#1a1a1a]/40">
                        ~{(ip.tokensEstimate / 1000).toFixed(1)}k tokens
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Top Topics */}
        <Section title={`Top ${topTopics.length} Themen`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y divide-[#e0d8cf] md:divide-y-0">
            {topTopics.map((t, i) => {
              const maxCount = topTopics[0]?.count || 1;
              const pct = Math.round((t.count / maxCount) * 100);
              return (
                <div key={t.topic} className="flex items-center gap-3 py-2.5 border-b border-[#e0d8cf]">
                  <span className="font-serif font-black text-sm text-[#1a1a1a]/30 w-6 shrink-0">
                    {i < 3 ? ['①', '②', '③'][i] : `${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-sm text-[#1a1a1a] truncate capitalize">{t.topic}</p>
                    <div className="mt-1 h-1 bg-[#e0d8cf]">
                      <div className="h-full bg-[#1a1a1a]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="font-serif text-sm font-bold text-[#1a1a1a] shrink-0">{t.count}×</span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Users */}
        {users && users.length > 0 && (
          <UserManagementSection users={users} adminKey={adminKey} onRefresh={() => fetchStats(adminKey)} />
        )}

        {/* Server info */}
        <Section title="Server-Details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs text-[#1a1a1a]/60">
            <div>
              <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40">Gestartet</p>
              <p className="font-serif text-[#1a1a1a]">{new Date(server.startedAt).toLocaleString('de-DE')}</p>
            </div>
            <div>
              <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40">Requests gesamt</p>
              <p className="font-serif text-[#1a1a1a]">{server.totalRequests.toLocaleString()}</p>
            </div>
            <div>
              <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40">Cache-Einträge</p>
              <p className="font-serif text-[#1a1a1a]">{server.cachedItems}</p>
            </div>
            <div>
              <p className="uppercase tracking-widest mb-1 text-[#1a1a1a]/40">Aktive IPs heute</p>
              <p className="font-serif text-[#1a1a1a]">{usage.activeIPsToday}</p>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
