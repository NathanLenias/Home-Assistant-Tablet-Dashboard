// Point d'entrée : assemble la partie autonome (horloge, fonds, météo, trams)
// et la partie connectée à Home Assistant (rail, panneaux, qualité de l'air).

import { CONFIG } from '../config.js';
import { HomeAssistant } from './ha.js';
import { paintIcons, icon } from './icons.js';
import { startClock, startBackground, startWeather } from './screensaver.js';
import { startDimmer } from './dimmer.js';
import { initPanels, refreshPanel } from './panels.js';
import { buildAir } from './air.js';
import { buildTemperatures, buildControls, buildMedia } from './ui-panel.js';
import { openLights } from './panel-lights.js';
import { openBatteries } from './panel-batteries.js';
import { openVacuum } from './panel-vacuum.js';
import { openList } from './panel-list.js';

paintIcons();
initPanels();

document.getElementById('version').textContent = `v${CONFIG.version}`;

// ---------- Barre de raccourcis ----------
const PANNEAUX = {
  lumieres: openLights,
  batteries: openBatteries,
  aspirateur: openVacuum,
  courses: (h) => openList(h, CONFIG.listes?.courses, 'cart'),
  taches: (h) => openList(h, CONFIG.listes?.taches, 'checklist'),
};

const dock = document.getElementById('dock');
dock.innerHTML = (CONFIG.raccourcis || [])
  .map((r) => `<button class="dock-btn${r.bientot ? ' bientot' : ''}" type="button"
      data-panneau="${r.id}" title="${r.label}${r.bientot ? ' · bientôt' : ''}"
      aria-label="${r.label}">${icon(r.icon)}</button>`)
  .join('');

startClock();
startBackground();
startWeather();
startDimmer();

const ha = new HomeAssistant(CONFIG.ha);

const renderers = [];
const renderAll = () => renderers.forEach((render) => render());

renderers.push(
  buildTemperatures(ha),
  buildControls(ha),
  buildMedia(ha),
  buildAir(ha, renderAll),
  refreshPanel,
);

ha.onStatus((status) => {
  const badge = document.getElementById('link-status');
  badge.classList.toggle('off', status === 'off');
  badge.classList.toggle('wait', status === 'wait');
  if (status !== 'on') renderAll();
});

dock.addEventListener('click', (event) => {
  const bouton = event.target.closest('[data-panneau]');
  const ouvrir = bouton && PANNEAUX[bouton.dataset.panneau];
  if (ouvrir) ouvrir(ha);
});

ha.onChange(renderAll);
ha.connect();
renderAll();

// La tablette reste allumée des semaines : on recharge la page chaque nuit
// pour repartir sur un état propre (mémoire, connexions, cache d'images).
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 4 && now.getMinutes() === 30) location.reload();
}, 60 * 1000);
