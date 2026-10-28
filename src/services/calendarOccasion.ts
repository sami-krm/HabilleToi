import * as Calendar from 'expo-calendar/legacy';
import type { Style } from '@/types';

export interface CalendarOccasion {
  style: Style;
}

const KEYWORDS: { style: Style; words: string[] }[] = [
  { style: 'formel', words: ['entretien', 'réunion', 'reunion', 'conférence', 'conference', 'présentation', 'presentation', 'bureau', 'mariage', 'gala', 'cérémonie', 'ceremonie'] },
  { style: 'soiree', words: ['cocktail', 'soirée', 'soiree', 'anniversaire', 'concert'] },
  { style: 'sport', words: ['sport', 'entraînement', 'entrainement', 'match', 'course', 'fitness'] },
];

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
  const titles = events.map((event) => event.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase());

  for (const candidate of KEYWORDS) {
    if (titles.some((title) => candidate.words.some((word) => title.includes(word.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))))) {
      return { style: candidate.style };
    }
  }
  return null;
}
