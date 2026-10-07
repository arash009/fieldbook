// Daily forecast from Open-Meteo (no key needed), mapped to what the day header shows.
const CODES = [[0, '☀', 'Clear'], [1, '🌤', 'Mostly clear'], [2, '⛅', 'Partly cloudy'], [3, '☁', 'Cloudy'], [45, '🌫', 'Fog'], [51, '🌦', 'Drizzle'], [61, '🌧', 'Rain'], [71, '🌨', 'Snow'], [80, '🌦', 'Showers'], [95, '⛈', 'Thunderstorm']];

export function describeWeather(code) {
  let pick = CODES[0];
  for (const c of CODES) if (code >= c[0]) pick = c;
  return { icon: pick[1], text: pick[2] };
}

export function forecastUrl(city, timezone, start, end) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({ latitude: city.lat, longitude: city.lng, timezone, start_date: start, end_date: end,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset' }).toString();
  return u.toString();
}

export function parseForecast(json) {
  const d = json?.daily;
  const out = {};
  (d?.time ?? []).forEach((date, i) => {
    const code = d.weather_code?.[i];
    if (code == null || d.temperature_2m_max?.[i] == null) return;
    out[date] = { ...describeWeather(code), max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_probability_max?.[i] ?? null, sunset: d.sunset?.[i]?.slice(11, 16) ?? null };
  });
  return out;
}
