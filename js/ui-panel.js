// Partie du rail alimentée par Home Assistant : températures, raccourcis
// tactiles et lecteur média.

import { CONFIG } from '../config.js';
import { numeric } from './ha.js';
import { icon } from './icons.js';
import { openThermostat } from './panel-thermostat.js';
import { openMusic } from './panel-music.js';
import { openHistory } from './panel-history.js';
import { marqueeAll } from './marquee.js';

/* ---------- Températures ---------- */

export function buildTemperatures(ha) {
  const container = document.getElementById('temps');

  container.innerHTML = CONFIG.temperatures.map((item, index) => `
    <button class="temp" type="button" data-index="${index}" data-entity="${item.entity}">
      ${icon(item.icon)}
      <div class="temp-label">${item.label}</div>
      <div class="temp-value">--°</div>
    </button>`).join('');

  container.querySelectorAll('.temp').forEach((card) => {
    const item = CONFIG.temperatures[Number(card.dataset.index)];
    card.addEventListener('click', () => openHistory(ha, item.entity, item.label));
  });

  return () => {
    CONFIG.temperatures.forEach((item) => {
      const cell = container.querySelector(`[data-entity="${item.entity}"] .temp-value`);
      if (!cell) return;
      const value = numeric(ha.state(item.entity), 1);
      cell.textContent = value == null ? '--°' : `${value}°`;
    });
  };
}

/* ---------- Raccourcis ---------- */

function describe(control, state) {
  if (!state || state.state === 'unavailable' || state.state === 'unknown') {
    return { text: 'Indisponible', active: false, dead: true };
  }

  if (control.type === 'light') {
    const on = state.state === 'on';
    return { text: on ? 'Allumé' : 'Éteint', active: on, dead: false };
  }

  if (control.type === 'climate') {
    const target = state.attributes?.temperature;
    const action = state.attributes?.hvac_action;
    if (state.state === 'off') return { text: 'Éteint', active: false, dead: false };
    const mode = action === 'heating' ? 'Chauffe' : 'En veille';
    return {
      text: target == null ? mode : `${Math.round(target * 10) / 10}° · ${mode}`,
      active: action === 'heating',
      dead: false,
    };
  }

  return { text: 'Scène', active: false, dead: false };
}

function trigger(ha, control, button) {
  if (button.classList.contains('dead')) return;

  if (control.type === 'light') {
    ha.callService('light', 'toggle', control.entity);
  } else if (control.type === 'climate') {
    // Le thermostat n'agit jamais directement : il ouvre toujours son panneau.
    openThermostat(ha, control.entity);
  } else {
    ha.callService('script', 'turn_on', control.entity);
    button.classList.add('busy');
    setTimeout(() => button.classList.remove('busy'), 1200);
  }
}

export function buildControls(ha) {
  const container = document.getElementById('controls');

  container.innerHTML = CONFIG.controls.map((control, index) => `
    <button class="ctl${control.type === 'climate' ? ' warm' : ''}" data-index="${index}" type="button">
      ${icon(control.icon)}
      <span class="ctl-text">
        <span class="ctl-name">${control.label}</span>
        <span class="ctl-state">--</span>
      </span>
    </button>`).join('');

  container.querySelectorAll('.ctl').forEach((button) => {
    const control = CONFIG.controls[Number(button.dataset.index)];
    button.addEventListener('click', () => trigger(ha, control, button));
  });

  return () => {
    container.querySelectorAll('.ctl').forEach((button) => {
      const control = CONFIG.controls[Number(button.dataset.index)];
      const info = describe(control, ha.state(control.entity));
      button.querySelector('.ctl-state').textContent = info.text;
      button.classList.toggle('on', info.active);
      button.classList.toggle('dead', info.dead);
    });
  };
}

/* ---------- Lecteur média ---------- */

// Le premier lecteur actif, sinon le premier configuré : la carte reste
// visible même à l'arrêt, sinon impossible d'ouvrir le panneau pour lancer
// un favori.
function activePlayer(ha) {
  for (const entity of CONFIG.mediaPlayers) {
    const state = ha.state(entity);
    if (state && (state.state === 'playing' || state.state === 'paused')) {
      return { entity, state, live: true };
    }
  }

  const fallback = CONFIG.mediaPlayers[0];
  const state = fallback ? ha.state(fallback) : null;
  return state ? { entity: fallback, state, live: false } : null;
}

export function buildMedia(ha) {
  const container = document.getElementById('media');
  let shownEntity = null;

  // Les trois boutons de transport agissent directement ; tout le reste de la
  // carte ouvre le panneau musique.
  container.addEventListener('click', (event) => {
    if (!shownEntity) return;
    const button = event.target.closest('button[data-action]');
    if (button) ha.callService('media_player', button.dataset.action, shownEntity);
    else openMusic(ha, shownEntity);
  });

  return () => {
    const current = activePlayer(ha);

    if (!current) {
      container.hidden = true;
      shownEntity = null;
      return;
    }

    const { entity, state, live } = current;
    const attrs = state.attributes || {};
    const playing = state.state === 'playing';
    const art = attrs.entity_picture;

    // On ne réécrit le bloc que si le morceau ou le lecteur change, pour ne pas
    // recharger la pochette à chaque événement.
    const signature = `${entity}|${live}|${attrs.media_title || ''}|${attrs.media_artist || ''}|${playing}`;
    if (container.dataset.signature !== signature) {
      container.dataset.signature = signature;
      container.innerHTML = `
        ${art ? `<img class="media-art" src="${art}" alt="">` : '<div class="media-art"></div>'}
        <span class="media-text">
          <span class="media-tag">${live ? 'En lecture' : 'Musique'}</span>
          <span class="media-title" data-marquee><span>${live ? (attrs.media_title || 'Lecture en cours') : 'Rien en lecture'}</span></span>
          <span class="media-artist" data-marquee><span>${live ? (attrs.media_artist || '') : 'Choisir un favori'}</span></span>
        </span>
        ${live ? `<span class="media-btns">
          <button type="button" data-action="media_previous_track" aria-label="Précédent">${icon('prev')}</button>
          <button type="button" data-action="media_play_pause" aria-label="${playing ? 'Pause' : 'Lecture'}">${icon(playing ? 'pause' : 'play')}</button>
          <button type="button" data-action="media_next_track" aria-label="Suivant">${icon('next')}</button>
        </span>` : ''}`;
      marqueeAll(container);
    }

    shownEntity = entity;
    container.hidden = false;
  };
}
