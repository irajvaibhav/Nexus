export type DailyForecast = {
  date: string;
  code: number;
  description: string;
  precipProbability: number;
  tempMax: number;
  tempMin: number;
};

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

export async function geocodeCity(city: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  const data = await res.json();
  const match = data.results?.[0];
  if (!match) return null;
  return {
    lat: match.latitude,
    lon: match.longitude,
    label: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
  };
}

export async function getDailyForecast(lat: number, lon: number): Promise<DailyForecast[]> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=7`
  );
  const data = await res.json();
  const days = data.daily;
  if (!days) return [];

  return days.time.map((date: string, i: number) => ({
    date,
    code: days.weather_code[i],
    description: describeWeatherCode(days.weather_code[i]),
    precipProbability: days.precipitation_probability_max[i],
    tempMax: Math.round(days.temperature_2m_max[i]),
    tempMin: Math.round(days.temperature_2m_min[i]),
  }));
}

export function bestUpcomingDay(forecast: DailyForecast[]): DailyForecast | null {
  if (forecast.length === 0) return null;
  return [...forecast].sort((a, b) => a.precipProbability - b.precipProbability)[0];
}
