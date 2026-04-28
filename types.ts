export type CoverageEstimate = 'high' | 'medium' | 'low';

export interface CoverageEntry {
  estimate: CoverageEstimate;
  percent: number;
}

export type SpectrumKey = 'left' | 'center_left' | 'center' | 'center_right' | 'right';

export interface NewsSource {
  source_name: string;
  source_domain: string;
  article_title: string;
  article_url: string;
  summary_of_perspective: string;
  publication_date?: string;
  url_valid?: boolean;
  url_is_search_fallback?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface SharedFact {
  claim: string;
}

export interface DivergingPoint {
  topic: string;
  left_view: string;
  center_left_view: string;
  center_view: string;
  center_right_view: string;
  right_view: string;
}

export interface SilencedTopic {
  topic: string;
  only_in: SpectrumKey | 'none';
  description: string;
}

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface CoverageVolume {
  week: number;
  month: number;
}

export interface DeepAnalysis {
  shared_facts: SharedFact[];
  diverging_points: DivergingPoint[];
  silenced_topics: SilencedTopic[];
  keywords?: Record<SpectrumKey, string[]>;
  sentiment?: Record<SpectrumKey, Sentiment>;
  experts_cited?: Record<SpectrumKey, string[]>;
  coverage_volume?: Record<SpectrumKey, CoverageVolume>;
}

export type NewsSpectrum = Record<SpectrumKey, NewsSource>;
export type CoverageDistribution = Record<SpectrumKey, CoverageEntry>;

export interface NewsAnalysisResult {
  analysis_topic: string;
  response_language: 'de' | 'en' | 'ru';
  overall_non_partisan_analysis: string;
  news_spectrum: NewsSpectrum;
  coverage_distribution?: CoverageDistribution;
  deep_analysis?: DeepAnalysis;
  _meta?: {
    degraded: boolean;
  };
}

export interface TopicCount {
  topic: string;
  count: number;
  last_searched: string;
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
