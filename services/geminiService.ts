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
