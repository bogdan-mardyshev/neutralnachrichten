export interface NewsSource {
  source_name: string;
  article_title: string;
  article_url: string;
  summary_of_perspective: string;
  publication_date: string;
}

export interface NewsAnalysisResult {
  analysis_topic: string;
  response_language: 'de' | 'en' | 'ru';
  overall_non_partisan_analysis: string;
  news_spectrum: {
    left: NewsSource;
    center: NewsSource;
    right: NewsSource;
  };
  _meta?: {
    degraded: boolean;
    validation_summary?: {
      valid_sources: number;
      total_sources: number;
      issues: Record<string, string[]>;
    };
  };
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
