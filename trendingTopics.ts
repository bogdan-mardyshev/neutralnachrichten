import { Language } from './translations';

export interface TrendingTopic {
  id: string;
  topic: Record<Language, string>;
  category: string;
  weekStarting: string;
}

export const TRENDING_TOPICS: TrendingTopic[] = [
  {
    id: '2026-w17-merz',
    topic: {
      de: 'Friedrich Merz Kanzlerschaft',
      en: 'Friedrich Merz Chancellorship',
      ru: 'Канцлерство Фридриха Мерца',
    },
    category: 'politics',
    weekStarting: '2026-04-21',
  },
  {
    id: '2026-w17-bundeswehr',
    topic: {
      de: 'Bundeswehr Aufrüstung',
      en: 'Bundeswehr Rearmament',
      ru: 'Перевооружение Бундесвера',
    },
    category: 'defense',
    weekStarting: '2026-04-21',
  },
  {
    id: '2026-w17-migration',
    topic: {
      de: 'Migrationspolitik Merz',
      en: 'Merz Migration Policy',
      ru: 'Миграционная политика Мерца',
    },
    category: 'politics',
    weekStarting: '2026-04-21',
  },
  {
    id: '2026-w17-wohnungsnot',
    topic: {
      de: 'Wohnungsnot Deutschland',
      en: 'Housing Crisis Germany',
      ru: 'Жилищный кризис в Германии',
    },
    category: 'society',
    weekStarting: '2026-04-21',
  },
  {
    id: '2026-w17-energie',
    topic: {
      de: 'Energiepreise 2026',
      en: 'Energy Prices 2026',
      ru: 'Цены на энергию 2026',
    },
    category: 'economy',
    weekStarting: '2026-04-21',
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  politics: '🏛️',
  defense: '🛡️',
  society: '🏘️',
  economy: '📈',
  environment: '🌿',
  culture: '🎭',
};

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📰';
}
