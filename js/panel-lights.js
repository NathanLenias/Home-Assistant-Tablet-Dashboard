// Panneau lumières : une carte par pièce, un réglage d'ensemble, et les
// ambiances qui appellent les scripts déjà écrits dans Home Assistant.

import { CONFIG } from '../config.js';
import { icon } from './icons.js';
import { openPanel } from './panels.js';

function pourcent(state) {
  const brut = state?.attributes?.brightness;
  return brut == null ? null : Math.round((brut / 255) * 100);
}

function template() {
  const { ambiances = [], pieces = [] } = CONFIG.lumieres || {};

  return `
    <div class="all-lights" data-toutes>
      <span class="cast-icon">${icon('lamp')}</span>
      <span class="cast-text">
        <span class="cast-name">Toutes les lumières</span>
        <span class="cast-state" data-resume>—</span>
      </span>
      <span class="curseur">
        <input type="range" min="0" max="100" step="1" value="0" data-slider aria-label="Luminosité générale">
        <b data-niveau>—</b>
      </span>
      <button class="bascule" type="button" data-bascule aria-label="Tout allumer ou éteindre">
        <span></span>
      </button>
    </div>

    <div class="panel-label">Ambiances</div>
    <div class="ambiances">
      ${ambiances.map((a, i) => `
        <button class="ambiance" type="button" data-ambiance="${i}">
          ${icon(a.icon)} ${a.label}
        </button>`).join('')}
    </div>

    <div class="panel-label">Pièces</div>
    <div class="pieces">
      ${pieces.map((p, i) => `
        <div class="piece" data-piece="${i}">
          <div class="piece-head">
            <span class="piece-icon">${icon('bulb')}</span>
            <span class="pastille" data-etat>—</span>
          </div>
          <div class="piece-nom">${p.label}</div>
          <div class="piece-detail">${p.detail || ''}</div>
          <span class="curseur">
            <input type="range" min="0" max="100" step="1" value="0" data-slider aria-label="Luminosité ${p.label}">
            <b data-niveau>—</b>
          </span>
        </div>`).join('')}
    </div>`;
}

export function openLights(ha) {
  const pieces = CONFIG.lumieres?.pieces || [];
  const ambiances = CONFIG.lumieres?.ambiances || [];

  // Tant qu'un doigt tient un curseur, les mises à jour venues de Home
  // Assistant ne doivent pas le repositionner sous la main.
  const enCours = new Set();

  const poser = (entity, valeur) => {
    if (valeur <= 0) ha.callService('light', 'turn_off', entity);
    else ha.callService('light', 'turn_on', entity, { brightness_pct: valeur });
  };

  // Branche un curseur : étiquette vivante pendant le geste, appel de service
  // seulement au relâchement.
  const brancher = (zone, appliquer) => {
    const slider = zone.querySelector('[data-slider]');
    const etiquette = zone.querySelector('[data-niveau]');
    if (!slider) return;

    slider.addEventListener('pointerdown', () => enCours.add(slider));
    slider.addEventListener('input', () => {
      etiquette.textContent = `${slider.value}%`;
    });
    slider.addEventListener('change', () => {
      enCours.delete(slider);
      appliquer(Number(slider.value));
    });
    slider.addEventListener('pointercancel', () => enCours.delete(slider));
  };

  openPanel({
    title: 'Lumières',
    subtitle: '',
    icon: 'bulb',
    wide: true,
    html: template(),

    mount(panel) {
      const toutes = panel.querySelector('[data-toutes]');

      toutes.querySelector('[data-bascule]').addEventListener('click', () => {
        // Si quoi que ce soit est allumé, on éteint tout ; sinon on allume.
        const allumee = pieces.some((p) => ha.state(p.entity)?.state === 'on');
        pieces.forEach((p) => {
          ha.callService('light', allumee ? 'turn_off' : 'turn_on', p.entity);
        });
      });

      brancher(toutes, (valeur) => pieces.forEach((p) => poser(p.entity, valeur)));

      panel.querySelector('.ambiances').addEventListener('click', (event) => {
        const bouton = event.target.closest('[data-ambiance]');
        if (!bouton) return;
        const choix = ambiances[Number(bouton.dataset.ambiance)];
        if (choix?.script) ha.callService('script', 'turn_on', choix.script);
      });

      panel.querySelectorAll('[data-piece]').forEach((carte) => {
        const piece = pieces[Number(carte.dataset.piece)];
        brancher(carte, (valeur) => poser(piece.entity, valeur));

        // Un toucher sur la carte, hors du curseur, bascule la pièce.
        carte.addEventListener('click', (event) => {
          if (event.target.closest('.curseur')) return;
          ha.callService('light', 'toggle', piece.entity);
        });
      });
    },

    update(panel) {
      const allumees = pieces.filter((p) => ha.state(p.entity)?.state === 'on');
      const niveaux = allumees.map((p) => pourcent(ha.state(p.entity))).filter((v) => v != null);
      const moyenne = niveaux.length
        ? Math.round(niveaux.reduce((a, b) => a + b, 0) / niveaux.length)
        : null;

      panel.querySelector('[data-sub]').textContent =
        `${allumees.length} pièce${allumees.length > 1 ? 's' : ''} sur ${pieces.length} allumée${allumees.length > 1 ? 's' : ''}`;

      const toutes = panel.querySelector('[data-toutes]');
      toutes.classList.toggle('on', allumees.length > 0);
      toutes.querySelector('[data-resume]').textContent = allumees.length
        ? `Allumées · ${moyenne == null ? 'luminosité inconnue' : `luminosité moyenne ${moyenne} %`}`
        : 'Toutes éteintes';
      const curseurGeneral = toutes.querySelector('[data-slider]');
      if (!enCours.has(curseurGeneral)) {
        curseurGeneral.value = String(moyenne ?? 0);
        toutes.querySelector('[data-niveau]').textContent = moyenne == null ? '—' : `${moyenne}%`;
      }
      toutes.querySelector('[data-bascule]').classList.toggle('on', allumees.length > 0);

      panel.querySelectorAll('[data-piece]').forEach((carte) => {
        const piece = pieces[Number(carte.dataset.piece)];
        const state = ha.state(piece.entity);
        const dispo = Boolean(state) && state.state !== 'unavailable';
        const on = state?.state === 'on';
        const niveau = pourcent(state);

        carte.classList.toggle('on', on);
        carte.classList.toggle('dead', !dispo);
        carte.querySelector('[data-etat]').textContent = !dispo
          ? 'Indisponible' : (on ? 'Allumée' : 'Éteinte');
        const curseur = carte.querySelector('[data-slider]');
        curseur.disabled = !dispo;
        if (!enCours.has(curseur)) {
          curseur.value = String(on ? (niveau ?? 100) : 0);
          carte.querySelector('[data-niveau]').textContent = !on
            ? 'Off' : (niveau == null ? 'On' : `${niveau}%`);
        }
      });
    },
  });
}
