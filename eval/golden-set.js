/**
 * eval/golden-set.js — hand-labelled fixtures for the offline RAG-eval harness.
 *
 * Each case is a frozen snapshot of what hybrid retrieval would hand the pipeline
 * for one topic, PLUS a human relevance judgement and a synthesis to score:
 *
 *   grouped       — candidate rows per spectrum, exactly as combineRetrieval emits
 *                   (id, source, spectrum, title, our_summary, url, _rrfScore).
 *                   Deliberately seeded with off-topic DISTRACTORS, including the
 *                   nasty kind that SHARE topic words (the gate's blind spot).
 *   relevantIds   — ground-truth on-topic ids (human judgement, independent of
 *                   what the gate does — so recall can expose over-filtering and
 *                   precision can expose distractors slipping through).
 *   analysis      — a synthesis to score for faithfulness. Authored with a mix of
 *                   grounded/ungrounded cards and supported/unsupported sentences
 *                   so the faithfulness metric has teeth (never a trivial 1.0).
 *
 * No Gemini, no DB — the runner feeds these straight through the real pure
 * pipeline (corpusToSpectra → groundAnalysis → verifyClaims).
 */

const row = (id, spectrum, source_name, source_domain, article_title, our_summary, _rrfScore) => ({
  id, spectrum, source_name, source_domain, article_title, our_summary,
  url: `https://${source_domain}/${id}`, short_lead: our_summary.slice(0, 120),
  pubDate: new Date(Date.now() - 2 * 86400000).toISOString(),
  _rrfScore, _retrievers: ['lexical', 'semantic'],
});

const card = (source_name, article_title, url) => ({ source_name, article_title, article_url: url });

