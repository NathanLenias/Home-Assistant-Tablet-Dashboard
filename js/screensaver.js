// Tout ce qui ne dépend pas de Home Assistant : horloge, fonds d'écran,
// et météo Open-Meteo.

import { CONFIG } from '../config.js';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const CONDITIONS = {
  0: 'Ciel dégagé', 1: 'Principalement dégagé', 2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard', 48: 'Brouillard givrant',
  51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine dense',
  61: 'Pluie légère', 63: 'Pluie modérée', 65: 'Pluie forte',
  71: 'Neige légère', 73: 'Neige modérée', 75: 'Neige forte', 77: 'Grains de neige',
  80: 'Averses légères', 81: 'Averses modérées', 82: 'Averses violentes',
  85: 'Averses de neige', 86: 'Fortes averses de neige',
  95: 'Orage', 96: 'Orage et grêle', 99: 'Orage et forte grêle',
};

const ICONS = {
  0: ['sunny', 'clear-night'], 1: ['sunny', 'clear-night'],
  2: ['partlycloudy', 'partlycloudy-night'], 3: ['cloudy', 'cloudy'],
  45: ['fog-day', 'fog-night'], 48: ['fog-day', 'fog-night'],
  51: ['drizzle', 'drizzle'], 53: ['drizzle', 'drizzle'], 55: ['drizzle', 'drizzle'],
  61: ['rainy', 'rainy-night'], 63: ['rainy', 'rainy-night'], 65: ['rainy', 'rainy-night'],
  71: ['snow', 'snow'], 73: ['snow', 'snow'], 75: ['snow', 'snow'], 77: ['snow', 'snow'],
  80: ['partly-cloudy-day-rain', 'partly-cloudy-night-rain'],
  81: ['partly-cloudy-day-rain', 'partly-cloudy-night-rain'],
  82: ['rainy', 'rainy-night'],
  85: ['partly-cloudy-day-snow', 'partly-cloudy-night-snow'], 86: ['snow', 'snow'],
  95: ['thunderstorms-day', 'thunderstorms-night'],
  96: ['thunderstorms-day', 'thunderstorms-night'],
  99: ['thunderstorms-day', 'thunderstorms-night'],
};

function weatherIcon(code, night = false) {
  const pair = ICONS[code] || ['cloudy', 'cloudy'];
  return `weather/${pair[night ? 1 : 0]}.svg`;
}

function isNight(date = new Date()) {
  const h = date.getHours();
  return h >= 21 || h < 7;
}

/* ---------- Horloge ---------- */

export function startClock() {
  const clock = document.getElementById('clock');
  const date = document.getElementById('date');

  const tick = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    clock.textContent = `${h}:${m}`;
    date.textContent = `${JOURS[now.getDay()]} ${now.getDate()} ${MOIS[now.getMonth()]}`;
  };

  tick();
  setInterval(tick, 1000);
}

/* ---------- Fonds d'écran ---------- */

export function startBackground() {
  const { images, intervalMs } = CONFIG.background;
  if (!images.length) return;

  const layers = [document.getElementById('bg-1'), document.getElementById('bg-2')];
  let index = Math.floor(Math.random() * images.length);
  let active = 0;

  const paint = (layer, first) => {
    layer.style.backgroundImage = `url('${images[index]}')`;
    layer.style.animation = 'none';
    void layer.offsetHeight;
    const effect = Math.floor(Math.random() * 4) + 1;
    layer.style.animation = `kb${effect} ${Math.round(intervalMs / 1000)}s linear`;
    layer.classList.add('on');
    if (!first) layers[active].classList.remove('on');
  };

  paint(layers[0], true);

  setInterval(() => {
    let next = index;
    while (next === index && images.length > 1) {
      next = Math.floor(Math.random() * images.length);
    }
    index = next;
    const target = active === 0 ? 1 : 0;
    paint(layers[target], false);
    active = target;
  }, intervalMs);
}

/* ---------- Météo ---------- */

async function fetchWeather() {
  const { latitude, longitude } = CONFIG.location;
  const base = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude, longitude, timezone: 'auto', forecast_days: '2',
    current: 'temperature_2m,apparent_temperature,weather_code',
    hourly: 'temperature_2m,weather_code',
  });

  const response = await fetch(`${base}?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
  return response.json();
}

function renderCurrent(data) {
  const code = data.current.weather_code;
  const night = isNight();
  const temp = Math.round(data.current.temperature_2m);
  const felt = Math.round(data.current.apparent_temperature);
  const condition = CONDITIONS[code] || 'Inconnu';

  document.getElementById('now-icon').innerHTML =
    `<img src="${weatherIcon(code, night)}" alt="">`;
  document.getElementById('now-temp').textContent = `${temp}°`;
  document.getElementById('now-desc').textContent =
    felt === temp ? condition : `${condition} · ressenti ${felt}°`;

  return { code, temp, condition, night };
}

function renderHourly(data) {
  const now = Date.now();
  const times = data.hourly.time;
  let start = times.findIndex((t) => new Date(t).getTime() > now);
  if (start < 0) start = 0;

  const slots = [1, 4, 7, 10]
    .map((offset) => start + offset - 1)
    .filter((i) => i < times.length);

  document.getElementById('hourly').innerHTML = slots.map((i) => {
    const at = new Date(times[i]);
    const code = data.hourly.weather_code[i];
    const temp = Math.round(data.hourly.temperature_2m[i]);
    return `<div class="hour">
      <div class="hour-time">${String(at.getHours()).padStart(2, '0')}h</div>
      <img src="${weatherIcon(code, isNight(at))}" alt="">
      <div class="hour-temp">${temp}°</div>
    </div>`;
  }).join('');
}

async function refreshWeather() {
  try {
    const data = await fetchWeather();
    renderCurrent(data);
    renderHourly(data);
  } catch (error) {
    console.error('Météo indisponible', error);
    document.getElementById('now-desc').textContent = 'Météo indisponible';
  }
}

export function startWeather() {
  refreshWeather();
  setInterval(refreshWeather, 15 * 60 * 1000);
}
