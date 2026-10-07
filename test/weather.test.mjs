import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeWeather, forecastUrl, parseForecast } from '../app/js/weather.js';

test('describeWeather maps WMO codes', () => {
  assert.deepEqual(describeWeather(0), { icon: '☀', text: 'Clear' });
  assert.equal(describeWeather(63).text, 'Rain');
  assert.equal(describeWeather(96).icon, '⛈');
});

test('forecastUrl asks Open-Meteo for the daily values in the trip zone', () => {
  const u = new URL(forecastUrl({ lat: 38.72, lng: -9.14 }, 'Europe/Lisbon', '2030-06-01', '2030-06-02'));
  assert.equal(u.origin, 'https://api.open-meteo.com');
  assert.equal(u.searchParams.get('timezone'), 'Europe/Lisbon');
  assert.equal(u.searchParams.get('start_date'), '2030-06-01');
  assert.match(u.searchParams.get('daily'), /weather_code/);
});

test('parseForecast keys each day by date and skips missing values', () => {
  const json = { daily: { time: ['2030-06-01', '2030-06-02'], weather_code: [2, null], temperature_2m_max: [24.4, null], temperature_2m_min: [15.6, null], precipitation_probability_max: [10, null], sunset: ['2030-06-01T21:05', null] } };
  assert.deepEqual(parseForecast(json), { '2030-06-01': { icon: '⛅', text: 'Partly cloudy', max: 24, min: 16, rain: 10, sunset: '21:05' } });
  assert.deepEqual(parseForecast({}), {});
});