export const GOLDEN_SET = [
  // ── Case 1: Rentenreform — distractor (d1) shares "bundestag"+"2027" but is
  //    about climate money; borderline-relevant r5 has only one topic word.
  {
    id: 'rentenreform',
    topic: 'Rentenreform Bundestag 2027',
    keywords: ['rentenreform', 'bundestag', '2027', 'rente', 'altersvorsorge'],
    topicWords: ['rentenreform', 'bundestag', '2027'],
    grouped: {
      center_left: [
        row('r2', 'center_left', 'Süddeutsche', 'sueddeutsche.de', 'Bundestag verabschiedet Rentenreform',
            'Der Bundestag hat die Rentenreform für das Jahr 2027 beschlossen. Die Altersvorsorge wird umgebaut.', 0.90),
      ],
      center: [
        row('r3', 'center', 'Tagesschau', 'tagesschau.de', 'Rentenreform 2027: die wichtigsten Punkte',
            'Was die Rentenreform ab 2027 für Beitragszahler bedeutet, im Überblick.', 0.85),
        row('d1', 'center', 'Bild', 'bild.de', 'Bundestag beschließt neues Klimageld',
            'Der Bundestag stimmte über das Klimageld ab 2027 ab. Es geht um Energiekosten.', 0.50), // DISTRACTOR: shares bundestag+2027
      ],
      left: [
        row('r1', 'left', 'taz', 'taz.de', 'Rentenreform 2027: Sozialverbände kritisieren Kürzungen',
            'Die geplante Rentenreform soll 2027 in Kraft treten und ändert die Altersvorsorge spürbar.', 0.80),
      ],
      center_right: [
        row('r4', 'center_right', 'FAZ', 'faz.net', 'Kosten der Rentenreform',
            'Ökonomen warnen vor den Kosten der Rentenreform 2027 für den Bundeshaushalt.', 0.75),
      ],
      right: [
        row('r5', 'right', 'Cicero', 'cicero.de', 'Rentenpaket im Bundestag umstritten',
            'Im Bundestag gibt es Streit über das Rentenpaket und seine Finanzierung.', 0.40), // borderline: only "bundestag"
      ],
    },
    relevantIds: ['r1', 'r2', 'r3', 'r4', 'r5'],
    analysis: {
      analysis_topic: 'Rentenreform Bundestag 2027',
      overall_non_partisan_analysis:
        'Der Bundestag hat die Rentenreform für das Jahr 2027 beschlossen. ' +
        'Ökonomen warnen vor den Kosten der Rentenreform für den Bundeshaushalt. ' +
        'Sozialverbände kritisieren geplante Kürzungen bei der Altersvorsorge. ' +
        'Eine Volksabstimmung über die Reform ist fest eingeplant.', // UNSUPPORTED (not in corpus)
      news_spectrum: {
        left:   [card('taz', 'Rentenreform 2027: Sozialverbände kritisieren Kürzungen', 'https://taz.de/r1')],
        center_left: [card('Süddeutsche', 'Bundestag verabschiedet Rentenreform', 'https://sueddeutsche.de/r2')],
        center: [card('Tagesschau', 'Rentenreform 2027: die wichtigsten Punkte', 'https://tagesschau.de/r3')],
        center_right: [card('FAZ', 'Kosten der Rentenreform', 'https://faz.net/r4')],
        right:  [card('Cicero', 'Rentenpaket im Bundestag umstritten', 'https://cicero.de/nonexistent')], // UNGROUNDED url
      },
    },
  },

  // ── Case 2: Cannabis-Legalisierung — clean topic, one sports distractor that
  //    shares no topic words (gate should drop it cleanly → high precision).
  {
    id: 'cannabis',
    topic: 'Cannabis Legalisierung Deutschland',
    keywords: ['cannabis', 'legalisierung', 'deutschland', 'kiffen', 'eigenanbau'],
    topicWords: ['cannabis', 'legalisierung', 'deutschland'],
    grouped: {
      left: [
        row('c1', 'left', 'taz', 'taz.de', 'Cannabis-Legalisierung in Deutschland gestartet',
            'Die Cannabis-Legalisierung in Deutschland erlaubt seit April den Eigenanbau.', 0.92),
      ],
      center_left: [
        row('c2', 'center_left', 'Zeit', 'zeit.de', 'Was die Cannabis-Legalisierung ändert',
            'Die Legalisierung von Cannabis in Deutschland regelt Besitz und Anbaumengen neu.', 0.88),
      ],
      center: [
        row('c3', 'center', 'Tagesschau', 'tagesschau.de', 'Cannabis: Deutschland legalisiert mit Auflagen',
            'Deutschland legalisiert Cannabis mit strengen Auflagen für den Jugendschutz.', 0.83),
        row('d2', 'center', 'Kicker', 'kicker.de', 'Bayern gewinnt das Topspiel',
            'Der FC Bayern gewinnt das Topspiel der Bundesliga mit 3:1.', 0.30), // DISTRACTOR: no topic words
      ],
      center_right: [
        row('c4', 'center_right', 'Welt', 'welt.de', 'Kritik an der Cannabis-Legalisierung',
            'Mediziner kritisieren die Cannabis-Legalisierung in Deutschland als zu weitgehend.', 0.70),
      ],
      right: [],
    },
    relevantIds: ['c1', 'c2', 'c3', 'c4'],
    analysis: {
      analysis_topic: 'Cannabis Legalisierung Deutschland',
      overall_non_partisan_analysis:
        'Die Cannabis-Legalisierung in Deutschland erlaubt seit April den Eigenanbau. ' +
        'Deutschland legalisiert Cannabis mit strengen Auflagen für den Jugendschutz. ' +
        'Mediziner kritisieren die Legalisierung als zu weitgehend.',
      news_spectrum: {
        left:   [card('taz', 'Cannabis-Legalisierung in Deutschland gestartet', 'https://taz.de/c1')],
        center_left: [card('Zeit', 'Was die Cannabis-Legalisierung ändert', 'https://zeit.de/c2')],
        center: [card('Tagesschau', 'Cannabis: Deutschland legalisiert mit Auflagen', 'https://tagesschau.de/c3')],
        center_right: [card('Welt', 'Kritik an der Cannabis-Legalisierung', 'https://welt.de/c4')],
        right:  [],
      },
    },
  },

  // ── Case 3: Klimaschutzgesetz — the synthesis CONTRADICTS the corpus (says the
  //    novelle "verschärft" the sector targets; corpus says it "streicht/lockert").
  //    In OFFLINE (lexical) mode this scores as supported — a deliberate, honest
  //    demonstration that contradiction detection needs the live NLI pass. The
  //    contradiction-penalty path itself is covered in tests/rag-eval.test.js.
  {
    id: 'klima',
    topic: 'Klimaschutzgesetz Novelle',
    keywords: ['klimaschutzgesetz', 'novelle', 'klima', 'co2', 'sektorziele'],
    topicWords: ['klimaschutzgesetz', 'novelle', 'klima'],
    grouped: {
      center_left: [
        row('k1', 'center_left', 'Spiegel', 'spiegel.de', 'Klimaschutzgesetz: Novelle beschlossen',
            'Die Novelle des Klimaschutzgesetzes streicht die jährlichen Sektorziele für das Klima.', 0.91),
      ],
      center: [
        row('k2', 'center', 'ZDF', 'zdf.de', 'Was die Klimaschutzgesetz-Novelle bedeutet',
            'Die Klimaschutzgesetz-Novelle lockert die Vorgaben für einzelne Sektoren beim Klima.', 0.84),
      ],
      center_right: [
        row('k3', 'center_right', 'FAZ', 'faz.net', 'Klimaschutzgesetz-Novelle: Wirtschaft erleichtert',
            'Die Wirtschaft begrüßt die Novelle des Klimaschutzgesetzes als flexibler beim Klima.', 0.72),
      ],
      left: [
        row('d3', 'left', 'junge Welt', 'jungewelt.de', 'Streik im Nahverkehr ausgeweitet',
            'Die Gewerkschaft weitet den Streik im Nahverkehr auf weitere Städte aus.', 0.35), // DISTRACTOR
      ],
      right: [],
    },
    relevantIds: ['k1', 'k2', 'k3'],
    analysis: {
      analysis_topic: 'Klimaschutzgesetz Novelle',
      overall_non_partisan_analysis:
        'Die Novelle des Klimaschutzgesetzes verschärft die jährlichen Sektorziele für das Klima deutlich. ' + // CONTRADICTION (corpus: streicht/lockert)
        'Die Wirtschaft begrüßt die Novelle des Klimaschutzgesetzes als flexibler.',
      news_spectrum: {
        center_left: [card('Spiegel', 'Klimaschutzgesetz: Novelle beschlossen', 'https://spiegel.de/k1')],
        center: [card('ZDF', 'Was die Klimaschutzgesetz-Novelle bedeutet', 'https://zdf.de/k2')],
        center_right: [card('FAZ', 'Klimaschutzgesetz-Novelle: Wirtschaft erleichtert', 'https://faz.net/k3')],
        left: [], right: [],
      },
    },
  },
];
