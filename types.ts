export type CoverageEstimate = 'high' | 'medium' | 'low';

export interface CoverageEntry {
  estimate: CoverageEstimate;
  percent: number;
}

export interface NewsSource {
  source_name: string;
  article_title: string;
  article_url: string;
  summary_of_perspective: string;
  publication_date?: string;
  url_valid?: boolean;
  url_is_search_fallback?: boolean;
}

export interface SharedFact {
  claim: string;
}

export interface DivergingPoint {
  topic: string;
  left_view: string;
  center_view: string;
  right_view: string;
}

export interface SilencedTopic {
  topic: string;
  only_in: 'left' | 'center' | 'right' | 'none';
  description: string;
}

export interface DeepAnalysis {
  shared_facts: SharedFact[];
  diverging_points: DivergingPoint[];
  silenced_topics: SilencedTopic[];
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
  coverage_distribution?: {
    left: CoverageEntry;
    center: CoverageEntry;
    right: CoverageEntry;
  };
  deep_analysis?: DeepAnalysis;
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
