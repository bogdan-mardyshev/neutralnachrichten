/**
 * lib/sourceRatingsSeed.js — auditable source classification on THREE axes.
 *
 *   spectrum       — political placement (left … right)
 *   tier           — reach/prominence: flagship | standard | niche
 *   factual_rating — factual quality: high | mixed | low   (orthogonal to spectrum)
 *
 * Each record carries PROVENANCE (rating_source) + a short German rationale (notes)
 * + a confidence, so the UI can show WHY a source sits where it does and how settled
 * that placement is. Borderline rows (confidence ≤ 0.65) are flagged for review
 * rather than hidden.
 *
 * EVIDENCE BASIS (researched, June 2026):
 *   • spectrum + factual: Media Bias/Fact Check (MBFC) where a page exists;
 *     cross-checked with eurotopics + Wikipedia; for fringe outlets the German
 *     Verfassungsschutz / ISD / NewsGuard classifications.
 *   • tier + reach_weight: relative audience reach from IVW/AGOF rankings 2025
 *     (Statista): Bild #1 visits, Focus #1 unique users, Spiegel #2, n-tv #3.
 *     reach_weight is a RELATIVE scale anchored to that ranking (not absolute UU).
 *
 * rating_source legend: 'MBFC' = direct MBFC bias+factual; '+IVW' reach anchored;
 *   'eurotopics/Wikipedia' = editorial cross-ref; 'ISD/NewsGuard/Verfassungsschutz'
 *   = extremism/disinfo classification; 'editorial' = our judgement (needs review).
 */

