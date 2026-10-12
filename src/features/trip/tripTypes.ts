import type { Style } from '@/types';

export interface Place {
  name: string;
  country?: string;
  region?: string;
  latitude: number;
  longitude: number;
}

/** Météo d'une journée du séjour. */
export interface DayWeather {
  date: string;        // « 2026-10-12 »
  tMax: number;        // °C
  tMin: number;        // °C
  precipitation: number; // mm sur la journée
  windMax: number;     // km/h
}

export interface TripWeather {
  days: DayWeather[];
  /** Vrai si le séjour est trop loin pour une prévision : on utilise les mêmes dates l'an dernier. */
  estimated: boolean;
}

export interface DayOutfit {
  date: string;
  itemIds: string[];
}

export interface SavedTrip {
  id: string;
  place: Place;
  startDate: string;
  endDate: string;
  occasions: Style[];
  weather: TripWeather;
  itemIds: string[];       // la sélection de la valise
  dayOutfits: DayOutfit[]; // une tenue suggérée par jour
  notes: string[];
  packed: string[];        // ids déjà rangés dans la valise
  createdAt: number;
}