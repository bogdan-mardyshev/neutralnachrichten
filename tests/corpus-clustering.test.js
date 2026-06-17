import { describe, it, expect } from 'vitest';
import { assignClusterIds, countClusters } from '../lib/corpusClustering.js';
import { buildRecentForClusteringQuery, buildUpdateClusterIdsQuery } from '../lib/corpusQueries.js';

const art = (id, title, summary = '') => ({ id, title, our_summary: summary, spectrum: 'center' });

describe('assignClusterIds', () => {
  it('groups near-duplicate stories and gives them the MIN id (stable)', () => {
    const arts = [
      art(10, 'Bundestag beschließt Rentenreform 2027'),
      art(11, 'Rentenreform 2027 vom Bundestag beschlossen'),   // ~same story as 10
      art(20, 'Fußball-WM 2026: Deutschland gegen Brasilien'),  // different story
    ];
    const out = assignClusterIds(arts);
    const byId = Object.fromEntries(out.map(a => [a.id, a.clusterId]));
    expect(byId[10]).toBe(byId[11]);     // same cluster
    expect(byId[10]).toBe(10);           // stable id = min member id
    expect(byId[20]).not.toBe(byId[10]); // distinct story
    expect(byId[20]).toBe(20);           // singleton → own id
  });

  it('stable across input reordering', () => {
    const a = [art(10, 'Rentenreform 2027 beschlossen'), art(11, 'Rentenreform 2027 beschlossen heute')];
    const b = [art(11, 'Rentenreform 2027 beschlossen heute'), art(10, 'Rentenreform 2027 beschlossen')];
    const ca = Object.fromEntries(assignClusterIds(a).map(x => [x.id, x.clusterId]));
    const cb = Object.fromEntries(assignClusterIds(b).map(x => [x.id, x.clusterId]));
    expect(ca).toEqual(cb);
  });

  it('a new article joining an existing story keeps the story id', () => {
    const before = assignClusterIds([art(10, 'Rentenreform 2027 beschlossen'), art(11, 'Rentenreform 2027 beschlossen heute')]);
    const after  = assignClusterIds([art(10, 'Rentenreform 2027 beschlossen'), art(11, 'Rentenreform 2027 beschlossen heute'), art(30, 'Rentenreform 2027 beschlossen erneut')]);
    const idBefore = before.find(a => a.id === 10).clusterId;
    const idAfter30 = after.find(a => a.id === 30).clusterId;
    expect(idAfter30).toBe(idBefore);   // adopts the existing (min=10) story id
  });

  it('skips rows without a usable id and handles empty input', () => {
    expect(assignClusterIds([])).toEqual([]);
    expect(assignClusterIds([{ title: 'no id' }, art(5, 'x story here')])).toHaveLength(1);
  });

  it('countClusters counts distinct stories', () => {
    const out = assignClusterIds([art(1, 'Klimaschutzgesetz Novelle'), art(2, 'Klimaschutzgesetz Novelle beschlossen'), art(9, 'Tempolimit Autobahn Debatte')]);
    expect(countClusters(out)).toBe(2);
  });
});

describe('cluster query builders', () => {
  it('buildRecentForClusteringQuery clamps window and limit', () => {
    const q = buildRecentForClusteringQuery({ sinceDays: 3, limit: 500 });
    expect(q.text).toMatch(/corpus_articles/);
    expect(q.text).toMatch(/LIMIT 500/);
    expect(q.values).toEqual(['3']);
  });

  it('buildUpdateClusterIdsQuery batches a parameterised UPDATE', () => {
    const q = buildUpdateClusterIdsQuery([{ id: 10, clusterId: 10 }, { id: 11, clusterId: 10 }]);
    expect(q.text).toMatch(/UPDATE corpus_articles/);
    expect(q.text).toMatch(/VALUES \(\$1::bigint, \$2::bigint\),\(\$3::bigint, \$4::bigint\)/);
    expect(q.values).toEqual([10, 10, 11, 10]);
  });

  it('buildUpdateClusterIdsQuery returns null for no assignments', () => {
    expect(buildUpdateClusterIdsQuery([])).toBeNull();
    expect(buildUpdateClusterIdsQuery([{ id: null, clusterId: 1 }])).toBeNull();
  });
});
