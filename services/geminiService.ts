import { NewsAnalysisResult } from "../types";

export const analyzeTopic = async (topic: string, lang: string = 'de'): Promise<NewsAnalysisResult> => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept-language-app': lang
    },
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
