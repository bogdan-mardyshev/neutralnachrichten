import { describe, it, expect } from 'vitest';
import { validateAnalysisStructure, buildDeepAnalysisPrompt, SPECTRUMS } from '../lib/analysisValidator.js';

// ────────────────────────────────────────────────────────────
// validateAnalysisStructure
// ────────────────────────────────────────────────────────────

describe('validateAnalysisStructure', () => {
  const makeValid = (overrides = {}) => ({
    analysis_topic: 'TestThema',
    overall_non_partisan_analysis: 'Eine ausführliche unparteiische Analyse des Themas.',
    news_spectrum: {
      left:          [{ source_name: 'taz', summary_of_perspective: 'Linke Perspektive.' }],
      center_left:   [{ source_name: 'Spiegel', summary_of_perspective: 'Mitte-links.' }],
      center:        [{ source_name: 'Tagesschau', summary_of_perspective: 'Mitte.' }],
      center_right:  [{ source_name: 'FAZ', summary_of_perspective: 'Mitte-rechts.' }],
      right:         [{ source_name: 'Bild', summary_of_perspective: 'Rechte Perspektive.' }],
    },
    ...overrides,
  });

  it('returns true for a fully valid structure', () => {
    expect(validateAnalysisStructure(makeValid())).toBe(true);
  });

  it('returns false for null input', () => {
    expect(validateAnalysisStructure(null)).toBe(false);
  });

  it('returns false for non-object input', () => {
    expect(validateAnalysisStructure('string')).toBe(false);
    expect(validateAnalysisStructure(42)).toBe(false);
  });

  it('returns false when overall_non_partisan_analysis is missing', () => {
    const data = makeValid();
    delete data.overall_non_partisan_analysis;
    expect(validateAnalysisStructure(data)).toBe(false);
  });

  it('returns false when news_spectrum is missing', () => {
    const data = makeValid();
    delete data.news_spectrum;
    expect(validateAnalysisStructure(data)).toBe(false);
  });

  it('returns false when overall_non_partisan_analysis is too short (<= 20 chars)', () => {
    const data = makeValid({ overall_non_partisan_analysis: 'Kurz.' });
    data.news_spectrum = { left: [], center_left: [], center: [], center_right: [], right: [] };
    expect(validateAnalysisStructure(data)).toBe(false);
  });

  // ── The bug we fixed: Gemini returns null for spectra with no coverage ────────

  it('normalizes null spectrum values to [] instead of failing (regression test)', () => {
    const data = makeValid();
    // Gemini sometimes returns null for spectra it couldn't find
    data.news_spectrum.right = null;
    data.news_spectrum.left  = null;
    expect(validateAnalysisStructure(data)).toBe(true);
    // Keys should be normalized to arrays
    expect(Array.isArray(data.news_spectrum.right)).toBe(true);
    expect(Array.isArray(data.news_spectrum.left)).toBe(true);
  });

  it('accepts when ALL spectra are empty but overall_analysis is substantive (Migration 2025 case)', () => {
    const data = {
      analysis_topic: 'Migration 2025',
      overall_non_partisan_analysis:
        'Die Migrationsdebatte 2025 zeigt tiefe politische Spaltung in Deutschland.',
      news_spectrum: {
        left:         null,
        center_left:  null,
        center:       null,
        center_right: null,
        right:        null,
      },
    };
    expect(validateAnalysisStructure(data)).toBe(true);
    // All nulls normalized to []
    for (const key of SPECTRUMS) {
      expect(data.news_spectrum[key]).toEqual([]);
    }
  });

  it('normalizes missing (undefined) spectrum key to []', () => {
    const data = makeValid();
    delete data.news_spectrum.right;
    const result = validateAnalysisStructure(data);
    expect(result).toBe(true);
    expect(data.news_spectrum.right).toEqual([]);
  });

  it('normalizes a number (non-array) spectrum value to []', () => {
    const data = makeValid();
    data.news_spectrum.center = 42; // invalid type
    expect(validateAnalysisStructure(data)).toBe(true);
    expect(data.news_spectrum.center).toEqual([]);
  });

  it('returns false when news_spectrum is not an object', () => {
    expect(validateAnalysisStructure({ overall_non_partisan_analysis: 'x'.repeat(25), news_spectrum: 'invalid' })).toBe(false);
  });

  it('SPECTRUMS array has exactly the five expected keys', () => {
    expect(SPECTRUMS).toEqual(['left', 'center_left', 'center', 'center_right', 'right']);
  });
});

