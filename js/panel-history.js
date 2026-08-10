// Panneau historique d'un capteur : valeur du moment, min, moyenne et max sur
// sept jours, et l'amplitude quotidienne en barres. Les données viennent des
// statistiques long terme du recorder, conservées bien au-delà des états bruts.

import { numeric } from './ha.js';
import { openPanel, refreshPanel } from './panels.js';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAYS = 7;

function template() {
  return `
    <div class="hist-top">
      <div class="hist-now">
        <div class="hist-value" data-value>--°</div>
        <div class="hist-delta" data-delta></div>
      </div>
      <div class="hist-stats">
        <div class="hist-stat"><div class="hist-stat-tag">Min 7j</div><div class="hist-stat-value cold" data-min>--</div></div>
        <div class="hist-stat"><div class="hist-stat-tag">Moy 7j</div><div class="hist-stat-value" data-mean>--</div></div>
        <div class="hist-stat"><div class="hist-stat-tag">Max 7j</div><div class="hist-stat-value hot" data-max>--</div></div>
      </div>
    </div>

    <div class="hist-head">
      <span class="panel-label">7 derniers jours</span>
      <span class="hist-caption">amplitude min-max</span>
    </div>
    <div class="hist-chart" data-chart><p class="muted">Chargement</p></div>`;
}

function since(iso) {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} j`;
}

function renderChart(container, rows) {
  if (!rows.length) {
    container.innerHTML = '<p class="muted">Pas encore assez d\'historique</p>';
    return;
  }

  const lows = rows.map((r) => r.min);
  const highs = rows.map((r) => r.max);
  const floor = Math.floor(Math.min(...lows)) - 1;
  const ceiling = Math.ceil(Math.max(...highs)) + 1;
  const span = Math.max(1, ceiling - floor);

  container.innerHTML = rows.map((row, index) => {
    const top = ((ceiling - row.max) / span) * 100;
    const height = Math.max(5, ((row.max - row.min) / span) * 100);
    const last = index === rows.length - 1;
    return `
      <div class="hist-day${last ? ' today' : ''}">
        <div class="hist-cap">${Math.round(row.max)}°</div>
        <div class="hist-track">
          <div class="hist-bar" style="top:${top}%;height:${height}%"></div>
        </div>
        <div class="hist-cap low">${Math.round(row.min)}°</div>
        <div class="hist-name">${JOURS[new Date(row.start).getDay()]}</div>
      </div>`;
  }).join('');
}

async function loadStatistics(ha, entity) {
  const start = new Date();
  start.setDate(start.getDate() - (DAYS - 1));
  start.setHours(0, 0, 0, 0);

  const result = await ha.ask({
    type: 'recorder/statistics_during_period',
    start_time: start.toISOString(),
    statistic_ids: [entity],
    period: 'day',
    types: ['min', 'mean', 'max'],
  });

  return (result?.[entity] || [])
    .filter((row) => row.min != null && row.max != null)
    .slice(-DAYS);
}

export function openHistory(ha, entity, label) {
  let days = [];

  openPanel({
    title: `Capteur ${label}`,
    subtitle: 'Température',
    icon: 'thermometer',
    html: template(),

    async mount(panel) {
      const chart = panel.querySelector('[data-chart]');
      try {
        days = await loadStatistics(ha, entity);
        renderChart(chart, days);

        if (days.length) {
          const mean = days.reduce((sum, row) => sum + (row.mean ?? 0), 0) / days.length;
          panel.querySelector('[data-min]').textContent = `${Math.round(Math.min(...days.map((d) => d.min)) * 10) / 10}°`;
          panel.querySelector('[data-mean]').textContent = `${Math.round(mean * 10) / 10}°`;
          panel.querySelector('[data-max]').textContent = `${Math.round(Math.max(...days.map((d) => d.max)) * 10) / 10}°`;
          // Les statistiques arrivent après le premier rendu : on le rejoue
          // pour que l'écart du jour s'affiche sans attendre un changement.
          refreshPanel();
        }
      } catch (error) {
        console.error('Historique indisponible', error);
        chart.innerHTML = '<p class="muted">Historique indisponible</p>';
      }
    },

    update(panel) {
      const state = ha.state(entity);
      const value = numeric(state, 1);

      panel.querySelector('[data-value]').textContent = value == null ? '--°' : `${value}°`;
      panel.querySelector('[data-sub]').textContent = `Température · ${since(state?.last_updated)}`;

      const today = days[days.length - 1];
      const delta = value != null && today ? Math.round((value - today.min) * 10) / 10 : null;
      panel.querySelector('[data-delta]').textContent =
        delta == null || delta <= 0 ? '' : `↑ ${delta}° depuis le plus bas du jour`;
    },
  });
}
