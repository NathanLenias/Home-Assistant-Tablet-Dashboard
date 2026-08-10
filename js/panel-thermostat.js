// Panneau thermostat : consigne au cadran, marche/arrêt, et boost 15 ou 30
// minutes qui s'appuie sur les scripts Home Assistant déjà en place.

import { CONFIG } from '../config.js';
import { icon } from './icons.js';
import { openPanel } from './panels.js';

const STEP = 0.5;
const RADIUS = 104;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Boost optionnel : renseignez CONFIG.thermostat.boost pour l'activer.
// Sans configuration, les boutons n'apparaissent pas.
const BOOST = CONFIG.thermostat?.boost || {};
const TIMER = CONFIG.thermostat?.boostTimer || '';

function template() {
  return `
    <div class="dial-row">
      <button class="dial-btn minus" type="button" aria-label="Baisser">&minus;</button>
      <div class="dial">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle class="track" cx="120" cy="120" r="${RADIUS}" fill="none" stroke-width="16"/>
          <circle class="progress" cx="120" cy="120" r="${RADIUS}" fill="none" stroke-width="16"
                  stroke-linecap="round" stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE}"/>
        </svg>
        <div class="dial-center">
          <div class="dial-tag">Consigne</div>
          <div class="dial-value" data-target>--°</div>
          <div class="dial-current" data-current>actuel --°</div>
        </div>
      </div>
      <button class="dial-btn plus" type="button" aria-label="Monter">+</button>
    </div>

    <div class="segmented">
      <button type="button" data-mode="heat">${icon('flame')} Actif</button>
      <button type="button" data-mode="off">${icon('power')} Inactif</button>
    </div>

    <div class="panel-label">Boost chauffage</div>
    <div class="boost-live" data-live hidden>
      <span>Boost en cours</span>
      <strong data-remaining>--:--</strong>
    </div>
    <div class="boost-row"${BOOST[15] ? '' : ' hidden'}>
      <button class="boost-btn" type="button" data-boost="15">${icon('bolt')} Boost 15 min</button>
      <button class="boost-btn" type="button" data-boost="30">${icon('bolt')} Boost 30 min</button>
      <button class="boost-btn stop" type="button" data-boost="stop" hidden>Arrêter le boost</button>
    </div>`;
}

function bounds(state) {
  return {
    min: state?.attributes?.min_temp ?? 15,
    max: state?.attributes?.max_temp ?? 23,
  };
}

function describe(state) {
  if (!state) return 'Indisponible';
  if (state.state === 'off') return 'Chauffage éteint';
  return state.attributes?.hvac_action === 'heating'
    ? 'Maison · chauffe en cours'
    : 'Maison · en veille';
}

function countdown(timer) {
  const end = timer?.attributes?.finishes_at;
  if (!end) return null;
  const left = Math.max(0, Math.round((new Date(end) - Date.now()) / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
}

export function openThermostat(ha, entity) {
  let tick = null;

  const setTarget = (delta) => {
    const state = ha.state(entity);
    const { min, max } = bounds(state);
    const now = state?.attributes?.temperature;
    if (now == null) return;
    const next = Math.min(max, Math.max(min, Math.round((now + delta) * 2) / 2));
    if (next === now) return;
    ha.callService('climate', 'set_temperature', entity, { temperature: next });
  };

  openPanel({
    title: 'Thermostat',
    subtitle: describe(ha.state(entity)),
    icon: 'thermometer',
    tone: 'warm',
    html: template(),

    mount(panel) {
      panel.querySelector('.minus').addEventListener('click', () => setTarget(-STEP));
      panel.querySelector('.plus').addEventListener('click', () => setTarget(STEP));

      panel.querySelectorAll('[data-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          ha.callService('climate', 'set_hvac_mode', entity, { hvac_mode: button.dataset.mode });
        });
      });

      panel.querySelectorAll('[data-boost]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.disabled) return;
          ha.callService('script', 'turn_on', BOOST[button.dataset.boost]);
        });
      });

      // Le décompte du boost avance seul, sans attendre un événement.
      tick = setInterval(() => {
        const remaining = countdown(ha.state(TIMER));
        const cell = panel.querySelector('[data-remaining]');
        if (remaining && cell) cell.textContent = remaining;
      }, 1000);
    },

    update(panel) {
      const state = ha.state(entity);
      const { min, max } = bounds(state);
      const target = state?.attributes?.temperature;
      const current = state?.attributes?.current_temperature;

      panel.querySelector('[data-sub]').textContent = describe(state);
      panel.querySelector('[data-target]').textContent = target == null ? '--°' : `${target}°`;
      panel.querySelector('[data-current]').textContent =
        current == null ? 'actuel --°' : `actuel ${Math.round(current * 10) / 10}°`;

      const ratio = target == null ? 0 : Math.min(1, Math.max(0, (target - min) / (max - min)));
      panel.querySelector('.progress').setAttribute(
        'stroke-dashoffset', String(CIRCUMFERENCE * (1 - ratio)),
      );

      panel.querySelectorAll('[data-mode]').forEach((button) => {
        button.classList.toggle('on', state?.state === button.dataset.mode);
      });

      // Un boost déjà lancé bloque les deux boutons : en relancer un écraserait
      // la photo de l'état d'origine et laisserait la consigne en haut.
      const running = ha.state(TIMER)?.state === 'active';
      const live = panel.querySelector('[data-live]');
      live.hidden = !running;
      if (running) {
        const remaining = countdown(ha.state(TIMER));
        if (remaining) panel.querySelector('[data-remaining]').textContent = remaining;
      }
      panel.querySelectorAll('[data-boost="15"], [data-boost="30"]').forEach((button) => {
        button.disabled = running;
      });
      panel.querySelector('[data-boost="stop"]').hidden = !running;
    },

    cleanup() {
      clearInterval(tick);
    },
  });
}
