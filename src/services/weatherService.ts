import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import type { Place } from '@/features/trip/tripTypes';
import { searchPlaces } from '@/services/tripWeather';
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
  let places: Place[];
  try { places = await searchPlaces(query); } catch { throw new WeatherError('NETWORK', 'Recherche de ville indisponible.'); }
  return places.map((p) => ({
    name: [p.name, p.region, p.country].filter(Boolean).join(', '), latitude: p.latitude, longitude: p.longitude,
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
  const today = dayIndex === 0;
  const wantedDate = data.daily.time[dayIndex] as string;
  const hourly = data.hourly;
  const rainChance = (i: number) => Number(hourly.precipitation_probability[i] ?? 0);
  const rainAmount = (i: number) => Number(hourly.precipitation[i] ?? 0);

  const hours = (hourly.time as string[]).map((time, index) => ({ time, index })).filter(({ time }) => time.startsWith(wantedDate));
  const peak = hours.reduce((best, h) => (rainChance(h.index) > rainChance(best.index) ? h : best), hours[0] ?? { time: '', index: 0 });
  const wetHour = hours.find(({ index }) => rainAmount(index) > 0.05) ?? hours.find(({ index }) => rainChance(index) >= 50) ?? peak;
  // Pour un autre jour qu'aujourd'hui, on prend la météo du matin (9 h)
  const morning = hours.find(({ time }) => Number(time.slice(11, 13)) >= 9)?.index ?? 0;
  const daySum = Number(data.daily.precipitation_sum[dayIndex] ?? 0);
  const rainy = daySum > 0.2 && (rainAmount(wetHour.index) > 0 || rainChance(wetHour.index) >= 50);

  return {
    temperature: today ? Number(data.current.temperature_2m) : Number(hourly.temperature_2m[morning]),
    precipitation: today ? Number(data.current.precipitation) : daySum,
    windSpeed: Number(data.current.wind_speed_10m),
    weatherCode: Number(data.daily.weather_code[dayIndex]),
    isDay: data.current.is_day === 1,
    city,
    date: wantedDate,
    minTemperature: Number(data.daily.temperature_2m_min[dayIndex]),
    maxTemperature: Number(data.daily.temperature_2m_max[dayIndex]),
    apparentTemperature: today ? Number(data.current.apparent_temperature) : Number(hourly.apparent_temperature[morning]),
    rainTime: rainy ? wetHour.time.slice(11, 16) : undefined,
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
