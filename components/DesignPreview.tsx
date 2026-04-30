import React, { useState } from 'react';
import { Language } from '../translations';

interface Props { lang: Language }

const VARIANTS = [
  { id: 'dark-editorial', label: '① Dark Editorial' },
  { id: 'glass',          label: '② Glass / Linear' },
  { id: 'newspaper',      label: '③ Newspaper' },
  { id: 'dashboard',      label: '④ Dashboard' },
  { id: 'aurora',         label: '⑤ Aurora / AI' },
  { id: 'brutalist',      label: '⑥ Brutalist' },
  { id: 'minimal-japan',  label: '⑦ Minimal Japan' },
  { id: 'split-hero',     label: '⑧ Split Hero' },
  { id: 'magazine',       label: '⑨ Magazine' },
];

/* ─── shared mock data ─── */
const MOCK_TOPICS = ['Bundeshaushalt 2027', 'Iran-Krieg', 'Inflation April', 'Bürgergeld'];
const MOCK_NEWS = [
  { cat: 'Wirtschaft', title: 'Inflationsrate steigt auf 2,9 Prozent', src: 'Bundesamt' },
  { cat: 'Politik',    title: 'Kabinett beschließt Sparpaket',          src: 'BMG' },
  { cat: 'International', title: 'Deutschland bewirbt UN-Sicherheitsrat', src: 'Auswärtiges Amt' },
];
const SPECTRUM = [
  { key: 'left',         label: 'Links',        color: '#e11d48' },
  { key: 'center_left',  label: 'Mitte-Links',  color: '#f97316' },
  { key: 'center',       label: 'Mitte',        color: '#64748b' },
  { key: 'center_right', label: 'Mitte-Rechts', color: '#0ea5e9' },
  { key: 'right',        label: 'Rechts',        color: '#1d4ed8' },
];

