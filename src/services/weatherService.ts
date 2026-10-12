import * as Location from 'expo-location';
import type { Weather } from '../types';

export class WeatherError extends Error {
  constructor(public code: 'PERMISSION_DENIED' | 'NETWORK', message: string) {
    super(message);
  }
}

/** Demande la permission, récupère la position puis appelle Open-Meteo. */
export async function getCurrentWeather(): Promise<Weather> {
  // 1. Permission de localisation (uniquement pendant l'utilisation de l'app)
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new WeatherError('PERMISSION_DENIED', 'Autorise la localisation pour obtenir la météo.');
  }

  // 2. Coordonnées (précision « Balanced » : suffisante pour la météo, plus rapide)
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  // 3. Appel API
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}` +
    `&longitude=${coords.longitude}` +
    `&current=temperature_2m,precipitation,wind_speed_10m`;
  
  // Nom du lieu (affiché pour vérifier la position utilisée)
  let city: string | undefined;
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    city = place?.city ?? place?.subregion ?? place?.region ?? undefined;
  } catch {
    // sans importance : la météo s'affiche quand même
  }

  let json: any;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch {
    throw new WeatherError('NETWORK', 'Impossible de récupérer la météo (connexion ?).');
  }

  return {
    temperature: json.current.temperature_2m,
    precipitation: json.current.precipitation,
    windSpeed: json.current.wind_speed_10m, // km/h par défaut
    city,
  };
}