export const SOURCE_RATINGS = [
  // ── left ────────────────────────────────────────────────────────────────────
  { source_domain: 'taz.de', source_name: 'taz', spectrum: 'left',
    tier: 'standard', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.9, reach_weight: 0.6,
    notes: 'MBFC: Left, High. Linksalternativ, progressiv.' },
  { source_domain: 'nd-aktuell.de', source_name: 'nd-aktuell', spectrum: 'left',
    tier: 'niche', factual_rating: 'mixed', rating_source: 'eurotopics/editorial', confidence: 0.8, reach_weight: 0.3,
    notes: 'Sozialistische Tradition (vormals Neues Deutschland).' },
  { source_domain: 'jungewelt.de', source_name: 'Junge Welt', spectrum: 'left',
    tier: 'niche', factual_rating: 'mixed', rating_source: 'eurotopics/editorial', confidence: 0.8, reach_weight: 0.25,
    notes: 'Marxistisch ausgerichtet, dezidiert links.' },
  { source_domain: 'freitag.de', source_name: 'Der Freitag', spectrum: 'left',
    tier: 'niche', factual_rating: 'high', rating_source: 'eurotopics/Wikipedia', confidence: 0.7, reach_weight: 0.3,
    notes: 'eurotopics: links-liberal; Augstein/taz: „linke Zeitung“.' },
  { source_domain: 'nachdenkseiten.de', source_name: 'NachDenkSeiten', spectrum: 'left',
    tier: 'niche', factual_rating: 'low', rating_source: 'Wikipedia/Tagesspiegel', confidence: 0.7, reach_weight: 0.35,
    notes: 'Querfront: links-ursprünglich, seit ~2015 verschwörungsideologisch/pro-russisch — factual:low.' },

  // ── center_left ───────────────────────────────────────────────────────────────
  { source_domain: 'spiegel.de', source_name: 'Spiegel', spectrum: 'center_left',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC+IVW', confidence: 0.9, reach_weight: 1.6,
    notes: 'MBFC: Left-Center, High. IVW: Top-2 Unique User.' },
  { source_domain: 'sueddeutsche.de', source_name: 'Süddeutsche', spectrum: 'center_left',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.9, reach_weight: 1.2,
    notes: 'MBFC: Left-Center, High. Überregionale Qualitätszeitung.' },
  { source_domain: 'zeit.de', source_name: 'Zeit', spectrum: 'center_left',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC/eurotopics', confidence: 0.85, reach_weight: 1.1,
    notes: 'Wochenzeitung, breites Spektrum, Schwerpunkt mitte-links.' },
  { source_domain: 'tagesspiegel.de', source_name: 'Tagesspiegel', spectrum: 'center_left',
    tier: 'standard', factual_rating: 'high', rating_source: 'eurotopics/editorial', confidence: 0.8, reach_weight: 0.8,
    notes: 'Berliner Hauptstadtzeitung, liberal mitte-links.' },
  { source_domain: 'stern.de', source_name: 'Stern', spectrum: 'center_left',
    tier: 'flagship', factual_rating: 'high', rating_source: 'AdFontes/MBFC', confidence: 0.75, reach_weight: 1.0,
    notes: 'stern.de: High (AdFontes+MBFC), Ground News: Center; broadly left-liberal.' },
  { source_domain: 'fr.de', source_name: 'Frankfurter Rundschau', spectrum: 'center_left',
    tier: 'standard', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.85, reach_weight: 0.6,
    notes: 'MBFC: Left-Center, High. Links-liberale Tradition.' },
  { source_domain: 'berliner-zeitung.de', source_name: 'Berliner Zeitung', spectrum: 'center_left',
    tier: 'standard', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.8, reach_weight: 0.6,
    notes: 'MBFC: Left-Center, High.' },
  { source_domain: 'rnd.de', source_name: 'RND', spectrum: 'center_left',
    tier: 'standard', factual_rating: 'high', rating_source: 'editorial/Wikipedia', confidence: 0.7, reach_weight: 0.7,
    notes: 'RedaktionsNetzwerk Deutschland (Madsack), SPD-nah, subtiler Linksdrall. MBFC-Seite fehlt → review.' },

  // ── center (öffentlich-rechtlich / international) ───────────────────────────────
  { source_domain: 'tagesschau.de', source_name: 'Tagesschau', spectrum: 'center',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC+IVW', confidence: 0.9, reach_weight: 1.5,
    notes: 'Öff.-rechtlich (ARD), gesetzlicher Ausgewogenheitsauftrag.' },
  { source_domain: 'zdf.de', source_name: 'ZDF', spectrum: 'center',
    tier: 'flagship', factual_rating: 'high', rating_source: 'editorial/IVW', confidence: 0.9, reach_weight: 1.4,
    notes: 'Öff.-rechtlich, Ausgewogenheitsauftrag.' },
  { source_domain: 'deutschlandfunk.de', source_name: 'Deutschlandfunk', spectrum: 'center',
    tier: 'standard', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.85, reach_weight: 0.7,
    notes: 'Öff.-rechtliches Informationsradio.' },
  { source_domain: 'dw.com', source_name: 'Deutsche Welle', spectrum: 'center',
    tier: 'standard', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.65, reach_weight: 0.6,
    notes: 'MBFC: Left-Center, Very High. Hier center (öff. Auslandsrundfunk, Neutralitätsauftrag) — Grenzfall.' },
  { source_domain: 'mdr.de', source_name: 'MDR', spectrum: 'center',
    tier: 'standard', factual_rating: 'high', rating_source: 'editorial', confidence: 0.7, reach_weight: 0.7,
    notes: 'Öff.-rechtlich (ARD, Mitteldeutschland). MBFC-Seite fehlt → review.' },

  // ── center_right ────────────────────────────────────────────────────────────────
  { source_domain: 'faz.net', source_name: 'FAZ', spectrum: 'center_right',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.9, reach_weight: 1.1,
    notes: 'MBFC: Right-Center, High. Liberal-konservativ.' },
  { source_domain: 'welt.de', source_name: 'Welt', spectrum: 'center_right',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.85, reach_weight: 1.2,
    notes: 'MBFC: Right-Center. Konservativ-liberal (Springer).' },
  { source_domain: 'focus.de', source_name: 'Focus', spectrum: 'center_right',
    tier: 'flagship', factual_rating: 'mixed', rating_source: 'IVW/editorial', confidence: 0.7, reach_weight: 1.5,
    notes: 'IVW: Top Unique User. Bürgerlich-konservativ, factual gemischt.' },
  { source_domain: 'n-tv.de', source_name: 'NTV', spectrum: 'center_right',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC+IVW', confidence: 0.75, reach_weight: 1.4,
    notes: 'IVW: #3 Visits → flagship. Nachrichtensender, wirtschaftsliberal.' },
  { source_domain: 'handelsblatt.com', source_name: 'Handelsblatt', spectrum: 'center_right',
    tier: 'standard', factual_rating: 'high', rating_source: 'editorial', confidence: 0.7, reach_weight: 0.9,
    notes: 'Wirtschaftszeitung, wirtschaftsliberal.' },
  { source_domain: 'nzz.ch', source_name: 'NZZ', spectrum: 'center_right',
    tier: 'flagship', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.85, reach_weight: 0.7,
    notes: 'MBFC: Right-Center, Mostly Factual (CH, in DE viel gelesen).' },
  { source_domain: 'wiwo.de', source_name: 'WirtschaftsWoche', spectrum: 'center_right',
    tier: 'standard', factual_rating: 'high', rating_source: 'editorial', confidence: 0.6, reach_weight: 0.6,
    notes: 'Wirtschaftsmagazin (Handelsblatt-Gruppe), wirtschaftsliberal. MBFC fehlt → review.' },
  { source_domain: 'cicero.de', source_name: 'Cicero', spectrum: 'center_right',
    tier: 'niche', factual_rating: 'high', rating_source: 'MBFC', confidence: 0.85, reach_weight: 0.4,
    notes: 'MBFC: Right-Center, Mostly Factual, High Credibility.' },

  // ── right ─────────────────────────────────────────────────────────────────────
  { source_domain: 'bild.de', source_name: 'Bild', spectrum: 'right',
    tier: 'flagship', factual_rating: 'mixed', rating_source: 'MBFC+IVW', confidence: 0.85, reach_weight: 1.8,
    notes: 'IVW: #1 Visits. Boulevard, populistisch-konservativ (Springer), factual:mixed.' },
  { source_domain: 'jungefreiheit.de', source_name: 'Junge Freiheit', spectrum: 'right',
    tier: 'standard', factual_rating: 'mixed', rating_source: 'Verfassungsschutz/Studie', confidence: 0.85, reach_weight: 0.3,
    notes: 'Rechtskonservativ bis rechts; gov. Studie: „far-right“-nah.' },
  { source_domain: 'tichyseinblick.de', source_name: 'Tichys Einblick', spectrum: 'right',
    tier: 'niche', factual_rating: 'mixed', rating_source: 'MBFC', confidence: 0.85, reach_weight: 0.35,
    notes: 'MBFC: Right, Mixed (poor sourcing, selektives Framing).' },
  { source_domain: 'nius.de', source_name: 'Nius', spectrum: 'right',
    tier: 'niche', factual_rating: 'low', rating_source: 'MBFC', confidence: 0.85, reach_weight: 0.5,
    notes: 'MBFC: Right, Mixed → hier low: „sensationalist, poor sourcing“, far-right populist.' },
  { source_domain: 'apollo-news.net', source_name: 'Apollo News', spectrum: 'right',
    tier: 'niche', factual_rating: 'mixed', rating_source: 'MBFC', confidence: 0.8, reach_weight: 0.3,
    notes: 'MBFC: Right, Mixed (einseitig, fehlender Kontext).' },
  { source_domain: 'epochtimes.de', source_name: 'Epoch Times DE', spectrum: 'right',
    tier: 'niche', factual_rating: 'low', rating_source: 'ISD/NewsGuard', confidence: 0.75, reach_weight: 0.3,
    notes: 'Dt. Ausgabe (Falun Gong): ISD: „anti-demokratische Falschnachrichten, Verschwörungstheorien“, AfD-nah.' },
  { source_domain: 'achgut.com', source_name: 'Achgut', spectrum: 'right',
    tier: 'niche', factual_rating: 'mixed', rating_source: 'NewsGuard/Wikipedia', confidence: 0.65, reach_weight: 0.35,
    notes: 'Broder/Maxeiner-Blog, „rechtes Empörungsportal“, NewsGuard-Beanstandungen.' },
  { source_domain: 'weltwoche.ch', source_name: 'Weltwoche', spectrum: 'right',
    tier: 'niche', factual_rating: 'mixed', rating_source: 'eurotopics/Wikipedia', confidence: 0.75, reach_weight: 0.3,
    notes: 'Rechtspopulistisch unter Köppel (CH).' },
];

