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
    const errorData = await response.json();
    throw new Error(errorData.error || 'Analysis failed');
  }

  return response.json();
};
