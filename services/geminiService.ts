import { NewsAnalysisResult, DeepAnalysis } from "../types";

export const analyzeTopic = async (topic: string, lang: string = 'de', token?: string): Promise<NewsAnalysisResult> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'accept-language-app': lang,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify({ topic, lang }),
  });

  if (!response.ok) {
    let message = response.status === 503
      ? 'Server is busy, please try again in a moment.'
      : `Server error ${response.status}`;
    try {
      const errorData = await response.json();
      message = errorData.error || errorData.message || message;
    } catch {
      // non-JSON error body (e.g. Railway 503 "Service Unavailable")
    }
    throw new Error(message);
  }

  return response.json();
};

// ── SSE streaming analysis ─────────────────────────────────────────────────────
// Returns a cleanup/abort function. Call it to cancel the stream (e.g. on unmount).
//
// Events emitted:
//   'rss'    — partial result after ~2s (real article links, coverage bar)
//   'result' — full AI analysis after ~15-35s
//   'error'  — something went wrong

export type StreamPhase = 'rss' | 'result';

export type StreamEvent =
  | { type: 'rss';    data: Partial<NewsAnalysisResult> }
  | { type: 'result'; data: NewsAnalysisResult }
  | { type: 'error';  message: string; status?: number };

export const analyzeTopicStream = (
  topic:   string,
  lang:    string,
  token:   string | undefined,
  onEvent: (event: StreamEvent) => void,
): (() => void) => {
  const url = new URL('/api/analyze/stream', window.location.origin);
  url.searchParams.set('topic', topic);
  url.searchParams.set('lang',  lang);

  const controller = new AbortController();
  let cancelled = false;

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  fetch(url.toString(), { headers, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) {
        let message = `Server error ${response.status}`;
        try {
          const err = await response.json();
          message = err.error || err.message || message;
        } catch { /* ignore */ }
        onEvent({ type: 'error', message, status: response.status });
        return;
      }

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      let eventType = '';
      let dataStr   = '';

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE format: lines separated by \n, events separated by \n\n
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6);
          } else if (line === '') {
            // blank line = end of event
            if (eventType && dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                if (eventType === 'rss') {
                  onEvent({ type: 'rss', data: parsed });
                } else if (eventType === 'result') {
                  onEvent({ type: 'result', data: parsed });
                } else if (eventType === 'error') {
                  onEvent({ type: 'error', message: parsed.message ?? 'Unknown error' });
                }
                // 'done' event: ignore (stream ends naturally)
              } catch (e) {
                console.error('[SSE] Parse error:', e);
              }
            }
            eventType = '';
            dataStr   = '';
          }
        }
      }
    })
    .catch((err) => {
      if (!cancelled) {
        onEvent({ type: 'error', message: err.message ?? 'Stream failed' });
      }
    });

  return () => {
    cancelled = true;
    controller.abort();
  };
};

/** Fetch deep analysis separately — runs after main result is already shown. */
export const fetchDeepAnalysis = async (topic: string, lang: string): Promise<DeepAnalysis | null> => {
  try {
    const response = await fetch('/api/deep-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, lang }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.deep_analysis ?? null;
  } catch {
    return null;
  }
};
