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
  _tier?: 'flagship' | 'standard' | 'niche';      // source provenance (from source_ratings)
  _factual?: 'high' | 'mixed' | 'low';
  _grounded?: boolean;                              // matched to a corpus article
}

export interface Citation {
  url: string;
  source_name: string;
  title: string;
  corpus_id?: number | null;
}

export interface FactVerification {
  label: 'supported' | 'entailment' | 'contradiction' | 'unsupported';
  score: number;
  evidence: Citation | null;
}

export interface SharedFact {
  claim: string;
  _verification?: FactVerification;   // Wave 1: NLI check + citation
}

export interface DivergingPoint {
  topic: string;
  left_view: string;
  center_left_view: string;
  center_view: string;
  center_right_view: string;
  right_view: string;
  _citations?: Partial<Record<SpectrumKey, Citation>>;  // Wave 1: per-camp source
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
  _experts_unverified?: Record<SpectrumKey, string[]>;  // Wave 1: names not found in article text
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
  pubDate?:      string | null;   // corpus path uses pubDate (ISO)
  description:   string;
  // Source classification attached from source_ratings (Wave 2 visuals)
  _tier?:        'flagship' | 'standard' | 'niche';
  _factual?:     'high' | 'mixed' | 'low';
  _reachWeight?: number;
  _owner?:       string | null;   // owning media group (B4)
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
  _reliability?: ReliabilityEnvelope;
}

export interface ReliabilityEnvelope {
  confidence: {
    score:          number;            // 0..100
    band:           'high' | 'medium' | 'low';
    penaltyApplied: boolean;           // a source-contradicted claim was found
    factors: {
      spectrumBreadth: number;
      grounding:       number;
      claimSupport:    number;
      volume:          number;
    };
  };
  coverage?:   Record<SpectrumKey, { percent: number; weight: number; sources: number }>;
  grounding?:  { total: number; grounded: number; ungrounded: number; groundingRatio: number } | null;
  claims?:     { total: number; supported: number; contradicted: number; unsupported: number; supportRatio: number; hasContradiction: boolean } | null;
  blindspots?: { verifiedSilences: SpectrumKey[]; flagshipSilences: SpectrumKey[]; leadSilences?: SpectrumKey[]; leadOnlySilences?: SpectrumKey[]; unverifiable: SpectrumKey[] } | null;
  sourceCount?: number;
  clusters?: StoryCluster[];
  clusterMeta?: { total: number; clusterCount: number; multiArticleClusters: number; soloCamps: Array<{ label: string; camp: SpectrumKey; size: number }> };
  coverageWindow?: { days: number; outlets: number };
}

export interface StoryCluster {
  id: number;
  label: string;       // human-readable: the lead article's real headline
  keywords?: string;   // secondary token tags ("russland · ukraine · …")
  size: number;
  spectra: Record<SpectrumKey, number>;
  coveredCamps: SpectrumKey[];
  soloCamp: SpectrumKey | null;
  articles: Array<{ title: string; source_name: string; url: string; spectrum: SpectrumKey | null }>;
}

export interface TopicCount {
  topic: string;
  count: number;
  last_searched: string;
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
