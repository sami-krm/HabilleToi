import * as Calendar from 'expo-calendar/legacy';
import type { Style } from '@/types';

export interface CalendarOccasion {
  style: Style;
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

const RAW_KEYWORDS: { style: Style; words: string[] }[] = [
  { style: 'formel', words: ['entretien', 'réunion', 'reunion', 'conférence', 'conference', 'présentation', 'presentation', 'bureau', 'mariage', 'gala', 'cérémonie', 'ceremonie'] },
  { style: 'soiree', words: ['cocktail', 'soirée', 'soiree', 'anniversaire', 'concert'] },
  { style: 'sport', words: ['sport', 'entraînement', 'entrainement', 'match', 'course', 'fitness'] },
];
// Mots-clés sans accents ni majuscules, préparés une seule fois
const KEYWORDS = RAW_KEYWORDS.map(({ style, words }) => ({ style, words: [...new Set(words.map(fold))] }));

export async function enableCalendarAccess() {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  return permission.status === 'granted';
}

export async function findCalendarOccasion(date: Date): Promise<CalendarOccasion | null> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (calendars.length === 0) return null;
  const events = await Calendar.getEventsAsync(calendars.map((calendar) => calendar.id), start, end);
  const titles = events.map((event) => fold(event.title));

  for (const candidate of KEYWORDS) {
    if (titles.some((title) => candidate.words.some((word) => title.includes(word)))) {
      return { style: candidate.style };
    }
  }
  return null;
}
