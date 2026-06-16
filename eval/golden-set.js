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

  // ── Case 4: Mietpreisbremse — clean; off-topic Wohngeld distractor shares only
  //    one topic word → gate drops it (precision stays high).
  {
    id: 'miete',
    topic: 'Mietpreisbremse Mieten Wohnungsmarkt',
    keywords: ['mietpreisbremse', 'mieten', 'wohnungsmarkt', 'mieter', 'wohnen'],
    topicWords: ['mietpreisbremse', 'mieten', 'wohnungsmarkt'],
    grouped: {
      left: [
        row('m1', 'left', 'taz', 'taz.de', 'Mietpreisbremse verlängert: Mieterbund begrüßt Schutz',
            'Die Mietpreisbremse wird verlängert. Der Mieterbund begrüßt den Schutz für steigende Mieten.', 0.90),
      ],
      center_left: [
        row('m2', 'center_left', 'Süddeutsche', 'sueddeutsche.de', 'Bundestag verlängert Mietpreisbremse',
            'Der Bundestag verlängert die Mietpreisbremse auf dem angespannten Wohnungsmarkt.', 0.86),
      ],
      center: [
        row('m3', 'center', 'WDR', 'wdr.de', 'Was die Mietpreisbremse für Mieten bedeutet',
            'Die Mietpreisbremse deckelt steigende Mieten auf dem Wohnungsmarkt der Ballungsräume.', 0.82),
        row('dm', 'center', 'Bild', 'bild.de', 'Bundestag beschließt höheres Wohngeld',
            'Der Bundestag beschließt mehr Wohngeld für Haushalte am angespannten Wohnungsmarkt.', 0.45), // DISTRACTOR: 1 word
      ],
      center_right: [
        row('m4', 'center_right', 'FAZ', 'faz.net', 'Kritik an der Mietpreisbremse',
            'Ökonomen warnen, die Mietpreisbremse verschärfe langfristig die Lage am Wohnungsmarkt.', 0.74),
      ],
      right: [],
    },
    relevantIds: ['m1', 'm2', 'm3', 'm4'],
    analysis: {
      analysis_topic: 'Mietpreisbremse Mieten Wohnungsmarkt',
      overall_non_partisan_analysis:
        'Der Bundestag verlängert die Mietpreisbremse auf dem angespannten Wohnungsmarkt. ' +
        'Die Mietpreisbremse deckelt steigende Mieten in den Ballungsräumen. ' +
        'Ökonomen warnen, die Mietpreisbremse verschärfe langfristig die Lage am Wohnungsmarkt.',
      news_spectrum: {
        left:   [card('taz', 'Mietpreisbremse verlängert: Mieterbund begrüßt Schutz', 'https://taz.de/m1')],
        center_left: [card('Süddeutsche', 'Bundestag verlängert Mietpreisbremse', 'https://sueddeutsche.de/m2')],
        center: [card('WDR', 'Was die Mietpreisbremse für Mieten bedeutet', 'https://wdr.de/m3')],
        center_right: [card('FAZ', 'Kritik an der Mietpreisbremse', 'https://faz.net/m4')],
        right: [],
      },
    },
  },

  // ── Case 5: Bürgergeld — a sanctions-debate distractor (b-x) coincidentally
  //    carries two topic words and SLIPS THROUGH the gate → precision hit (the
  //    substring gate's known limit, measured here).
  {
    id: 'buergergeld',
    topic: 'Bürgergeld Reform Sanktionen',
    keywords: ['bürgergeld', 'reform', 'sanktionen', 'jobcenter', 'arbeitslose'],
    topicWords: ['bürgergeld', 'reform', 'sanktionen'],
    grouped: {
      center_left: [
        row('b1', 'center_left', 'Spiegel', 'spiegel.de', 'Bürgergeld-Reform: schärfere Sanktionen beschlossen',
            'Die Bürgergeld-Reform bringt schärfere Sanktionen für Totalverweigerer.', 0.90),
      ],
      center: [
        row('b2', 'center', 'Tagesschau', 'tagesschau.de', 'Was die Bürgergeld-Reform ändert',
            'Die Bürgergeld-Reform verschärft die Sanktionen und ändert die Zuverdienstregeln.', 0.85),
        row('bx', 'center', 'Focus', 'focus.de', 'Reform der Sanktionen im Strafrecht geplant',
            'Eine Reform soll die Sanktionen im Strafrecht bei Wiederholungstätern verschärfen.', 0.55), // DISTRACTOR shares reform+sanktionen
      ],
      center_right: [
        row('b3', 'center_right', 'Welt', 'welt.de', 'Bürgergeld: Reform geht Kritikern nicht weit genug',
            'Kritiker monieren, die Bürgergeld-Reform und ihre Sanktionen blieben zu lasch.', 0.72),
      ],
      left: [
        row('b4', 'left', 'taz', 'taz.de', 'Bürgergeld-Reform: Sozialverbände warnen vor Sanktionen',
            'Sozialverbände warnen, die Sanktionen der Bürgergeld-Reform träfen die Schwächsten.', 0.68),
      ],
      right: [],
    },
    relevantIds: ['b1', 'b2', 'b3', 'b4'],
    analysis: {
      analysis_topic: 'Bürgergeld Reform Sanktionen',
      overall_non_partisan_analysis:
        'Die Bürgergeld-Reform bringt schärfere Sanktionen für Totalverweigerer. ' +
        'Sozialverbände warnen, die Sanktionen träfen die Schwächsten. ' +
        'Kritiker monieren, die Reform bleibe zu lasch.',
      news_spectrum: {
        center_left: [card('Spiegel', 'Bürgergeld-Reform: schärfere Sanktionen beschlossen', 'https://spiegel.de/b1')],
        center: [card('Tagesschau', 'Was die Bürgergeld-Reform ändert', 'https://tagesschau.de/b2')],
        center_right: [card('Welt', 'Bürgergeld: Reform geht Kritikern nicht weit genug', 'https://welt.de/b3')],
        left: [card('taz', 'Bürgergeld-Reform: Sozialverbände warnen vor Sanktionen', 'https://taz.de/b4')],
        right: [],
      },
    },
  },

  // ── Case 6: Atomausstieg — a genuinely on-topic right-camp piece (a-x) uses
  //    only ONE topic word and is dropped by the gate → recall hit (over-filtering
  //    surfaced honestly).
  {
    id: 'atom',
    topic: 'Atomausstieg Kernkraft Laufzeit',
    keywords: ['atomausstieg', 'kernkraft', 'laufzeit', 'akw', 'reaktor'],
    topicWords: ['atomausstieg', 'kernkraft', 'laufzeit'],
    grouped: {
      center_left: [
        row('a1', 'center_left', 'Zeit', 'zeit.de', 'Atomausstieg: Kernkraft endgültig vom Netz',
            'Mit dem Atomausstieg geht die Kernkraft in Deutschland endgültig vom Netz.', 0.91),
      ],
      center: [
        row('a2', 'center', 'ZDF', 'zdf.de', 'Atomausstieg vollzogen: was mit der Kernkraft endet',
            'Der Atomausstieg ist vollzogen; die Laufzeit der letzten Kernkraftwerke endete.', 0.84),
      ],
      center_right: [
        row('a3', 'center_right', 'FAZ', 'faz.net', 'Debatte um Kernkraft-Laufzeit neu entfacht',
            'Die Debatte um eine längere Laufzeit der Kernkraft ist nach dem Atomausstieg neu entfacht.', 0.76),
      ],
      right: [
        row('ax', 'right', 'Cicero', 'cicero.de', 'War der Atomausstieg ein Fehler?',
            'Manche fragen, ob der Atomausstieg angesichts hoher Strompreise ein Fehler war.', 0.40), // borderline: only "atomausstieg" → dropped
      ],
    },
    relevantIds: ['a1', 'a2', 'a3', 'ax'],
    analysis: {
      analysis_topic: 'Atomausstieg Kernkraft Laufzeit',
      overall_non_partisan_analysis:
        'Mit dem Atomausstieg geht die Kernkraft in Deutschland endgültig vom Netz. ' +
        'Die Laufzeit der letzten Kernkraftwerke endete. ' +
        'Die Debatte um eine längere Laufzeit der Kernkraft ist neu entfacht.',
      news_spectrum: {
        center_left: [card('Zeit', 'Atomausstieg: Kernkraft endgültig vom Netz', 'https://zeit.de/a1')],
        center: [card('ZDF', 'Atomausstieg vollzogen: was mit der Kernkraft endet', 'https://zdf.de/a2')],
        center_right: [card('FAZ', 'Debatte um Kernkraft-Laufzeit neu entfacht', 'https://faz.net/a3')],
        left: [], right: [],
      },
    },
  },

  // ── Case 7: Migration/Asyl — synthesis cites a card that does not resolve to any
  //    corpus row (mg-bad url) → grounding ratio < 1.
  {
    id: 'migration',
    topic: 'Asylpolitik Grenzkontrollen Migration',
    keywords: ['asylpolitik', 'grenzkontrollen', 'migration', 'asyl', 'geflüchtete'],
    topicWords: ['asylpolitik', 'grenzkontrollen', 'migration'],
    grouped: {
      left: [
        row('g1', 'left', 'taz', 'taz.de', 'Grenzkontrollen: Kritik an der Asylpolitik',
            'Menschenrechtler kritisieren die Grenzkontrollen und die verschärfte Asylpolitik bei der Migration.', 0.88),
      ],
      center: [
        row('g2', 'center', 'Tagesschau', 'tagesschau.de', 'Asylpolitik: Grenzkontrollen verlängert',
            'Die Bundesregierung verlängert die Grenzkontrollen und verschärft die Asylpolitik.', 0.84),
      ],
      center_right: [
        row('g3', 'center_right', 'Welt', 'welt.de', 'Migration: härtere Grenzkontrollen gefordert',
            'Die Union fordert in der Migration härtere Grenzkontrollen und eine strengere Asylpolitik.', 0.78),
      ],
      right: [
        row('g4', 'right', 'Junge Freiheit', 'jungefreiheit.de', 'Asylpolitik: Zahlen zur Migration steigen',
            'Die Asylpolitik steht unter Druck, weil die Zahlen zur Migration wieder steigen.', 0.60),
      ],
    },
    relevantIds: ['g1', 'g2', 'g3', 'g4'],
    analysis: {
      analysis_topic: 'Asylpolitik Grenzkontrollen Migration',
      overall_non_partisan_analysis:
        'Die Bundesregierung verlängert die Grenzkontrollen und verschärft die Asylpolitik. ' +
        'Die Union fordert in der Migration härtere Grenzkontrollen. ' +
        'Menschenrechtler kritisieren die verschärfte Asylpolitik.',
      news_spectrum: {
        left:   [card('taz', 'Grenzkontrollen: Kritik an der Asylpolitik', 'https://taz.de/g1')],
        center: [card('Tagesschau', 'Asylpolitik: Grenzkontrollen verlängert', 'https://tagesschau.de/g2')],
        center_right: [card('Welt', 'Migration: härtere Grenzkontrollen gefordert', 'https://welt.de/g3')],
        right:  [card('Junge Freiheit', 'Ein ganz anderer Artikel', 'https://jungefreiheit.de/unrelated-xyz')], // UNGROUNDED
      },
    },
  },

  // ── Case 8: Heizungsgesetz (GEG) — one synthesis sentence has no corpus backing
  //    → claim support < 1.
  {
    id: 'heizung',
    topic: 'Heizungsgesetz Wärmepumpe Förderung',
    keywords: ['heizungsgesetz', 'wärmepumpe', 'förderung', 'geg', 'heizung'],
    topicWords: ['heizungsgesetz', 'wärmepumpe', 'förderung'],
    grouped: {
      center_left: [
        row('h1', 'center_left', 'Süddeutsche', 'sueddeutsche.de', 'Heizungsgesetz: Förderung für Wärmepumpe steigt',
            'Das Heizungsgesetz erhöht die Förderung für den Einbau einer Wärmepumpe.', 0.89),
      ],
      center: [
        row('h2', 'center', 'NDR', 'ndr.de', 'Was das Heizungsgesetz für die Wärmepumpe bedeutet',
            'Das Heizungsgesetz schreibt klimafreundliches Heizen vor; die Wärmepumpe wird gefördert.', 0.83),
      ],
      center_right: [
        row('h3', 'center_right', 'FAZ', 'faz.net', 'Heizungsgesetz: Kritik an Kosten der Wärmepumpe',
            'Eigentümerverbände kritisieren die Kosten der Wärmepumpe trotz Förderung im Heizungsgesetz.', 0.74),
      ],
      left: [], right: [],
    },
    relevantIds: ['h1', 'h2', 'h3'],
    analysis: {
      analysis_topic: 'Heizungsgesetz Wärmepumpe Förderung',
      overall_non_partisan_analysis:
        'Das Heizungsgesetz erhöht die Förderung für den Einbau einer Wärmepumpe. ' +
        'Eigentümerverbände kritisieren die Kosten der Wärmepumpe trotz Förderung. ' +
        'Das Gesetz wurde vom Bundesrat einstimmig und ohne Aussprache gebilligt.', // UNSUPPORTED (not in corpus)
      news_spectrum: {
        center_left: [card('Süddeutsche', 'Heizungsgesetz: Förderung für Wärmepumpe steigt', 'https://sueddeutsche.de/h1')],
        center: [card('NDR', 'Was das Heizungsgesetz für die Wärmepumpe bedeutet', 'https://ndr.de/h2')],
        center_right: [card('FAZ', 'Heizungsgesetz: Kritik an Kosten der Wärmepumpe', 'https://faz.net/h3')],
        left: [], right: [],
      },
    },
  },

  // ── Case 9: Tempolimit — clean, well-covered across the spectrum.
  {
    id: 'tempolimit',
    topic: 'Tempolimit Autobahn Verkehr',
    keywords: ['tempolimit', 'autobahn', 'verkehr', 'geschwindigkeit', 'klima'],
    topicWords: ['tempolimit', 'autobahn', 'verkehr'],
    grouped: {
      left: [
        row('t1', 'left', 'taz', 'taz.de', 'Tempolimit auf der Autobahn gefordert',
            'Umweltverbände fordern ein generelles Tempolimit auf der Autobahn für weniger Verkehr-Emissionen.', 0.88),
      ],
      center_left: [
        row('t2', 'center_left', 'Zeit', 'zeit.de', 'Tempolimit: was es für den Verkehr brächte',
            'Ein Tempolimit auf der Autobahn könnte den Verkehr sicherer und klimafreundlicher machen.', 0.84),
      ],
      center: [
        row('t3', 'center', 'Tagesschau', 'tagesschau.de', 'Debatte um Tempolimit auf der Autobahn',
            'Die Debatte um ein Tempolimit auf der Autobahn flammt im Verkehr-Ausschuss wieder auf.', 0.80),
      ],
      center_right: [
        row('t4', 'center_right', 'Welt', 'welt.de', 'Tempolimit: Autofahrer-Verbände dagegen',
            'Autofahrer-Verbände lehnen ein Tempolimit auf der Autobahn als Eingriff in den Verkehr ab.', 0.72),
      ],
      right: [],
    },
    relevantIds: ['t1', 't2', 't3', 't4'],
    analysis: {
      analysis_topic: 'Tempolimit Autobahn Verkehr',
      overall_non_partisan_analysis:
        'Umweltverbände fordern ein generelles Tempolimit auf der Autobahn. ' +
        'Die Debatte um ein Tempolimit flammt im Verkehr-Ausschuss wieder auf. ' +
        'Autofahrer-Verbände lehnen ein Tempolimit auf der Autobahn ab.',
      news_spectrum: {
        left:   [card('taz', 'Tempolimit auf der Autobahn gefordert', 'https://taz.de/t1')],
        center_left: [card('Zeit', 'Tempolimit: was es für den Verkehr brächte', 'https://zeit.de/t2')],
        center: [card('Tagesschau', 'Debatte um Tempolimit auf der Autobahn', 'https://tagesschau.de/t3')],
        center_right: [card('Welt', 'Tempolimit: Autofahrer-Verbände dagegen', 'https://welt.de/t4')],
        right: [],
      },
    },
  },

  // ── Case 10: Wehrpflicht — clean; an unrelated NATO-summit distractor is dropped.
  {
    id: 'wehrpflicht',
    topic: 'Wehrpflicht Bundeswehr Wehrdienst',
    keywords: ['wehrpflicht', 'bundeswehr', 'wehrdienst', 'soldaten', 'musterung'],
    topicWords: ['wehrpflicht', 'bundeswehr', 'wehrdienst'],
    grouped: {
      center_left: [
        row('w1', 'center_left', 'Spiegel', 'spiegel.de', 'Neuer Wehrdienst: Debatte um die Wehrpflicht',
            'Die Debatte um eine neue Wehrpflicht und einen attraktiveren Wehrdienst der Bundeswehr nimmt Fahrt auf.', 0.90),
      ],
      center: [
        row('w2', 'center', 'ZDF', 'zdf.de', 'Bundeswehr: Modell für den neuen Wehrdienst',
            'Das Verteidigungsministerium stellt ein Modell für den neuen Wehrdienst der Bundeswehr vor.', 0.85),
        row('dw', 'center', 'Kicker', 'kicker.de', 'DFB-Elf gewinnt das Testspiel',
            'Die deutsche Nationalmannschaft gewinnt ihr Testspiel mit 2:0.', 0.30), // DISTRACTOR: no topic words
      ],
      center_right: [
        row('w3', 'center_right', 'Welt', 'welt.de', 'Wehrpflicht: Union dringt auf Rückkehr',
            'Die Union dringt auf eine Rückkehr zur Wehrpflicht zur Stärkung der Bundeswehr.', 0.74),
      ],
      left: [
        row('w4', 'left', 'taz', 'taz.de', 'Gegen die Wehrpflicht: Friedensbewegung protestiert',
            'Die Friedensbewegung protestiert gegen eine neue Wehrpflicht und einen Pflicht-Wehrdienst.', 0.66),
      ],
      right: [],
    },
    relevantIds: ['w1', 'w2', 'w3', 'w4'],
    analysis: {
      analysis_topic: 'Wehrpflicht Bundeswehr Wehrdienst',
      overall_non_partisan_analysis:
        'Die Debatte um eine neue Wehrpflicht und einen attraktiveren Wehrdienst der Bundeswehr nimmt Fahrt auf. ' +
        'Die Union dringt auf eine Rückkehr zur Wehrpflicht. ' +
        'Die Friedensbewegung protestiert gegen einen Pflicht-Wehrdienst.',
      news_spectrum: {
        center_left: [card('Spiegel', 'Neuer Wehrdienst: Debatte um die Wehrpflicht', 'https://spiegel.de/w1')],
        center: [card('ZDF', 'Bundeswehr: Modell für den neuen Wehrdienst', 'https://zdf.de/w2')],
        center_right: [card('Welt', 'Wehrpflicht: Union dringt auf Rückkehr', 'https://welt.de/w3')],
        left: [card('taz', 'Gegen die Wehrpflicht: Friedensbewegung protestiert', 'https://taz.de/w4')],
        right: [],
      },
    },
  },

  // ── Case 11: Krankenhausreform — clean, regional + flagship mix.
  {
    id: 'krankenhaus',
    topic: 'Krankenhausreform Kliniken Finanzierung',
    keywords: ['krankenhausreform', 'kliniken', 'finanzierung', 'klinik', 'gesundheit'],
    topicWords: ['krankenhausreform', 'kliniken', 'finanzierung'],
    grouped: {
      center_left: [
        row('kh1', 'center_left', 'RND', 'rnd.de', 'Krankenhausreform: neue Finanzierung der Kliniken',
            'Die Krankenhausreform stellt die Finanzierung der Kliniken auf Vorhaltepauschalen um.', 0.89),
      ],
      center: [
        row('kh2', 'center', 'Tagesschau', 'tagesschau.de', 'Was die Krankenhausreform für Kliniken bedeutet',
            'Die Krankenhausreform soll die Finanzierung sichern und kleine Kliniken spezialisieren.', 0.83),
      ],
      center_right: [
        row('kh3', 'center_right', 'Rheinische Post', 'rp-online.de', 'Krankenhausreform: Länder fürchten um Kliniken',
            'Die Länder warnen, die Krankenhausreform gefährde die Finanzierung ländlicher Kliniken.', 0.75),
      ],
      left: [], right: [],
    },
    relevantIds: ['kh1', 'kh2', 'kh3'],
    analysis: {
      analysis_topic: 'Krankenhausreform Kliniken Finanzierung',
      overall_non_partisan_analysis:
        'Die Krankenhausreform stellt die Finanzierung der Kliniken auf Vorhaltepauschalen um. ' +
        'Die Reform soll kleine Kliniken spezialisieren. ' +
        'Die Länder warnen, die Reform gefährde die Finanzierung ländlicher Kliniken.',
      news_spectrum: {
        center_left: [card('RND', 'Krankenhausreform: neue Finanzierung der Kliniken', 'https://rnd.de/kh1')],
        center: [card('Tagesschau', 'Was die Krankenhausreform für Kliniken bedeutet', 'https://tagesschau.de/kh2')],
        center_right: [card('Rheinische Post', 'Krankenhausreform: Länder fürchten um Kliniken', 'https://rp-online.de/kh3')],
        left: [], right: [],
      },
    },
  },

  // ── Case 12: Deutschlandticket — clean.
  {
    id: 'dticket',
    topic: 'Deutschlandticket Nahverkehr Preis',
    keywords: ['deutschlandticket', 'nahverkehr', 'preis', 'öpnv', 'bahn'],
    topicWords: ['deutschlandticket', 'nahverkehr', 'preis'],
    grouped: {
      center_left: [
        row('dt1', 'center_left', 'Zeit', 'zeit.de', 'Deutschlandticket: Preis steigt im Nahverkehr',
            'Der Preis für das Deutschlandticket steigt; es bleibt im Nahverkehr bundesweit gültig.', 0.88),
      ],
      center: [
        row('dt2', 'center', 'Tagesschau', 'tagesschau.de', 'Deutschlandticket: Finanzierung des Nahverkehrs',
            'Bund und Länder ringen um die Finanzierung des Deutschlandtickets im Nahverkehr.', 0.82),
      ],
      center_right: [
        row('dt3', 'center_right', 'Handelsblatt', 'handelsblatt.com', 'Deutschlandticket: Preis und Wirtschaftlichkeit',
            'Verkehrsbetriebe zweifeln, ob der Preis des Deutschlandtickets den Nahverkehr trägt.', 0.73),
      ],
      left: [], right: [],
    },
    relevantIds: ['dt1', 'dt2', 'dt3'],
    analysis: {
      analysis_topic: 'Deutschlandticket Nahverkehr Preis',
      overall_non_partisan_analysis:
        'Der Preis für das Deutschlandticket steigt; es bleibt im Nahverkehr bundesweit gültig. ' +
        'Bund und Länder ringen um die Finanzierung des Deutschlandtickets im Nahverkehr. ' +
        'Verkehrsbetriebe zweifeln, ob der Preis den Nahverkehr trägt.',
      news_spectrum: {
        center_left: [card('Zeit', 'Deutschlandticket: Preis steigt im Nahverkehr', 'https://zeit.de/dt1')],
        center: [card('Tagesschau', 'Deutschlandticket: Finanzierung des Nahverkehrs', 'https://tagesschau.de/dt2')],
        center_right: [card('Handelsblatt', 'Deutschlandticket: Preis und Wirtschaftlichkeit', 'https://handelsblatt.com/dt3')],
        left: [], right: [],
      },
    },
  },

  // ── Case 13: Lieferkettengesetz — clean, business-press heavy.
  {
    id: 'lieferkette',
    topic: 'Lieferkettengesetz Unternehmen Sorgfaltspflicht',
    keywords: ['lieferkettengesetz', 'unternehmen', 'sorgfaltspflicht', 'lieferkette', 'menschenrechte'],
    topicWords: ['lieferkettengesetz', 'unternehmen', 'sorgfaltspflicht'],
    grouped: {
      center_left: [
        row('l1', 'center_left', 'Süddeutsche', 'sueddeutsche.de', 'Lieferkettengesetz: Sorgfaltspflicht für Unternehmen',
            'Das Lieferkettengesetz verpflichtet Unternehmen zu mehr Sorgfaltspflicht entlang der Lieferkette.', 0.87),
      ],
      center: [
        row('l2', 'center', 'Tagesschau', 'tagesschau.de', 'Was das Lieferkettengesetz für Unternehmen heißt',
            'Das Lieferkettengesetz erlegt Unternehmen eine Sorgfaltspflicht für Menschenrechte auf.', 0.81),
      ],
      center_right: [
        row('l3', 'center_right', 'Handelsblatt', 'handelsblatt.com', 'Lieferkettengesetz: Bürokratie für Unternehmen',
            'Wirtschaftsverbände warnen, die Sorgfaltspflicht des Lieferkettengesetzes überfordere Unternehmen.', 0.74),
      ],
      left: [], right: [],
    },
    relevantIds: ['l1', 'l2', 'l3'],
    analysis: {
      analysis_topic: 'Lieferkettengesetz Unternehmen Sorgfaltspflicht',
      overall_non_partisan_analysis:
        'Das Lieferkettengesetz verpflichtet Unternehmen zu mehr Sorgfaltspflicht entlang der Lieferkette. ' +
        'Es erlegt Unternehmen eine Sorgfaltspflicht für Menschenrechte auf. ' +
        'Wirtschaftsverbände warnen, die Sorgfaltspflicht überfordere Unternehmen.',
      news_spectrum: {
        center_left: [card('Süddeutsche', 'Lieferkettengesetz: Sorgfaltspflicht für Unternehmen', 'https://sueddeutsche.de/l1')],
        center: [card('Tagesschau', 'Was das Lieferkettengesetz für Unternehmen heißt', 'https://tagesschau.de/l2')],
        center_right: [card('Handelsblatt', 'Lieferkettengesetz: Bürokratie für Unternehmen', 'https://handelsblatt.com/l3')],
        left: [], right: [],
      },
    },
  },

  // ── Case 14: Strompreis Industrie — borderline left piece (s-x) has one topic
  //    word and is dropped → recall hit.
  {
    id: 'strompreis',
    topic: 'Strompreis Industrie Entlastung',
    keywords: ['strompreis', 'industrie', 'entlastung', 'energie', 'strom'],
    topicWords: ['strompreis', 'industrie', 'entlastung'],
    grouped: {
      center_left: [
        row('s1', 'center_left', 'Spiegel', 'spiegel.de', 'Strompreis: Entlastung für die Industrie geplant',
            'Die Regierung plant eine Entlastung beim Strompreis für die energieintensive Industrie.', 0.89),
      ],
      center: [
        row('s2', 'center', 'Tagesschau', 'tagesschau.de', 'Strompreis-Entlastung: Streit in der Industrie',
            'Über die Strompreis-Entlastung für die Industrie gibt es Streit in der Koalition.', 0.83),
      ],
      center_right: [
        row('s3', 'center_right', 'Handelsblatt', 'handelsblatt.com', 'Industrie fordert dauerhafte Strompreis-Entlastung',
            'Die Industrie fordert eine dauerhafte Entlastung beim Strompreis statt einer Brücke.', 0.77),
      ],
      left: [
        row('sx', 'left', 'taz', 'taz.de', 'Wer von der Entlastung wirklich profitiert',
            'Kritiker fragen, wer von der geplanten Entlastung am Ende wirklich profitiert.', 0.42), // borderline: only "entlastung" → dropped
      ],
    },
    relevantIds: ['s1', 's2', 's3', 'sx'],
    analysis: {
      analysis_topic: 'Strompreis Industrie Entlastung',
      overall_non_partisan_analysis:
        'Die Regierung plant eine Entlastung beim Strompreis für die energieintensive Industrie. ' +
        'Über die Strompreis-Entlastung gibt es Streit in der Koalition. ' +
        'Die Industrie fordert eine dauerhafte Entlastung beim Strompreis.',
      news_spectrum: {
        center_left: [card('Spiegel', 'Strompreis: Entlastung für die Industrie geplant', 'https://spiegel.de/s1')],
        center: [card('Tagesschau', 'Strompreis-Entlastung: Streit in der Industrie', 'https://tagesschau.de/s2')],
        center_right: [card('Handelsblatt', 'Industrie fordert dauerhafte Strompreis-Entlastung', 'https://handelsblatt.com/s3')],
        left: [], right: [],
      },
    },
  },

  // ── Case 15: KI-Regulierung — clean, tech-policy.
  {
    id: 'ki',
    topic: 'KI-Regulierung KI-Gesetz Aufsicht',
    keywords: ['ki-regulierung', 'ki-gesetz', 'aufsicht', 'künstliche', 'algorithmen'],
    topicWords: ['ki-regulierung', 'ki-gesetz', 'aufsicht'],
    grouped: {
      center_left: [
        row('ki1', 'center_left', 'Zeit', 'zeit.de', 'KI-Regulierung: das neue KI-Gesetz im Detail',
            'Die KI-Regulierung der EU bringt mit dem KI-Gesetz eine Aufsicht für Hochrisiko-Systeme.', 0.88),
      ],
      center: [
        row('ki2', 'center', 'Heise', 'heise.de', 'KI-Gesetz: wie die Aufsicht funktionieren soll',
            'Das KI-Gesetz regelt die KI-Regulierung über eine neue Aufsicht und Risikoklassen.', 0.82),
      ],
      center_right: [
        row('ki3', 'center_right', 'Handelsblatt', 'handelsblatt.com', 'KI-Regulierung: Wirtschaft warnt vor Aufsicht',
            'Die Wirtschaft warnt, die KI-Regulierung und ihre Aufsicht bremsten Innovation.', 0.74),
      ],
      left: [], right: [],
    },
    relevantIds: ['ki1', 'ki2', 'ki3'],
    analysis: {
      analysis_topic: 'KI-Regulierung KI-Gesetz Aufsicht',
      overall_non_partisan_analysis:
        'Die KI-Regulierung der EU bringt mit dem KI-Gesetz eine Aufsicht für Hochrisiko-Systeme. ' +
        'Das KI-Gesetz regelt die Aufsicht über Risikoklassen. ' +
        'Die Wirtschaft warnt, die Aufsicht bremse Innovation.',
      news_spectrum: {
        center_left: [card('Zeit', 'KI-Regulierung: das neue KI-Gesetz im Detail', 'https://zeit.de/ki1')],
        center: [card('Heise', 'KI-Gesetz: wie die Aufsicht funktionieren soll', 'https://heise.de/ki2')],
        center_right: [card('Handelsblatt', 'KI-Regulierung: Wirtschaft warnt vor Aufsicht', 'https://handelsblatt.com/ki3')],
        left: [], right: [],
      },
    },
  },
];
