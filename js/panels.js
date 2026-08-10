// Système de panneaux : un seul panneau ouvert à la fois, refermé au bouton,
// au toucher en dehors, à Échap, ou tout seul après un moment sans interaction.

import { icon } from './icons.js';

const IDLE_CLOSE_MS = 25000;

let current = null;
let idleTimer = null;

export function isPanelOpen() {
  return current !== null;
}

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => closePanel(), IDLE_CLOSE_MS);
}

export function closePanel() {
  if (!current) return;
  clearTimeout(idleTimer);
  current.cleanup?.();
  current = null;
  document.getElementById('panel-host').hidden = true;
  document.getElementById('panel').innerHTML = '';
  document.body.classList.remove('panel-open');
}

/**
 * spec : { title, subtitle, icon, tone, html, mount(panel), update(panel), cleanup() }
 * `html` est injecté une fois, `update` ne fait que rafraîchir les valeurs.
 */
export function openPanel(spec) {
  closePanel();

  const host = document.getElementById('panel-host');
  const panel = document.getElementById('panel');

  panel.className = `panel${spec.tone ? ` ${spec.tone}` : ''}${spec.wide ? ' wide' : ''}`;
  panel.innerHTML = `
    <header class="panel-head">
      <span class="panel-badge">${icon(spec.icon)}</span>
      <div class="panel-titles">
        <div class="panel-title">${spec.title}</div>
        <div class="panel-sub" data-sub>${spec.subtitle || ''}</div>
      </div>
      <button class="panel-close" type="button" aria-label="Fermer">${icon('close')}</button>
    </header>
    <div class="panel-body">${spec.html}</div>`;

  panel.querySelector('.panel-close').addEventListener('click', () => closePanel());

  current = spec;
  host.hidden = false;
  document.body.classList.add('panel-open');

  spec.mount?.(panel);
  spec.update?.(panel);
  resetIdle();
}

export function refreshPanel() {
  if (!current) return;
  current.update?.(document.getElementById('panel'));
}

// Câblage global, fait une seule fois au démarrage.
export function initPanels() {
  document.getElementById('panel-scrim').addEventListener('click', () => closePanel());

  document.getElementById('panel-host').addEventListener('pointerdown', () => resetIdle(), true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });
}
