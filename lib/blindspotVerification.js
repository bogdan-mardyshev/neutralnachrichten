/**
 * lib/blindspotVerification.js — turn "no articles" into a TRUSTWORTHY silence claim.
 *
 * THE BUG THIS FIXES (the #1 red in the old architecture):
 *   The old pipeline inferred "this camp is silencing the topic" purely from an
 *   empty article list. But an empty list also happens when a feed is simply BROKEN
 *   (timeout, 500, parse error). Claiming editorial silence because our own fetch
 *   failed is a false accusation — exactly the kind of unreliability we're killing.
 *
 * THE FIX:
 *   Cross-reference feed_health. A spectrum is only declared a verified blindspot
 *   ('silent') when EVERY one of its feeds is healthy yet still returned nothing.
 *   If any feed is degraded/down, we cannot distinguish silence from breakage, so
 *   the status is 'unknown' — never a silence accusation.
 *
 *   covered  → has ≥1 article
 *   silent   → 0 articles AND all feeds healthy        (real, defensible blindspot)
 *   unknown  → 0 articles AND ≥1 feed degraded/down     (can't tell — stay silent)
 *
 * Pure module: takes the retrieved spectra + the down-feeds list (db.getDownFeeds).
 */

import { RSS_FEEDS } from './rssSearch.js';
import { CORPUS_SPECTRUMS } from './corpusQueries.js';
import { flagshipDomainsBySpectrum, leadOutletsBySpectrum } from './sourceRatingsSeed.js';

/** Normalize a domain for comparison. */
function normDomain(d) {
  return String(d || '').toLowerCase().replace(/^www\./, '');
}

/** Total configured feeds per spectrum (from RSS_FEEDS). */
export function totalFeedsForSpectrum(spectrum) {
  return (RSS_FEEDS[spectrum] || []).length;
}

/**
 * Classify a single spectrum's silence status.
 * @param {number} articleCount
 * @param {number} downCount — feeds in this spectrum that are degraded/down
 * @param {number} totalFeeds
 * @returns {{ status, confidence, healthyFeeds, downFeeds, totalFeeds }}
 */
export function classifySilence(articleCount, downCount, totalFeeds) {
  const total = Math.max(0, totalFeeds);
  const down = Math.max(0, Math.min(downCount, total));
  const healthy = total - down;

  if (articleCount > 0) {
    return { status: 'covered', confidence: 1, healthyFeeds: healthy, downFeeds: down, totalFeeds: total };
  }
  if (down === 0) {
    // All feeds healthy, zero articles → a real, defensible blindspot.
    return { status: 'silent', confidence: 1, healthyFeeds: healthy, downFeeds: down, totalFeeds: total };
  }
  // Some/all feeds broken → cannot claim silence. Confidence reflects how much of
  // the spectrum we could actually observe.
  return {
    status: 'unknown',
    confidence: total > 0 ? Number((healthy / total).toFixed(3)) : 0,
    healthyFeeds: healthy,
    downFeeds: down,
    totalFeeds: total,
  };
}

/**
 * Verify blindspots across all spectra.
 *
 * @param {object} corpusSpectra — { left:{articles:[...]}, ... }
 * @param {Array}  downFeeds — rows from db.getDownFeeds(): { feed_url, source_name, spectrum, status, consecutive_failures }
 * @returns {{ perSpectrum, verifiedSilences, unverifiable, coveredSpectra }}
 */
