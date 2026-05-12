export type CoverageEstimate = 'high' | 'medium' | 'low' | 'none';

export interface CoverageEntry {
  estimate: CoverageEstimate;
  percent:  number;
  count?:   number;   // actual article count from this spectrum
  silence?: boolean;  // potential deliberate non-coverage
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

export type NewsSpectrum = Record<SpectrumKey, NewsSource[]>;
export type CoverageDistribution = Record<SpectrumKey, CoverageEntry>;

export interface RssArticle {
  source_name:   string;
  source_domain: string;
  article_title: string;
  article_url:   string | null;
  pub_date:      string | null;
  description:   string;
}

export interface NewsAnalysisResult {
  analysis_topic: string;
  response_language: 'de' | 'en' | 'ru';
  overall_non_partisan_analysis: string;
  news_spectrum: NewsSpectrum;
  coverage_distribution?: CoverageDistribution;
  deep_analysis?: DeepAnalysis;
  analyzed_at?: string;   // ISO timestamp of when the analysis was first computed
  _meta?: {
    degraded:      boolean;
    rss_articles?: number; // total articles found via RSS across all spectra
  };
  _usage?: {
    remaining: number;
    limit:     number;
  };
  _rss?: {
    total_articles:  number;
    coverage_volume: Record<SpectrumKey, CoverageVolume>;
    fetched_at:      string;
    spectra?:        Record<SpectrumKey, RssArticle[]>;
  };
}

export interface TopicCount {
  topic: string;
  count: number;
  last_searched: string;
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