/**
 * Media ownership (audit B4 — Ground News parity + German media-concentration
 * lens). Maps domain → owning group. Kept as a separate map so ownership edits
 * never touch the bias/factual classification above.
 */
export const SOURCE_OWNERS = {
  'taz.de': 'taz Verlagsgenossenschaft',
  'nd-aktuell.de': 'nd.Genossenschaft',
  'jungewelt.de': 'Verlag 8. Mai',
  'freitag.de': 'Jakob Augstein',
  'nachdenkseiten.de': 'IQM e.V.',
  'spiegel.de': 'Spiegel-Gruppe (KG Mitarbeiter/Augstein)',
  'sueddeutsche.de': 'Südwestdeutsche Medienholding (SWMH)',
  'zeit.de': 'Holtzbrinck / DvH Medien',
  'tagesspiegel.de': 'DvH Medien (Holtzbrinck)',
  'stern.de': 'RTL Deutschland (Bertelsmann)',
  'fr.de': 'Ippen-Gruppe',
  'berliner-zeitung.de': 'Holger Friedrich',
  'rnd.de': 'Madsack Mediengruppe',
  'tagesschau.de': 'Öffentlich-rechtlich (ARD)',
  'zdf.de': 'Öffentlich-rechtlich (ZDF)',
  'deutschlandfunk.de': 'Öffentlich-rechtlich (DLF)',
  'dw.com': 'Bundeshaushalt (Deutsche Welle)',
  'mdr.de': 'Öffentlich-rechtlich (ARD/MDR)',
  'faz.net': 'FAZIT-Stiftung',
  'welt.de': 'Axel Springer SE',
  'focus.de': 'Burda Verlag',
  'n-tv.de': 'RTL Deutschland (Bertelsmann)',
  'handelsblatt.com': 'Handelsblatt Media Group (DvH)',
  'nzz.ch': 'NZZ-Mediengruppe (CH)',
  'wiwo.de': 'Handelsblatt Media Group (DvH)',
  'cicero.de': 'Res Publica Verlag',
  'bild.de': 'Axel Springer SE',
  'jungefreiheit.de': 'Junge Freiheit Verlag',
  'tichyseinblick.de': 'Tichys Einblick GmbH',
  'nius.de': 'Vius SE (Frank Gotthardt)',
  'apollo-news.net': 'Apollo News (unabhängig)',
  'epochtimes.de': 'Epoch Times Europe (Falun Gong)',
  'achgut.com': 'Achgut Verlag',
  'weltwoche.ch': 'Roger Köppel (CH)',
};

