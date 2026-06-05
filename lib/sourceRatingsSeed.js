/**
 * lib/sourceRatingsSeed.js — auditable spectrum classification for every source.
 *
 * WHY this exists:
 *   An opaque "this outlet is right-wing" label is exactly the kind of unfalsifiable
 *   claim that erodes trust. Each rating here carries PROVENANCE (rating_source) and
 *   a short rationale (notes) so the UI can show WHY a source sits where it does, and
 *   a confidence so we can be honest about borderline cases.
 *
 *   spectrum      — our editorial placement, triangulated with public media-bias
 *                   references (MBFC, Reuters Institute, academic German-media studies).
 *   rating_source — provenance string surfaced in the UI.
 *   confidence    — 0..1, how settled the placement is (mainstream high, fringe lower).
 *   reach_weight  — relative audience reach (≈ normalized monthly reach from public
 *                   IVW/AGOF-style figures). Used to weight coverage so a niche blog
 *                   and a mass-market outlet don't count the same. ESTIMATE, not gospel.
 *
 * The numbers are deliberately conservative, documented estimates — the point is a
 * transparent, adjustable baseline, not false precision.
 */

export const SOURCE_RATINGS = [
  // ── left ────────────────────────────────────────────────────────────────────
  { source_domain: 'taz.de',          source_name: 'taz',            spectrum: 'left',
    rating_source: 'editorial+mbfc', confidence: 0.85, reach_weight: 0.6,
    notes: 'Linksalternativ, dezidiert progressiv; MBFC: Left.' },
  { source_domain: 'nd-aktuell.de',   source_name: 'nd-aktuell',     spectrum: 'left',
    rating_source: 'editorial',      confidence: 0.8,  reach_weight: 0.3,
    notes: 'Sozialistische Tradition (vormals Neues Deutschland).' },
  { source_domain: 'jungewelt.de',    source_name: 'Junge Welt',     spectrum: 'left',
    rating_source: 'editorial',      confidence: 0.8,  reach_weight: 0.25,
    notes: 'Marxistisch ausgerichtet, dezidiert links.' },

  // ── center_left ───────────────────────────────────────────────────────────────
  { source_domain: 'spiegel.de',      source_name: 'Spiegel',        spectrum: 'center_left',
    rating_source: 'editorial+mbfc', confidence: 0.8,  reach_weight: 1.6,
    notes: 'Großes Nachrichtenmagazin, mitte-links; MBFC: Left-Center.' },
  { source_domain: 'sueddeutsche.de', source_name: 'Süddeutsche',    spectrum: 'center_left',
    rating_source: 'editorial+mbfc', confidence: 0.8,  reach_weight: 1.2,
    notes: 'Überregionale Qualitätszeitung, liberal mitte-links; MBFC: Left-Center.' },
  { source_domain: 'zeit.de',         source_name: 'Zeit',           spectrum: 'center_left',
    rating_source: 'editorial+mbfc', confidence: 0.75, reach_weight: 1.2,
    notes: 'Wochenzeitung, breites Meinungsspektrum, Schwerpunkt mitte-links.' },
  { source_domain: 'tagesspiegel.de', source_name: 'Tagesspiegel',   spectrum: 'center_left',
    rating_source: 'editorial',      confidence: 0.7,  reach_weight: 0.8,
    notes: 'Berliner Hauptstadtzeitung, liberal mitte-links.' },

  // ── center (öffentlich-rechtlich) ──────────────────────────────────────────────
  { source_domain: 'tagesschau.de',      source_name: 'Tagesschau',      spectrum: 'center',
    rating_source: 'editorial+mbfc', confidence: 0.9,  reach_weight: 1.5,
    notes: 'Öffentlich-rechtlich (ARD), gesetzlicher Ausgewogenheitsauftrag.' },
  { source_domain: 'zdf.de',             source_name: 'ZDF',             spectrum: 'center',
    rating_source: 'editorial+mbfc', confidence: 0.9,  reach_weight: 1.4,
    notes: 'Öffentlich-rechtlich, gesetzlicher Ausgewogenheitsauftrag.' },
  { source_domain: 'deutschlandfunk.de', source_name: 'Deutschlandfunk', spectrum: 'center',
    rating_source: 'editorial',      confidence: 0.85, reach_weight: 0.7,
    notes: 'Öffentlich-rechtliches Informationsradio.' },

  // ── center_right ────────────────────────────────────────────────────────────────
  { source_domain: 'faz.net',         source_name: 'FAZ',            spectrum: 'center_right',
    rating_source: 'editorial+mbfc', confidence: 0.8,  reach_weight: 1.1,
    notes: 'Liberal-konservative Qualitätszeitung; MBFC: Right-Center.' },
  { source_domain: 'welt.de',         source_name: 'Welt',           spectrum: 'center_right',
    rating_source: 'editorial+mbfc', confidence: 0.8,  reach_weight: 1.2,
    notes: 'Konservativ-liberal (Springer); MBFC: Right-Center.' },
  { source_domain: 'focus.de',        source_name: 'Focus',          spectrum: 'center_right',
    rating_source: 'editorial',      confidence: 0.65, reach_weight: 1.3,
    notes: 'Nachrichtenmagazin, bürgerlich-konservativ.' },
  { source_domain: 'n-tv.de',         source_name: 'NTV',            spectrum: 'center_right',
    rating_source: 'editorial',      confidence: 0.6,  reach_weight: 1.1,
    notes: 'Nachrichtensender, wirtschaftsliberal.' },
  { source_domain: 'handelsblatt.com',source_name: 'Handelsblatt',   spectrum: 'center_right',
    rating_source: 'editorial',      confidence: 0.7,  reach_weight: 0.9,
    notes: 'Wirtschaftszeitung, wirtschaftsliberal.' },

  // ── right ─────────────────────────────────────────────────────────────────────
  { source_domain: 'bild.de',           source_name: 'Bild',            spectrum: 'right',
    rating_source: 'editorial+mbfc', confidence: 0.7,  reach_weight: 1.8,
    notes: 'Auflagenstärkste Boulevardzeitung, populistisch-konservativ (Springer).' },
  { source_domain: 'jungefreiheit.de',  source_name: 'Junge Freiheit',  spectrum: 'right',
    rating_source: 'editorial',      confidence: 0.8,  reach_weight: 0.3,
    notes: 'Rechtskonservativ bis rechts, nationalkonservatives Profil.' },
  { source_domain: 'tichyseinblick.de', source_name: 'Tichys Einblick', spectrum: 'right',
    rating_source: 'editorial',      confidence: 0.75, reach_weight: 0.3,
    notes: 'Wirtschaftsliberal-konservatives Meinungsmagazin, rechts der Mitte bis rechts.' },
];

/** Quick lookup map domain → rating (normalized domain). */
export function buildRatingsMap(ratings = SOURCE_RATINGS) {
  const map = Object.create(null);
  for (const r of ratings) {
    map[String(r.source_domain).toLowerCase().replace(/^www\./, '')] = r;
  }
  return map;
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
