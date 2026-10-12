import type { DayWeather, Place, TripWeather } from '@/features/trip/tripTypes';
import { addDaysISO, parseISO, toISO, todayISO } from './tripDates';

export class TripWeatherError extends Error {}

const FORECAST_DAYS = 15; // Open-Meteo prévoit environ 16 jours
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max';

/** Cherche des villes par leur nom (API de géocodage d'Open-Meteo). */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.results ?? []).map((r: any): Place => ({
    name: r.name,
    country: r.country,
    region: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

function parseDaily(json: any): DayWeather[] {
  const d = json?.daily;
  if (!d?.time) return [];
  return (d.time as string[])
    .map((date, i): DayWeather => ({
      date,
      tMax: d.temperature_2m_max[i],
      tMin: d.temperature_2m_min[i],
      precipitation: d.precipitation_sum[i] ?? 0,
      windMax: d.wind_speed_10m_max[i] ?? 0,
    }))
    .filter((day) => day.tMax != null && day.tMin != null);
}

const oneYearEarlier = (s: string) => {
  const d = parseISO(s);
  d.setFullYear(d.getFullYear() - 1);
  return toISO(d);
};

/**
 * Météo jour par jour du séjour.
 * Dans les 15 prochains jours : vraie prévision. Au-delà : mêmes dates l'an dernier (estimation).
 */
export async function getTripWeather(place: Place, startDate: string, endDate: string): Promise<TripWeather> {
  const estimated = endDate > addDaysISO(todayISO(), FORECAST_DAYS);
  const coords = `latitude=${place.latitude}&longitude=${place.longitude}`;
  const url = estimated
    ? `https://archive-api.open-meteo.com/v1/archive?${coords}&start_date=${oneYearEarlier(startDate)}` +
      `&end_date=${oneYearEarlier(endDate)}&daily=${DAILY}&timezone=auto`
    : `https://api.open-meteo.com/v1/forecast?${coords}&start_date=${startDate}&end_date=${endDate}` +
      `&daily=${DAILY}&timezone=auto`;

  let days: DayWeather[];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    days = parseDaily(await res.json());
  } catch {
    throw new TripWeatherError('Impossible de récupérer la météo du séjour (connexion ?).');
  }
  if (days.length === 0) throw new TripWeatherError('Aucune donnée météo pour ces dates.');

  // Pour une estimation, on recale les dates de l'an dernier sur celles du séjour
  if (estimated) days = days.map((d, i) => ({ ...d, date: addDaysISO(startDate, i) }));
  return { days, estimated };
}