/**
 * Derive a factual rating from OUR measured NLI support rate (audit B5).
 * supportRate is % of this source's cited claims that were supported/entailed
 * (not contradicted/unsupported) against the corpus. Requires minN datapoints —
 * below that we have no opinion (returns null → keep the static rating).
 */
export const MEASURED_MIN_N = 20;
export function deriveMeasuredFactual(stats, minN = MEASURED_MIN_N) {
  if (!stats || (Number(stats.n) || 0) < minN) return null;
  const support = Number(stats.supportRate); // 0..100
  const contradictedRate = stats.n ? (Number(stats.contradicted) || 0) / stats.n * 100 : 0;
  if (contradictedRate >= 10 || support < 55) return 'low';
  if (support < 80) return 'mixed';
  return 'high';
}

/**
 * Reconcile static vs measured factual for one source. Returns the effective
 * rating + whether the two diverge (flag for human review — never silently flips).
 */
export function reconcileFactual(staticFactual, measuredFactual) {
  const RANK = { high: 3, mixed: 2, low: 1 };
  if (!measuredFactual) return { effective: staticFactual, measured: null, diverges: false };
  const diverges = Math.abs((RANK[staticFactual] || 2) - (RANK[measuredFactual] || 2)) >= 1;
  return { effective: staticFactual, measured: measuredFactual, diverges };
}

/** Quick lookup map domain → rating (normalized domain). */
export function buildRatingsMap(ratings = SOURCE_RATINGS) {
  const map = Object.create(null);
  for (const r of ratings) {
    map[String(r.source_domain).toLowerCase().replace(/^www\./, '')] = r;
  }
  return map;
}

/** Domains classified as flagship within a spectrum (used for flagship-silence logic). */
export function flagshipDomainsBySpectrum(ratings = SOURCE_RATINGS) {
  const out = {};
  for (const r of ratings) {
    if (r.tier !== 'flagship') continue;
    (out[r.spectrum] ||= []).push(String(r.source_domain).toLowerCase().replace(/^www\./, ''));
  }
  return out;
}

/** Rows flagged for manual review (low confidence). */
export function lowConfidenceRatings(threshold = 0.65, ratings = SOURCE_RATINGS) {
  return ratings.filter(r => Number(r.confidence) <= threshold);
}

/**
 * Seed all ratings via an injected upsert (db.upsertSourceRating).
 * @param {(rating:object)=>Promise<any>} upsertFn
 * @returns {Promise<{seeded:number, failed:number}>}
 */
export async function seedSourceRatings(upsertFn, ratings = SOURCE_RATINGS) {
  let seeded = 0, failed = 0;
  for (const r of ratings) {
    try { await upsertFn(r); seeded++; }
    catch { failed++; }
  }
  return { seeded, failed };
}