// ────────────────────────────────────────────────────────────
// buildDeepAnalysisPrompt
// ────────────────────────────────────────────────────────────

describe('buildDeepAnalysisPrompt', () => {
  const makeAnalysis = (spectrumOverrides = {}) => ({
    analysis_topic: 'Klimawandel',
    news_spectrum: {
      left:          [{ source_name: 'taz', summary_of_perspective: 'Klimakrise ist existenziell.' }],
      center_left:   [{ source_name: 'Spiegel', summary_of_perspective: 'Handlungsbedarf.' }],
      center:        [{ source_name: 'ARD', summary_of_perspective: 'Faktenbasierte Berichterstattung.' }],
      center_right:  [{ source_name: 'FAZ', summary_of_perspective: 'Wirtschaftliche Konsequenzen.' }],
      right:         [{ source_name: 'Bild', summary_of_perspective: 'Kosten für Bürger.' }],
      ...spectrumOverrides,
    },
  });

  it('includes the topic in the prompt', () => {
    const prompt = buildDeepAnalysisPrompt(makeAnalysis());
    expect(prompt).toContain('Klimawandel');
  });

  it('includes source names for all five spectra', () => {
    const prompt = buildDeepAnalysisPrompt(makeAnalysis());
    expect(prompt).toContain('taz');
    expect(prompt).toContain('Spiegel');
    expect(prompt).toContain('ARD');
    expect(prompt).toContain('FAZ');
    expect(prompt).toContain('Bild');
  });

  it('uses EMPTY placeholder for null spectrum — no crash (DeepAnalysis regression test)', () => {
    // This was the crash: "Cannot read properties of undefined (reading 'source_name')"
    const analysis = makeAnalysis({ left: null, right: [] });
    expect(() => buildDeepAnalysisPrompt(analysis)).not.toThrow();
    const prompt = buildDeepAnalysisPrompt(analysis);
    expect(prompt).toContain('n/a');
    expect(prompt).toContain('Keine Berichterstattung gefunden');
  });

  it('uses EMPTY placeholder for empty spectrum array', () => {
    const analysis = makeAnalysis({ center: [] });
    const prompt = buildDeepAnalysisPrompt(analysis);
    // Should not throw and should use placeholder
    expect(prompt).toContain('n/a');
  });

  it('uses EMPTY placeholder when only "Kein Artikel gefunden" source exists', () => {
    const analysis = makeAnalysis({
      right: [{ source_name: 'Kein Artikel gefunden', summary_of_perspective: 'Nichts gefunden.' }],
    });
    const prompt = buildDeepAnalysisPrompt(analysis);
    expect(prompt).toContain('n/a');
  });

  it('includes JSON schema and rules section', () => {
    const prompt = buildDeepAnalysisPrompt(makeAnalysis());
    expect(prompt).toContain('shared_facts');
    expect(prompt).toContain('diverging_points');
    expect(prompt).toContain('silenced_topics');
    expect(prompt).toContain('keywords');
    expect(prompt).toContain('sentiment');
    expect(prompt).toContain('coverage_volume');
  });

  it('includes OUTPUT RULES section', () => {
    const prompt = buildDeepAnalysisPrompt(makeAnalysis());
    expect(prompt).toContain('Output ONLY the JSON object');
    expect(prompt).toContain('Response must start with {');
  });
});
