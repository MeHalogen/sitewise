import type { Adapter } from '../adapter.js';
import { getJSON } from '../http.js';

const WMO_CODES: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm w/ hail',
  99: 'Thunderstorm w/ hail',
};

const describe = (code: number) => WMO_CODES[code] ?? `code ${code}`;

interface GeoResult {
  results?: { name: string; country: string; latitude: number; longitude: number }[];
}

interface Forecast {
  current: { temperature_2m: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number };
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
}

export const weather: Adapter = {
  name: 'weather',
  description: 'Weather now and 7-day forecast for any city (Open-Meteo, no key needed)',
  commands: [
    {
      name: 'now',
      description: 'Current conditions and 7-day forecast',
      args: [{ name: '<city>', description: 'city name, e.g. "San Francisco"' }],
      async run(ctx) {
        const geo = await getJSON<GeoResult>(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ctx.args[0])}&count=1`,
        );
        const place = geo.results?.[0];
        if (!place) return { data: null, text: `No location found for "${ctx.args[0]}".` };

        const qs = new URLSearchParams({
          latitude: String(place.latitude),
          longitude: String(place.longitude),
          current: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
          daily: 'temperature_2m_max,temperature_2m_min,weather_code',
          timezone: 'auto',
        });
        const fc = await getJSON<Forecast>(`https://api.open-meteo.com/v1/forecast?${qs}`);

        const days = fc.daily.time.map((date, i) => ({
          date,
          high: fc.daily.temperature_2m_max[i],
          low: fc.daily.temperature_2m_min[i],
          conditions: describe(fc.daily.weather_code[i]),
        }));
        const data = {
          location: `${place.name}, ${place.country}`,
          current: {
            temperature: fc.current.temperature_2m,
            conditions: describe(fc.current.weather_code),
            windKmh: fc.current.wind_speed_10m,
            humidity: fc.current.relative_humidity_2m,
          },
          forecast: days,
        };
        const header =
          `${data.location} — ${data.current.temperature}°C, ${data.current.conditions}, ` +
          `wind ${data.current.windKmh} km/h, humidity ${data.current.humidity}%\n`;
        return {
          data,
          text:
            header +
            '\n' +
            days.map((d) => `${d.date}  ${String(d.low).padStart(5)}° – ${String(d.high).padEnd(5)}°  ${d.conditions}`).join('\n'),
        };
      },
    },
  ],
};
