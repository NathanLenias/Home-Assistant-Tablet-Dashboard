// Ligne de qualité de l'air au-dessus de l'horloge : intérieur mesuré par le
// capteur CO2, extérieur repris de l'indice européen d'Open-Meteo. Les deux
// partagent la même échelle de quatre pastilles.

import { CONFIG } from '../config.js';
import { numeric } from './ha.js';

const LABELS = { good: 'bonne', fair: 'correcte', poor: 'moyenne', bad: 'mauvaise' };

// Seuils usuels du CO2 intérieur, en ppm.
function indoorLevel(ppm) {
  if (ppm <= 800) return 'good';
  if (ppm <= 1000) return 'fair';
  if (ppm <= 1500) return 'poor';
  return 'bad';
}

// Bandes de l'indice européen de qualité de l'air.
function outdoorLevel(aqi) {
  if (aqi <= 20) return 'good';
  if (aqi <= 40) return 'fair';
  if (aqi <= 60) return 'poor';
  return 'bad';
}

let outdoorAqi = null;

async function fetchOutdoor() {
  const { latitude, longitude } = CONFIG.location;
  const params = new URLSearchParams({ latitude, longitude, timezone: 'auto', current: 'european_aqi' });

  try {
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();
    outdoorAqi = data?.current?.european_aqi ?? null;
  } catch (error) {
    console.error('Qualité de l\'air extérieure indisponible', error);
    outdoorAqi = null;
  }
}

function entry(name, level) {
  return `<span class="air-item"><span class="air-dot ${level}"></span>${name} ${LABELS[level]}</span>`;
}

export function buildAir(ha, onOutdoor) {
  const container = document.getElementById('air-line');

  fetchOutdoor().then(onOutdoor);
  setInterval(() => fetchOutdoor().then(onOutdoor), 15 * 60 * 1000);

  return () => {
    const entity = CONFIG.airQuality?.entity;
    const ppm = entity ? numeric(ha.state(entity), 0) : null;

    const parts = [];
    if (ppm != null) parts.push(entry('Intérieur', indoorLevel(ppm)));
    if (outdoorAqi != null) parts.push(entry('Extérieur', outdoorLevel(outdoorAqi)));

    container.innerHTML = parts.join('');
  };
}
