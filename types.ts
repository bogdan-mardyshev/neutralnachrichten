export interface Source {
  outlet_name: string;
  spectrum: string;
  headline: string;
  summary: string;
  tone: string;
  url: string;
}

export interface Analysis {
  left_narrative: string;
  right_narrative: string;
  bias_verdict: string;
  blindspot_alert: string;
}

export interface NewsAnalysisResult {
  topic_title: string;
  fact_check_summary: string;
  sources: Source[];
  analysis: Analysis;
}

export enum SpectrumType {
  LEFT = 'Left',
  CENTER_LEFT = 'Center-Left',
  CENTER = 'Center',
  CENTER_RIGHT = 'Center-Right',
  RIGHT = 'Right'
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';