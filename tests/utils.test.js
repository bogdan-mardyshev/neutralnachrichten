/**
 * tests/utils.test.js
 *
 * Tests for lib/utils.js — shared utility functions.
 */

import { describe, it, expect } from 'vitest';
import { extractJSON, balanceJson } from '../lib/utils.js';

describe('extractJSON', () => {
  it('parses a clean JSON object', () => {
    const result = extractJSON('{"key":"value","n":42}');
    expect(result).toEqual({ key: 'value', n: 42 });
  });

  it('strips markdown code fences (```json ... ```)', () => {
    const raw = '```json\n{"a":1}\n```';
    expect(extractJSON(raw)).toEqual({ a: 1 });
  });

  it('strips plain triple-backtick fences (``` ... ```)', () => {
    const raw = '```\n{"b":2}\n```';
    expect(extractJSON(raw)).toEqual({ b: 2 });
  });

  it('extracts JSON from surrounding prose', () => {
    const raw = 'Here is the result:\n{"c":3}\nEnd of output.';
    expect(extractJSON(raw)).toEqual({ c: 3 });
  });

  it('repairs trailing commas before }', () => {
    const raw = '{"x":1,"y":2,}';
    expect(extractJSON(raw)).toEqual({ x: 1, y: 2 });
  });

  it('repairs trailing commas before ]', () => {
    const raw = '{"arr":[1,2,3,]}';
    expect(extractJSON(raw)).toEqual({ arr: [1, 2, 3] });
  });

  it('replaces :undefined with :null', () => {
    const raw = '{"val":undefined}';
    expect(extractJSON(raw)).toEqual({ val: null });
  });

  it('handles nested objects and arrays', () => {
    const raw = '{"a":{"b":[1,2,{"c":"d"}]}}';
    expect(extractJSON(raw)).toEqual({ a: { b: [1, 2, { c: 'd' }] } });
  });

  it('throws when there is no JSON object', () => {
    expect(() => extractJSON('no braces here')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => extractJSON('')).toThrow();
  });

  it('throws on null input', () => {
    expect(() => extractJSON(null)).toThrow();
  });

  it('throws on unparseable JSON that repair cannot fix', () => {
    expect(() => extractJSON('{not valid json at all :::}')).toThrow();
  });

  it('extracts first/last brace pair when there are multiple JSON-like fragments', () => {
    const raw = 'start {"outer":{"inner":1}} end';
    const result = extractJSON(raw);
    expect(result).toEqual({ outer: { inner: 1 } });
  });

  // ── Recovery of malformed/truncated Gemini output (incident: [RSS-Direct] json_parse_error) ──
  it('replaces raw control characters illegal inside JSON strings', () => {
    expect(extractJSON('{"a":"line1\nline2\ttab"}')).toEqual({ a: 'line1 line2 tab' });
  });

  it('recovers a truncated array (no closing brackets)', () => {
    expect(extractJSON('{"arr":[1,2,3')).toEqual({ arr: [1, 2, 3] });
  });

  it('recovers a truncated array of objects — keeps the complete elements', () => {
    expect(extractJSON('{"news":[{"t":"a"},{"t":"b"')).toEqual({ news: [{ t: 'a' }] });
  });

  it('closes an unterminated string at truncation', () => {
    expect(extractJSON('{"a":1,"b":"unterminated')).toEqual({ a: 1, b: 'unterminated' });
  });

  it('still throws when there is no JSON object at all', () => {
    expect(() => extractJSON('totally not json')).toThrow();
  });
});

describe('balanceJson', () => {
  it('closes unclosed brackets in order', () => {
    expect(JSON.parse(balanceJson('{"a":[1,2'))).toEqual({ a: [1, 2] });
    expect(JSON.parse(balanceJson('{"a":{"b":1'))).toEqual({ a: { b: 1 } });
  });
  it('drops a dangling trailing comma before closing', () => {
    expect(JSON.parse(balanceJson('{"a":[1,2,'))).toEqual({ a: [1, 2] });
  });
  it('leaves already-valid JSON parseable', () => {
    expect(JSON.parse(balanceJson('{"a":1}'))).toEqual({ a: 1 });
  });
});
