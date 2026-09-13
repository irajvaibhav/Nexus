export type DailyForecast = {
  date: string;
  code: number;
  description: string;
  precipProbability: number;
  tempMax: number;
  tempMin: number;
};

export type Place = { lat: number; lon: number; label: string };

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Foggy",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
  85: "Snow showers", 86: "Snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

export function describeWeatherCode(code: number): string {
  return WMO_DESCRIPTIONS[code] || "Unknown";
}

export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export class WeatherError extends Error {
  constructor(message: string, public readonly kind: "network" | "not_found" | "bad_response") {
    super(message);
    this.name = "WeatherError";
  }
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new WeatherError("Couldn't reach the weather service. Check your connection.", "network");
  }
  if (!res.ok) {
    throw new WeatherError(`The weather service answered with ${res.status}.`, "bad_response");
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new WeatherError("The weather service sent an unreadable reply.", "bad_response");
  }
}

export async function geocodeCity(city: string): Promise<Place | null> {
  const trimmed = city.trim();
  if (!trimmed) return null;

  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`
  );
  const results = data.results as
    | { latitude: number; longitude: number; name: string; admin1?: string; country?: string }[]
    | undefined;
  const match = results?.[0];
  if (!match) return null;
  return {
    lat: match.latitude,
    lon: match.longitude,
    label: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
  };
}

// Turns a device position into a city name that the rest of the app can store
// and geocode again later. BigDataCloud's client endpoint is free and keyless.
export async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; label: string } | null> {
  const data = await fetchJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  );
  const city = String(data.city || data.locality || "").trim();
  if (!city) return null;
  const region = String(data.principalSubdivision || "").trim();
  const country = String(data.countryName || "").trim();
  return { city, label: [city, region, country].filter(Boolean).join(", ") };
}

export async function getDailyForecast(lat: number, lon: number): Promise<DailyForecast[]> {
  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=7`
  );
  const days = data.daily as
    | {
        time?: string[];
        weather_code?: (number | null)[];
        precipitation_probability_max?: (number | null)[];
        temperature_2m_max?: (number | null)[];
        temperature_2m_min?: (number | null)[];
      }
    | undefined;

  if (!days?.time?.length) {
    throw new WeatherError("No forecast came back for this location.", "bad_response");
  }

  return days.time.map((date, i) => {
    const code = days.weather_code?.[i] ?? 3;
    return {
      date,
      code,
      description: describeWeatherCode(code),
      precipProbability: days.precipitation_probability_max?.[i] ?? 0,
      tempMax: Math.round(days.temperature_2m_max?.[i] ?? 0),
      tempMin: Math.round(days.temperature_2m_min?.[i] ?? 0),
    };
  });
}

export function bestUpcomingDay(forecast: DailyForecast[]): DailyForecast | null {
  if (forecast.length === 0) return null;
  return [...forecast].sort((a, b) => a.precipProbability - b.precipProbability)[0];
}