export function verifyBlindspots(corpusSpectra = {}, downFeeds = [], opts = {}) {
  const flagshipMap = opts.flagshipMap || flagshipDomainsBySpectrum();
  const leadMap = opts.leadMap || leadOutletsBySpectrum();
  const downBySpectrum = {};
  for (const f of Array.isArray(downFeeds) ? downFeeds : []) {
    if (!f || !f.spectrum) continue;
    let domain = '';
    try { domain = f.feed_url ? normDomain(new URL(f.feed_url).hostname) : ''; } catch { /* ignore */ }
    (downBySpectrum[f.spectrum] ||= []).push({
      source_name: f.source_name,
      status: f.status,
      consecutive_failures: f.consecutive_failures,
      domain,
    });
  }

  const perSpectrum = {};
  const verifiedSilences = [];   // camp_silent: nobody in the camp wrote (all feeds healthy)
  const flagshipSilences = [];   // flagship_silent: a MASS-reach flagship of the camp stayed silent
  const leadSilences = [];       // lead_silent: the camp's leading voices (top reach) stayed silent
  const leadOnlySilences = [];   // lead_silent AND NOT flagship_silent — the genuinely-new signal
  const unverifiable = [];
  const coveredSpectra = [];

  for (const sp of CORPUS_SPECTRUMS) {
    const articles = corpusSpectra?.[sp]?.articles || [];
    const articleCount = articles.length;
    const downList = downBySpectrum[sp] || [];
    const cls = classifySilence(articleCount, downList.length, totalFeedsForSpectrum(sp));

    // Did a FLAGSHIP outlet of this camp publish? (distinct flagship domains present)
    const flagships = new Set((flagshipMap[sp] || []).map(normDomain));
    const flagshipDomainsPresent = new Set();
    for (const a of articles) {
      const d = normDomain(a.source_domain);
      if (flagships.has(d)) flagshipDomainsPresent.add(d);
    }
    const flagshipPublished = flagshipDomainsPresent.size > 0;
    const hasFlagships = flagships.size > 0;
    // flagship_silent only makes sense when the camp HAS flagships and SOME outlet
    // wrote, but no flagship did.
    const flagshipSilent = cls.status === 'covered' && hasFlagships && !flagshipPublished;

    // Per-camp LEAD voices (top reach within the camp, regardless of absolute
    // flagship tier). lead_silent fires when the camp covered the topic but none
    // of its leading voices did — works even for camps without a mass flagship
    // (e.g. left, whose lead voices are taz + Junge Welt).
    const leads = new Set((leadMap[sp] || []).map(normDomain));
    const leadDomainsPresent = new Set();
    for (const a of articles) {
      const d = normDomain(a.source_domain);
      if (leads.has(d)) leadDomainsPresent.add(d);
    }
    const leadPublished = leadDomainsPresent.size > 0;
    // M5.2 granularity: expose which lead voices were silent, not just a boolean —
    // so "JW wrote, taz silent" is visible instead of hidden by the OR.
    const leadDomainsMissing = [...leads].filter(d => !leadDomainsPresent.has(d));
    // M5.3 lead-level feed health: a lead whose feed is DOWN physically couldn't
    // publish — that is not editorial silence. If any lead feed is down and no lead
    // published, we can't claim lead-silence → mark it uncertain instead of firing.
    const downDomains = new Set(downList.map(d => d.domain).filter(Boolean));
    const leadsDown = [...leads].filter(d => downDomains.has(d));
    const leadSilent = cls.status === 'covered' && leads.size > 0 && !leadPublished && leadsDown.length === 0;
    const leadSilentUncertain = cls.status === 'covered' && leads.size > 0 && !leadPublished && leadsDown.length > 0;
    // M5.1 kill the center tautology: only surface lead-silence as a NEW signal when
    // it isn't already a (mass-reach) flagship-silence.
    const leadOnlySilent = leadSilent && !flagshipSilent;

    perSpectrum[sp] = {
      ...cls,
      articleCount,
      brokenFeeds: downList,
      flagshipPublished,
      flagshipSilent,
      flagshipDomainsPresent: [...flagshipDomainsPresent],
      leadPublished,
      leadSilent,
      leadOnlySilent,
      leadSilentUncertain,
      leadDomainsPresent: [...leadDomainsPresent],
      leadDomainsMissing,
    };

    if (cls.status === 'covered') {
      coveredSpectra.push(sp);
      if (flagshipSilent) flagshipSilences.push(sp);
      if (leadSilent) leadSilences.push(sp);
      if (leadOnlySilent) leadOnlySilences.push(sp);
    } else if (cls.status === 'silent') {
      verifiedSilences.push(sp);
    } else {
      unverifiable.push(sp);
    }
  }

  return { perSpectrum, verifiedSilences, flagshipSilences, leadSilences, leadOnlySilences, unverifiable, coveredSpectra };
}

/**
 * Post-process a deep-analysis object's silenced_topics so we never present an
 * UNVERIFIABLE spectrum (broken feed) as silence. Annotates each silenced_topic
 * and drops/marks ones that point at an unverifiable spectrum.
 *
 * @param {object} deepAnalysis — has silenced_topics: [{ topic, only_in, description }]
 * @param {object} blindspotReport — from verifyBlindspots
 * @returns {object} cloned deepAnalysis with verified silenced_topics
 */
export function annotateSilencedTopics(deepAnalysis, blindspotReport) {
  const clone = JSON.parse(JSON.stringify(deepAnalysis || {}));
  if (!Array.isArray(clone.silenced_topics)) return clone;

  const unverifiable = new Set(blindspotReport?.unverifiable || []);

  clone.silenced_topics = clone.silenced_topics.map(st => {
    const target = st?.only_in;
    // only_in: "none" means absent from all — keep as-is (general silence).
    if (!target || target === 'none') return { ...st, _verified: true };
    if (unverifiable.has(target)) {
      return {
        ...st,
        _verified: false,
        _note: `Nicht verifizierbar: mindestens ein Feed im Bereich "${target}" war nicht erreichbar.`,
      };
    }
    return { ...st, _verified: true };
  });

  return clone;
}