/* ═══════════════════════════════════════════════════
   VARIANT 1 — Dark Editorial
   Referenz: The Economist, taz-dark
═══════════════════════════════════════════════════ */
function DarkEditorial() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 h-14 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center font-bold text-sm">N</div>
          <span className="font-bold text-lg tracking-tight">NeutraleNachrichten</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-zinc-400">
          <span className="hover:text-white cursor-pointer">⚖️ Vergleichen</span>
          <div className="flex gap-1">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-2.5 py-1 rounded text-xs font-bold ${l==='DE' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-14 flex gap-10">
        <div className="flex-1">
          {/* Red rule */}
          <div className="w-12 h-1 bg-red-600 mb-6" />
          <h1 className="text-5xl font-black leading-[1.05] mb-5 tracking-tight">
            So berichten deutsche<br/>Medien über dasselbe<br/>
            <span className="text-red-500">Thema</span> — unterschiedlich.
          </h1>
          <p className="text-zinc-400 text-base mb-8">Von taz bis Welt · Echtzeit · 3 Sprachen · Unabhängig</p>

          {/* Search */}
          <div className="flex gap-2">
            <input
              readOnly
              placeholder="Thema eingeben (z.B. 'Heizungsgesetz')..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-red-600"
            />
            <button className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-lg text-sm font-bold transition-colors">
              Analysieren →
            </button>
          </div>

          {/* Pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {MOCK_TOPICS.map(t => (
              <span key={t} className="text-xs px-3 py-1 rounded-full border border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-white cursor-pointer transition-colors">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-3">Heute in Deutschland</p>
          <div className="space-y-0 divide-y divide-zinc-800">
            {MOCK_NEWS.map((n, i) => (
              <div key={i} className="py-3">
                <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider">{n.cat}</span>
                <p className="text-sm text-zinc-200 leading-snug mt-0.5">{n.title}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{n.src}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spectrum bar preview */}
      <div className="max-w-5xl mx-auto px-6 pb-12">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Politisches Spektrum</p>
        <div className="flex gap-1 rounded-full overflow-hidden h-2">
          {SPECTRUM.map(s => <div key={s.key} className="flex-1" style={{ background: s.color }} />)}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
          <span>Links</span><span>Mitte</span><span>Rechts</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 2 — Glass / Linear
   Referenz: Vercel, Linear, Raycast
═══════════════════════════════════════════════════ */
function Glass() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="px-6 h-14 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">N</div>
          <span className="font-semibold text-gray-900 tracking-tight">NeutraleNachrichten</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-gray-400">
          <span className="hover:text-gray-700 cursor-pointer text-xs">⚖️ Vergleichen</span>
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-2.5 py-1 rounded-md text-xs font-medium ${l==='DE' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero — gradient blob background */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-100 rounded-full blur-3xl opacity-60" />
          <div className="absolute top-10 right-1/4 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-3 py-1 text-xs text-violet-700 font-medium mb-6">
            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
            Echtzeit · Google Grounding
          </div>

          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-4 tracking-tight">
            Wie berichten deutsche<br/>Medien über{' '}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              dein Thema?
            </span>
          </h1>
          <p className="text-gray-500 text-lg mb-10">Von taz bis Welt — in Ihrer Sprache.</p>

          {/* Glass search bar */}
          <div className="flex gap-2 bg-white rounded-2xl border border-gray-200 shadow-lg shadow-gray-100 p-2">
            <input
              readOnly
              placeholder="Thema eingeben (z.B. 'Heizungsgesetz')..."
              className="flex-1 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent"
            />
            <button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap">
              Analysieren →
            </button>
          </div>

          {/* Topic pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {MOCK_TOPICS.map(t => (
              <span key={t} className="text-xs px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 cursor-pointer transition-all">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Spectrum strip */}
      <div className="max-w-3xl mx-auto px-6 pb-12">
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Politisches Spektrum</p>
          <div className="flex gap-1 rounded-full overflow-hidden h-2.5">
            {SPECTRUM.map(s => <div key={s.key} className="flex-1" style={{ background: s.color }} />)}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-400">
            {SPECTRUM.map(s => <span key={s.key}>{s.label}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 3 — Newspaper / FT / NYT
   Referenz: Financial Times, The Guardian
═══════════════════════════════════════════════════ */
function Newspaper() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] font-serif">
      {/* Top bar */}
      <div className="bg-[#1a1a1a] text-white text-[10px] font-sans uppercase tracking-widest text-center py-1.5">
        Echtzeit · In 3 Sprachen · Unabhängig · Von taz bis Welt
      </div>

      {/* Nav */}
      <nav className="border-b-2 border-[#1a1a1a] px-6 py-3 flex items-center justify-between sticky top-0 bg-[#FFF8F0] z-10">
        <div className="text-[10px] font-sans uppercase tracking-widest text-gray-500">
          Dienstag, 29. April 2026
        </div>
        <div className="text-2xl font-black tracking-tight text-[#1a1a1a]">
          NeutraleNachrichten
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-sans uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#1a1a1a]">⚖ Vergleichen</span>
          <div className="flex gap-0.5 font-sans">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${l==='DE' ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'text-gray-500 border-gray-300 hover:border-[#1a1a1a]'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Thick rule */}
      <div className="h-0.5 bg-[#1a1a1a] mx-6" />

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-8 flex gap-10">
        <div className="flex-1">
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-500 mb-3">Medienanalyse</p>
          <h1 className="text-5xl font-black leading-[1.05] text-[#1a1a1a] mb-4">
            So berichten deutsche Medien über dasselbe Thema — unterschiedlich.
          </h1>
          <div className="h-px bg-gray-300 my-5" />
          <p className="font-sans text-gray-600 text-base mb-6">
            Von taz bis Welt. Analysieren Sie jedes Thema aus fünf politischen Perspektiven — in Echtzeit.
          </p>

          {/* Newspaper-style search */}
          <div className="border-2 border-[#1a1a1a] flex">
            <input
              readOnly
              placeholder="Thema eingeben (z.B. 'Heizungsgesetz', 'Bürgergeld')..."
              className="flex-1 px-4 py-3 text-sm font-sans bg-transparent placeholder-gray-400 focus:outline-none"
            />
            <button className="bg-[#1a1a1a] text-white px-6 py-3 font-sans text-sm font-bold uppercase tracking-wide hover:bg-gray-800 transition-colors">
              Analysieren
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {MOCK_TOPICS.map(t => (
              <span key={t} className="font-sans text-[11px] px-2 py-1 border border-gray-300 text-gray-600 hover:border-[#1a1a1a] cursor-pointer transition-colors">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Column 2 — sidebar news */}
        <div className="w-56 shrink-0 border-l border-gray-300 pl-8">
          <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Heute</p>
          <div className="space-y-4">
            {MOCK_NEWS.map((n, i) => (
              <div key={i} className="pb-4 border-b border-gray-200 last:border-0">
                <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-gray-400">{n.cat}</span>
                <p className="text-sm font-bold leading-snug text-[#1a1a1a] mt-0.5">{n.title}</p>
                <p className="font-sans text-[10px] text-gray-400 mt-0.5">{n.src}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spectrum */}
      <div className="max-w-5xl mx-auto px-6 pb-10">
        <div className="h-px bg-gray-300 mb-5" />
        <div className="flex gap-px overflow-hidden h-3">
          {SPECTRUM.map(s => <div key={s.key} className="flex-1" style={{ background: s.color }} />)}
        </div>
        <div className="flex font-sans text-[9px] text-gray-400 mt-1.5 justify-between">
          {SPECTRUM.map(s => <span key={s.key} className="uppercase tracking-wider">{s.label}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 4 — Dashboard / Bloomberg-lite
   Referenz: Bloomberg Terminal light, Grafana
═══════════════════════════════════════════════════ */
function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-mono">
      {/* Nav */}
      <nav className="bg-slate-800 border-b border-slate-700 px-6 h-12 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-sm font-bold tracking-widest uppercase text-slate-200">NeutraleNachrichten</span>
          <span className="text-[10px] text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded">LIVE</span>
        </div>
        <div className="flex items-center gap-6 text-[11px]">
          <span className="text-slate-400 hover:text-emerald-400 cursor-pointer uppercase tracking-wider">⚖ Compare</span>
          <div className="flex gap-0.5">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${l==='DE' ? 'bg-emerald-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main grid */}
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-3 gap-4">

        {/* Search panel — 2 cols */}
        <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-6">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400 mb-1">MEDIENANALYSE · ECHTZEIT</p>
          <h1 className="text-3xl font-bold text-white leading-tight mb-2">
            Deutsche Medien.<br/>Gleiche Tatsachen.
            <span className="text-emerald-400"> Andere Perspektiven.</span>
          </h1>
          <p className="text-slate-400 text-sm mb-6">Analysiert mit Google Grounding · 5 Spektren · 3 Sprachen</p>

          <div className="flex gap-2">
            <div className="flex-1 bg-slate-700 border border-slate-600 rounded flex items-center px-3 gap-2">
              <span className="text-slate-500 text-sm">›_</span>
              <input
                readOnly
                placeholder="topic_query = 'Heizungsgesetz'..."
                className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-600 py-2.5 focus:outline-none font-mono"
              />
            </div>
            <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-5 py-2.5 rounded font-bold text-sm uppercase tracking-wide transition-colors">
              RUN
            </button>
          </div>

          {/* Topic pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {MOCK_TOPICS.map(t => (
              <span key={t} className="text-[10px] px-2.5 py-1 rounded bg-slate-700 text-slate-400 border border-slate-600 hover:border-emerald-500 hover:text-emerald-400 cursor-pointer transition-all font-mono">
                #{t.replace(/ /g, '_')}
              </span>
            ))}
          </div>
        </div>

        {/* News panel — 1 col */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400">HEUTE</p>
            <span className="text-[9px] text-slate-500">aktualisiert 2h</span>
          </div>
          <div className="space-y-3">
            {MOCK_NEWS.map((n, i) => (
              <div key={i} className="border border-slate-700 rounded p-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">{n.cat}</span>
                <p className="text-xs text-slate-200 leading-snug mt-0.5">{n.title}</p>
                <p className="text-[10px] text-slate-600 mt-1">{n.src}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Spectrum bar — full width */}
        <div className="col-span-3 bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">SPEKTRUM-INDEX</p>
          <div className="flex gap-1 rounded overflow-hidden h-3">
            {SPECTRUM.map(s => <div key={s.key} className="flex-1" style={{ background: s.color }} />)}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-slate-500 uppercase tracking-wider">
            {SPECTRUM.map(s => <span key={s.key}>{s.label}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 5 — Aurora / AI Product
   Referenz: Perplexity, Notion AI, Midjourney
═══════════════════════════════════════════════════ */
function Aurora() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      {/* Nav */}
      <nav className="px-6 h-14 flex items-center justify-between sticky top-0 z-10 bg-[#0a0a0f]/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">N</div>
          <span className="font-semibold tracking-tight">NeutraleNachrichten</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-xs text-white/40 hover:text-white/80 cursor-pointer">⚖️ Vergleichen</span>
          <div className="flex gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/10">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-2.5 py-1 rounded-md text-xs font-bold ${l==='DE' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Aurora glow background */}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-fuchsia-900/40 via-violet-900/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-cyan-900/20 rounded-full blur-3xl" />
          <div className="absolute top-10 right-1/4 w-48 h-48 bg-rose-900/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/50 mb-8 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            Powered by Google Grounding · Echtzeit
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-4">
            <span className="bg-gradient-to-r from-fuchsia-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              Sehen Sie,
            </span>
            <br />
            <span className="text-white">wie Medien wirklich berichten.</span>
          </h1>
          <p className="text-white/40 text-base mb-10">Von taz bis Welt · 5 politische Perspektiven · 3 Sprachen</p>

          {/* Search */}
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-fuchsia-500/20 via-violet-500/20 to-cyan-500/20 blur-lg" />
            <div className="relative flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur">
              <input
                readOnly
                placeholder="Thema eingeben (z.B. 'Heizungsgesetz')..."
                className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 px-3 py-2 focus:outline-none"
              />
              <button className="bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400 text-white px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all">
                Analysieren →
              </button>
            </div>
          </div>

          {/* Pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {MOCK_TOPICS.map(t => (
              <span key={t} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70 cursor-pointer transition-all">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Spectrum */}
      <div className="max-w-2xl mx-auto px-6 pb-10">
        <div className="flex gap-0.5 rounded-full overflow-hidden h-1.5">
          {SPECTRUM.map(s => <div key={s.key} className="flex-1 opacity-70" style={{ background: s.color }} />)}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/20">
          <span>Links</span><span>Mitte</span><span>Rechts</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 6 — Brutalist
   Referenz: Hacker News, Bloomberg old, brutalist.io
═══════════════════════════════════════════════════ */
function Brutalist() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav — thick black bar */}
      <nav className="bg-black text-white px-6 h-12 flex items-center justify-between">
        <span className="font-black text-lg uppercase tracking-widest">NEUTRALE NACHRICHTEN</span>
        <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider">
          <span className="hover:text-yellow-400 cursor-pointer">⚖ Vergleichen</span>
          <div className="flex gap-0 border border-white">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-3 py-1.5 text-xs font-black uppercase ${l==='DE' ? 'bg-yellow-400 text-black' : 'text-white hover:bg-white hover:text-black'} transition-colors`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Yellow accent bar */}
      <div className="h-2 bg-yellow-400" />

      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-8">
        <div className="flex-1">
          {/* Giant number */}
          <div className="text-[120px] font-black leading-none text-gray-100 select-none mb-[-20px]">5</div>
          <h1 className="text-5xl font-black uppercase leading-none mb-6 relative z-10">
            PERSPEKTIVEN.<br/>
            EIN THEMA.<br/>
            <span className="bg-yellow-400 px-1">DIE WAHRHEIT.</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest mb-8">
            Von taz bis Welt · Echtzeit · 3 Sprachen
          </p>

          {/* Block search */}
          <div className="border-2 border-black flex">
            <input
              readOnly
              placeholder="THEMA EINGEBEN..."
              className="flex-1 px-4 py-4 text-sm font-bold uppercase placeholder-gray-300 focus:outline-none tracking-wider"
            />
            <button className="bg-black text-yellow-400 px-6 py-4 font-black uppercase text-sm tracking-widest hover:bg-yellow-400 hover:text-black transition-colors">
              LOS →
            </button>
          </div>

          {/* Block pills */}
          <div className="flex flex-wrap gap-0 mt-4 border-l-2 border-black">
            {MOCK_TOPICS.map(t => (
              <span key={t} className="text-xs px-3 py-1.5 border-r-2 border-b-2 border-black font-bold uppercase text-gray-700 hover:bg-black hover:text-white cursor-pointer transition-colors">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <div className="bg-black text-yellow-400 px-3 py-2 text-[10px] font-black uppercase tracking-widest mb-0">HEUTE</div>
          <div className="border-2 border-t-0 border-black divide-y divide-black">
            {MOCK_NEWS.map((n, i) => (
              <div key={i} className="p-3">
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">{n.cat}</span>
                <p className="text-sm font-bold leading-snug text-black mt-0.5">{n.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spectrum — thick blocks */}
      <div className="max-w-5xl mx-auto px-6 pb-10">
        <div className="flex gap-0 border-2 border-black overflow-hidden h-8">
          {SPECTRUM.map(s => (
            <div key={s.key} className="flex-1 flex items-center justify-center" style={{ background: s.color }}>
              <span className="text-[9px] font-black text-white uppercase tracking-wider">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 7 — Minimal Japan
   Referenz: Muji, Uniqlo, Japanese editorial
═══════════════════════════════════════════════════ */
function MinimalJapan() {
  return (
    <div className="min-h-screen bg-[#f9f7f4] font-sans text-[#1c1c1c]">
      {/* Nav — ultra thin */}
      <nav className="px-8 h-16 flex items-center justify-between border-b border-[#e0ddd8]">
        <span className="text-sm font-medium tracking-[0.15em] text-[#1c1c1c]">NeutraleNachrichten</span>
        <div className="flex items-center gap-6 text-xs text-[#999] tracking-wider">
          <span className="hover:text-[#1c1c1c] cursor-pointer">Vergleichen</span>
          <div className="flex gap-3">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`text-xs tracking-widest ${l==='DE' ? 'text-[#1c1c1c] border-b border-[#1c1c1c]' : 'text-[#bbb] hover:text-[#1c1c1c]'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero — extreme whitespace */}
      <div className="max-w-2xl mx-auto px-8 pt-24 pb-20">
        <p className="text-[10px] tracking-[0.3em] text-[#999] uppercase mb-8">Medienanalyse · Deutschland</p>

        <h1 className="text-4xl font-light leading-relaxed text-[#1c1c1c] mb-8 tracking-tight">
          Wie berichten deutsche Medien<br/>
          über dasselbe Thema?
        </h1>

        <div className="w-12 h-px bg-[#1c1c1c] mb-8" />

        <p className="text-sm text-[#888] leading-loose mb-12 tracking-wide">
          Von taz bis Welt — fünf politische Perspektiven,<br/>
          in Echtzeit, in drei Sprachen.
        </p>

        {/* Minimal search */}
        <div className="flex gap-0 border-b border-[#1c1c1c] pb-1 mb-10">
          <input
            readOnly
            placeholder="Thema eingeben..."
            className="flex-1 bg-transparent text-sm text-[#1c1c1c] placeholder-[#ccc] focus:outline-none tracking-wide py-2"
          />
          <button className="text-xs tracking-[0.2em] uppercase text-[#1c1c1c] font-medium px-4 hover:text-[#666] transition-colors">
            Suchen →
          </button>
        </div>

        {/* Minimal pills */}
        <div className="flex flex-wrap gap-3">
          {MOCK_TOPICS.map(t => (
            <span key={t} className="text-xs tracking-wider text-[#999] hover:text-[#1c1c1c] cursor-pointer transition-colors pb-0.5 border-b border-transparent hover:border-[#1c1c1c]">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* News + spectrum */}
      <div className="max-w-2xl mx-auto px-8 pb-16 border-t border-[#e0ddd8] pt-10">
        <div className="grid grid-cols-3 gap-8 mb-10">
          {MOCK_NEWS.map((n, i) => (
            <div key={i}>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#bbb] mb-2">{n.cat}</p>
              <p className="text-xs leading-relaxed text-[#444]">{n.title}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-0.5 h-px">
          {SPECTRUM.map(s => <div key={s.key} className="flex-1" style={{ background: s.color }} />)}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 8 — Split Hero
   Referenz: Stripe, Pitch, некоторые SaaS лендинги
═══════════════════════════════════════════════════ */
function SplitHero() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      {/* Nav */}
      <nav className="px-8 h-14 flex items-center justify-between border-b border-gray-100 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">N</div>
          <span className="font-semibold text-gray-900">NeutraleNachrichten</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 hover:text-gray-700 cursor-pointer">⚖️ Vergleichen</span>
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-2.5 py-1 rounded-md text-xs font-bold ${l==='DE' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Split body */}
      <div className="flex flex-1">
        {/* LEFT — dark, hero */}
        <div className="w-1/2 bg-indigo-950 text-white px-10 py-16 flex flex-col justify-between">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-indigo-400 mb-6">Medienanalyse · Echtzeit</p>
            <h1 className="text-4xl font-bold leading-tight mb-5">
              So berichten deutsche Medien<br/>über
              <span className="text-indigo-300"> dasselbe Thema</span> —<br/>unterschiedlich.
            </h1>
            <p className="text-indigo-300/60 text-sm mb-10 leading-relaxed">
              Von taz bis Welt. 5 politische Spektren.<br/>3 Sprachen. Unabhängig.
            </p>

            {/* Search */}
            <div className="space-y-3">
              <div className="flex gap-2 bg-white/5 border border-white/10 rounded-xl p-2">
                <input
                  readOnly
                  placeholder="Thema eingeben..."
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 px-3 py-1.5 focus:outline-none"
                />
                <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                  Analysieren →
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {MOCK_TOPICS.map(t => (
                  <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 cursor-pointer transition-all">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Spectrum bottom */}
          <div className="mt-10">
            <div className="flex gap-1 rounded-full overflow-hidden h-1.5">
              {SPECTRUM.map(s => <div key={s.key} className="flex-1 opacity-60" style={{ background: s.color }} />)}
            </div>
          </div>
        </div>

        {/* RIGHT — light, live feed */}
        <div className="w-1/2 bg-gray-50 px-10 py-16 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Heute in Deutschland</p>
          </div>
          <div className="space-y-4">
            {MOCK_NEWS.concat(MOCK_NEWS).slice(0, 5).map((n, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500">{n.cat}</span>
                <p className="text-sm font-semibold text-gray-900 leading-snug mt-1">{n.title}</p>
                <p className="text-xs text-gray-400 mt-1">{n.src} · jetzt</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VARIANT 9 — Magazine / Spiegel / Wired
   Referenz: Spiegel Online, Wired, Vice
═══════════════════════════════════════════════════ */
function Magazine() {
  const CATS = [
    { name: 'Politik',       color: 'bg-red-500' },
    { name: 'Wirtschaft',    color: 'bg-amber-500' },
    { name: 'International', color: 'bg-blue-500' },
    { name: 'Gesellschaft',  color: 'bg-violet-500' },
    { name: 'Umwelt',        color: 'bg-emerald-500' },
  ];
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top banner */}
      <div className="bg-red-600 text-white text-center py-1.5 text-[11px] font-bold uppercase tracking-widest">
        🔴 Live-Analyse · Echtzeit · Unabhängig
      </div>

      {/* Nav */}
      <nav className="px-6 border-b-4 border-gray-900">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14">
          <span className="font-black text-2xl tracking-tight text-gray-900">NEUTRALE<span className="text-red-600">N</span></span>
          <div className="flex items-center gap-1 text-xs font-bold">
            {CATS.map(c => (
              <span key={c.name} className={`px-3 py-1 rounded-full text-white text-[10px] ${c.color} cursor-pointer`}>{c.name}</span>
            ))}
          </div>
          <div className="flex gap-0.5 border-2 border-gray-900">
            {['DE','EN','RU'].map(l => (
              <button key={l} className={`px-2.5 py-1 text-xs font-black uppercase ${l==='DE' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero — big card grid */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Main card */}
          <div className="col-span-2 bg-gray-900 rounded-2xl p-8 flex flex-col justify-between min-h-[280px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-950" />
            <div className="relative">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3 block">Medienanalyse</span>
              <h1 className="text-3xl font-black text-white leading-tight">
                So berichten deutsche Medien<br/>
                <span className="text-red-400">über dasselbe Thema</span> — unterschiedlich.
              </h1>
            </div>
            <div className="relative flex gap-2 mt-4">
              <input
                readOnly
                placeholder="Thema eingeben..."
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none"
              />
              <button className="bg-red-500 hover:bg-red-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap">
                Analysieren →
              </button>
            </div>
          </div>

          {/* Side cards */}
          <div className="flex flex-col gap-4">
            {MOCK_NEWS.slice(0, 2).map((n, i) => (
              <div key={i} className={`rounded-2xl p-5 flex-1 ${i===0 ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${i===0 ? 'text-amber-600' : 'text-blue-600'}`}>{n.cat}</span>
                <p className="font-bold text-gray-900 text-sm leading-snug mt-1">{n.title}</p>
                <p className="text-xs text-gray-500 mt-1">{n.src}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Topic pills row */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider self-center mr-2">Zuletzt:</span>
          {MOCK_TOPICS.map(t => (
            <span key={t} className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-red-600 hover:text-white cursor-pointer transition-all font-medium">
              {t}
            </span>
          ))}
        </div>

        {/* Spectrum */}
        <div className="flex gap-1 rounded-xl overflow-hidden h-3">
          {SPECTRUM.map(s => <div key={s.key} className="flex-1" style={{ background: s.color }} />)}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PREVIEW PAGE
═══════════════════════════════════════════════════ */
export const DesignPreview: React.FC<Props> = () => {
  const [active, setActive] = useState<string>('dark-editorial');

  const COMPONENTS: Record<string, React.FC> = {
    'dark-editorial': DarkEditorial,
    'glass':          Glass,
    'newspaper':      Newspaper,
    'dashboard':      Dashboard,
    'aurora':         Aurora,
    'brutalist':      Brutalist,
    'minimal-japan':  MinimalJapan,
    'split-hero':     SplitHero,
    'magazine':       Magazine,
  };

  const ActiveComponent = COMPONENTS[active];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Switcher bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-1">Вариант:</span>
          {VARIANTS.map(v => (
            <button
              key={v.id}
              onClick={() => setActive(v.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                active === v.id
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {v.label}
            </button>
          ))}
          <a
            href="/"
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← назад
          </a>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1">
        <ActiveComponent />
      </div>
    </div>
  );
};
