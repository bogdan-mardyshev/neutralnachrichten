import { describe, it, expect } from 'vitest';
import { tokenize, jaccard, clusterArticles, CLUSTER_SIM_THRESHOLD } from '../lib/storyClustering.js';

const art = (title, summary, spectrum = 'center', over = {}) => ({
  article_title: title, our_summary: summary, spectrum,
  source_name: over.source_name || 'Src', article_url: over.url || `https://x.de/${Math.random()}`,
});

describe('tokenize / jaccard', () => {
  it('keeps significant words, drops short/stopwords', () => {
    const t = tokenize('Der Bundestag und die Reform über alles');
    expect(t.has('bundestag')).toBe(true);
    expect(t.has('reform')).toBe(true);
    expect(t.has('und')).toBe(false);
    expect(t.has('über')).toBe(false);
  });
  it('jaccard 1 for identical, 0 for disjoint', () => {
    expect(jaccard(tokenize('rentenreform bundestag'), tokenize('bundestag rentenreform'))).toBe(1);
    expect(jaccard(tokenize('klima gipfel'), tokenize('fussball bundesliga'))).toBe(0);
  });
});

describe('clusterArticles', () => {
  it('groups articles about the same sub-story', () => {
    const articles = [
      art('OECD senkt Wachstumsprognose für Deutschland', 'Die OECD senkt die Prognose auf 0,7 Prozent.', 'center'),
      art('OECD Prognose: Deutschland Wachstum schwach', 'OECD Wachstumsprognose deutlich gesenkt.', 'center_right'),
      art('Energiewende in der Kritik', 'Die Energiewende sei ideologiegetrieben.', 'right'),
      art('Energiewende: Kritik an Transformation', 'Kritik an der Energiewende-Transformation wächst.', 'center_right'),
    ];
    const { clusters, meta } = clusterArticles(articles, { threshold: 0.2 });
    // expect 2 sub-stories: OECD + Energiewende
    expect(meta.multiArticleClusters).toBe(2);
    // label is now the lead article's real headline; keywords holds the tokens
    const labels = clusters.map(c => c.label).join(' ').toLowerCase();
    const keywords = clusters.map(c => c.keywords).join(' ').toLowerCase();
    expect(labels).toMatch(/oecd|prognose|wachstum/);
    expect((labels + ' ' + keywords)).toMatch(/energiewende/);
  });

  it('records which camps cover each cluster + flags solo-camp sub-angles', () => {
    const articles = [
      art('Skandal um Ministerin nur hier berichtet', 'Exklusiv: Skandal Ministerin Vorwürfe Korruption.', 'right'),
      art('Skandal Ministerin Korruption Vorwürfe', 'Weitere Details Skandal Ministerin Korruption Vorwürfe.', 'right'),
      art('Wetterbericht Sommer', 'Der Sommer wird warm.', 'left'),
    ];
    const { clusters, meta } = clusterArticles(articles, { threshold: 0.2, minSize: 2 });
    const skandal = clusters.find(c => /skandal|ministerin/i.test(`${c.label} ${c.keywords}`));
    expect(skandal).toBeTruthy();
    expect(skandal.label).toMatch(/Skandal|Ministerin/); // human-readable headline, not token soup
    expect(skandal.soloCamp).toBe('right');     // only the right camp tells this sub-angle
    expect(meta.soloCamps.some(s => s.camp === 'right')).toBe(true);
  });

  it('counts spectra per cluster', () => {
    const articles = [
      art('Rentenreform beschlossen heute', 'Rentenreform beschlossen Bundestag heute.', 'center'),
      art('Rentenreform beschlossen Bundestag', 'Rentenreform Bundestag beschlossen.', 'left'),
    ];
    const { clusters } = clusterArticles(articles, { threshold: 0.2 });
    const c = clusters[0];
    expect(c.size).toBe(2);
    expect(c.coveredCamps.sort()).toEqual(['center', 'left']);
  });

  it('respects maxClusters', () => {
    const articles = Array.from({ length: 20 }, (_, i) => art(`Thema ${i} einzigartig wort${i}`, `Inhalt ${i} wort${i}`, 'center'));
    const { clusters } = clusterArticles(articles, { maxClusters: 5, minSize: 1 });
    expect(clusters.length).toBeLessThanOrEqual(5);
  });

  it('handles empty / single', () => {
    expect(clusterArticles([]).clusters).toEqual([]);
    expect(clusterArticles([art('A B C', 'D E F')]).meta.total).toBe(1);
  });

  it('exposes a usable default threshold', () => {
    expect(CLUSTER_SIM_THRESHOLD).toBeGreaterThan(0);
    expect(CLUSTER_SIM_THRESHOLD).toBeLessThan(1);
  });
});
