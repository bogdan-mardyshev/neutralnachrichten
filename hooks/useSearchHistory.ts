import { useState, useCallback } from 'react';
import { Language } from '../translations';

const STORAGE_KEY = 'nn_search_history';
const MAX_ENTRIES = 8;

export interface HistoryEntry {
  topic: string;
  lang: Language;
  ts: number;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or blocked
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const addToHistory = useCallback((topic: string, lang: Language) => {
    setHistory(prev => {
      // Remove existing entry for same topic (case-insensitive)
      const filtered = prev.filter(e => e.topic.toLowerCase() !== topic.toLowerCase());
      // Prepend new entry, cap at MAX_ENTRIES
      const updated = [{ topic, lang, ts: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addToHistory, clearHistory };
}
