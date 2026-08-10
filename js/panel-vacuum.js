// Panneau aspirateur : batterie et commandes en tête, plan du logement pour
// choisir les pièces, puissance, et le bilan de la dernière session.
//
// Le plan vient de la configuration : c'est une grille CSS déduite d'un simple
// tableau de chaînes, ce qui permet de le réorganiser sans toucher au code.

import { CONFIG } from '../config.js';
import { icon } from './icons.js';
import { numeric } from './ha.js';
import { openPanel } from './panels.js';

const ETATS = {
  docked: 'Sur la base',
  cleaning: 'En nettoyage',
  returning: 'Retour à la base',
  paused: 'En pause',
  idle: 'À l\'arrêt',
  error: 'Erreur',
  unavailable: 'Injoignable',
};

const PUISSANCES = [
  { label: 'Éco', valeur: 'quiet', icon: 'sun' },
  { label: 'Normal', valeur: 'balanced', icon: 'volume' },
  { label: 'Turbo', valeur: 'turbo', icon: 'bolt' },
];

// Le robot nomme ses pièces à sa façon (« Salle de bain », « Entrée ») alors
// que le plan les désigne par une clé et les affiche parfois abrégées (« Sdb »).
// On rapproche les deux sur une forme normalisée plutôt que sur le libellé.
function normaliser(nom) {
  return (nom || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function depuis(iso) {
  if (!iso) return '—';
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(jours)) return '—';
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return 'Hier';
  return `Il y a ${jours} j`;
}

export function openVacuum(ha) {
  const reglage = CONFIG.aspirateur || {};
  const libelles = reglage.libelles || {};
  const plan = reglage.plan || [];
  const choisies = new Set();

  // Les pièces réellement placées sur le plan, dans l'ordre de lecture.
  const surLePlan = [...new Set(plan.join(' ').split(/\s+/).filter((c) => c && c !== '.'))];

  const template = () => `
    <div class="asp-barre">
      <div class="asp-batt">
        <span class="asp-batt-icone">${icon('battery')}</span>
        <span>
          <b data-batterie>—</b>
          <small data-charge>—</small>
        </span>
      </div>
      <button class="asp-go" type="button" data-lancer>${icon('play')} Démarrer</button>
      <button class="asp-secondaire" type="button" data-action="retour_base">${icon('home')} Retour base</button>
    </div>

    <div class="asp-plan" data-plan
         style="grid-template-areas: ${plan.map((l) => `'${l}'`).join(' ')}">
      ${surLePlan.map((cle) => `
        <button class="asp-zone" type="button" data-piece="${cle}" style="grid-area: ${cle}">
          <span>${libelles[cle] || cle}</span>
          <i class="asp-position" hidden></i>
        </button>`).join('')}
    </div>

    <div class="panel-label">Puissance</div>
    <div class="segmented trois">
      ${PUISSANCES.map((p) => `
        <button type="button" data-puissance="${p.valeur}">${icon(p.icon)} ${p.label}</button>`).join('')}
    </div>

    <div class="asp-bilan">
      <div><span>Surface</span><b data-surface>—</b></div>
      <div><span>Durée</span><b data-duree>—</b></div>
      <div><span>Dernier</span><b data-dernier>—</b></div>
    </div>`;

  const rendreChoix = (panel) => {
    panel.querySelectorAll('[data-piece]').forEach((b) => {
      b.classList.toggle('on', choisies.has(b.dataset.piece));
    });
    const bouton = panel.querySelector('[data-lancer]');
    bouton.lastChild.textContent = choisies.size
      ? ` Nettoyer ${choisies.size} pièce${choisies.size > 1 ? 's' : ''}`
      : ' Démarrer';
  };

  openPanel({
    title: 'Aspirateur',
    subtitle: '',
    icon: 'robot',
    wide: true,
    html: template(),

    mount(panel) {
      panel.querySelector('[data-plan]').addEventListener('click', (event) => {
        const b = event.target.closest('[data-piece]');
        if (!b) return;
        const p = b.dataset.piece;
        if (choisies.has(p)) choisies.delete(p);
        else choisies.add(p);
        rendreChoix(panel);
      });

      // Sans sélection, on lance le nettoyage complet plutôt que de ne rien
      // faire : c'est le geste attendu quand on appuie sur « Démarrer ».
      panel.querySelector('[data-lancer]').addEventListener('click', () => {
        if (choisies.size) {
          ha.callService('vacuum', 'clean_area', reglage.entity, {
            cleaning_area_id: [...choisies],
          });
          choisies.clear();
          rendreChoix(panel);
        } else {
          ha.callService('vacuum', 'start', reglage.entity);
        }
      });

      panel.addEventListener('click', (event) => {
        const b = event.target.closest('[data-action]');
        if (b) ha.callService('vacuum', 'return_to_base', reglage.entity);
      });

      panel.querySelector('.segmented').addEventListener('click', (event) => {
        const b = event.target.closest('[data-puissance]');
        if (!b) return;
        ha.callService('vacuum', 'set_fan_speed', reglage.entity, { fan_speed: b.dataset.puissance });
      });

      rendreChoix(panel);
    },

    update(panel) {
      const state = ha.state(reglage.entity);
      const batterie = numeric(ha.state(reglage.batterie), 0);
      const piece = ha.state(reglage.pieceActuelle)?.state;
      const etat = ETATS[state?.state] || state?.state || '—';

      panel.querySelector('[data-sub]').textContent = etat;
      panel.querySelector('[data-batterie]').textContent = batterie == null ? '—' : `${batterie}%`;
      panel.querySelector('[data-charge]').textContent =
        state?.state === 'docked' && (batterie ?? 0) < 100 ? 'En charge' : etat;

      panel.querySelectorAll('[data-puissance]').forEach((b) => {
        b.classList.toggle('on', b.dataset.puissance === state?.attributes?.fan_speed);
      });

      // Repère de position : la pièce où il se trouve, telle que le robot la
      // nomme, rapprochée des clés du plan. Le repère ne s'affiche que quand il
      // roule : à l'arrêt, le capteur garde la dernière pièce visitée, et un
      // point qui pulse sur un robot posé sur sa base serait un mensonge.
      const enRoute = state?.state === 'cleaning' || state?.state === 'returning';
      const ici = enRoute ? normaliser(piece) : '';
      panel.querySelectorAll('[data-piece]').forEach((b) => {
        const dedans = Boolean(ici) && ici === b.dataset.piece;
        b.querySelector('.asp-position').hidden = !dedans;
        b.classList.toggle('ici', dedans);
      });

      const surface = numeric(ha.state(reglage.surface), 0);
      const duree = numeric(ha.state(reglage.duree), 0);
      panel.querySelector('[data-surface]').textContent = surface == null ? '—' : `${surface} m²`;
      panel.querySelector('[data-duree]').textContent = duree == null ? '—' : `${duree} min`;
      panel.querySelector('[data-dernier]').textContent = depuis(ha.state(reglage.derniereFin)?.state);
    },
  });
}
