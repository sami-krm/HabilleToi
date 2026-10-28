import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import type { Weather } from '../types';

const LOCATION_KEY = '@app/weather-location';
export interface SavedLocation { name: string; latitude: number; longitude: number }

export class WeatherError extends Error {
  constructor(public code: 'PERMISSION_DENIED' | 'NETWORK' | 'CITY_NOT_FOUND', message: string) { super(message); }
}

export async function loadSavedLocation(): Promise<SavedLocation | null> {
  try { const raw = await AsyncStorage.getItem(LOCATION_KEY); return raw ? JSON.parse(raw) as SavedLocation : null; } catch { return null; }
}

export async function saveLocation(location: SavedLocation | null): Promise<void> {
  if (location) await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(location));
  else await AsyncStorage.removeItem(LOCATION_KEY);
}

export async function searchCities(query: string): Promise<SavedLocation[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`);
  if (!response.ok) throw new WeatherError('NETWORK', 'Recherche de ville indisponible.');
  const data = await response.json() as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
  return (data.results ?? []).map((p) => ({
    name: [p.name, p.admin1, p.country].filter(Boolean).join(', '), latitude: p.latitude, longitude: p.longitude,
  }));
}

export async function getWeatherAt(latitude: number, longitude: number, city?: string, dayOffset = 0): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code,is_day' +
    '&hourly=precipitation_probability,precipitation,apparent_temperature,temperature_2m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&forecast_days=7&timezone=auto';
  let data: any;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    data = await response.json();
  } catch { throw new WeatherError('NETWORK', 'Impossible de récupérer la météo (connexion ?).'); }
  const dayIndex = Math.min(Math.max(dayOffset, 0), data.daily.time.length - 1);
  const wantedDate = data.daily.time[dayIndex] as string;
  const hourlyIndices = (data.hourly.time as string[]).map((time, index) => ({ time, index })).filter(({ time }) => time.startsWith(wantedDate));
  const peak = hourlyIndices.reduce((best, entry) => {
    return Number(data.hourly.precipitation_probability[entry.index] ?? 0) > Number(data.hourly.precipitation_probability[best.index] ?? 0) ? entry : best;
  }, hourlyIndices[0] ?? { time: '', index: 0 });
  const wetHour = hourlyIndices.find(({ index }) => Number(data.hourly.precipitation[index] ?? 0) > 0.05)
    ?? hourlyIndices.find(({ index }) => Number(data.hourly.precipitation_probability[index] ?? 0) >= 50)
    ?? peak;
  const selectedTemp = dayIndex === 0 ? Number(data.current.temperature_2m) : Number(data.hourly.temperature_2m[hourlyIndices.find(({ time }) => Number(time.slice(11, 13)) >= 9)?.index ?? 0]);
  return {
    temperature: selectedTemp,
    precipitation: dayIndex === 0 ? Number(data.current.precipitation) : Number(data.daily.precipitation_sum[dayIndex] ?? 0),
    windSpeed: Number(data.current.wind_speed_10m), weatherCode: Number(data.daily.weather_code[dayIndex]),
    isDay: data.current.is_day === 1, city, date: wantedDate,
    minTemperature: Number(data.daily.temperature_2m_min[dayIndex]), maxTemperature: Number(data.daily.temperature_2m_max[dayIndex]),
    apparentTemperature: dayIndex === 0 ? Number(data.current.apparent_temperature) : Number(data.hourly.apparent_temperature[hourlyIndices.find(({ time }) => Number(time.slice(11, 13)) >= 9)?.index ?? 0]),
    rainTime: Number(data.daily.precipitation_sum[dayIndex] ?? 0) > 0.2 && (Number(data.hourly.precipitation[wetHour.index] ?? 0) > 0 || Number(data.hourly.precipitation_probability[wetHour.index] ?? 0) >= 50) ? wetHour.time.slice(11, 16) : undefined,
    latitude, longitude,
  };
}

/** Récupère la météo de la ville choisie, ou de la position courante. */
export async function getCurrentWeather(dayOffset = 0): Promise<Weather> {
  const saved = await loadSavedLocation();
  if (saved) return getWeatherAt(saved.latitude, saved.longitude, saved.name, dayOffset);
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new WeatherError('PERMISSION_DENIED', 'Choisis une ville ou autorise la localisation pour obtenir la météo.');
  let coords: Location.LocationObjectCoords;
  try { ({ coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })); }
  catch { throw new WeatherError('NETWORK', 'Position introuvable. Choisis une ville manuellement.'); }
  let city: string | undefined;
  try { const [place] = await Location.reverseGeocodeAsync(coords); city = place?.city ?? place?.subregion ?? place?.region ?? undefined; } catch {}
  return getWeatherAt(coords.latitude, coords.longitude, city, dayOffset);
}
