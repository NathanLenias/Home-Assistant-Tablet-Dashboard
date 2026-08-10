// Panneau batteries. Les capteurs ne sont pas listés dans la configuration :
// on prend tout ce que Home Assistant marque comme batterie. Ajouter un
// appareil à la maison le fera donc apparaître ici sans rien changer.

import { CONFIG } from '../config.js';
import { icon } from './icons.js';
import { openPanel, refreshPanel } from './panels.js';

const SEUILS = () => CONFIG.batteries?.seuils || { critique: 15, faible: 30, surveiller: 50 };

function niveau(valeur) {
  const s = SEUILS();
  if (valeur == null) return { cle: 'inconnu', mot: 'Inconnu' };
  if (valeur <= s.critique) return { cle: 'critique', mot: 'Remplacer' };
  if (valeur <= s.faible) return { cle: 'faible', mot: 'Faible' };
  if (valeur <= s.surveiller) return { cle: 'surveiller', mot: 'À surveiller' };
  return { cle: 'ok', mot: 'OK' };
}

function joliNom(state) {
  let nom = state.attributes?.friendly_name || state.entity_id;
  for (const motif of CONFIG.batteries?.nettoyer || []) nom = nom.split(motif).join('');
  return nom.trim();
}

function releve(ha) {
  const ignorer = CONFIG.batteries?.ignorer || [];
  const liste = [];

  for (const state of ha.states.values()) {
    if (!state.entity_id.startsWith('sensor.')) continue;
    if (state.attributes?.device_class !== 'battery') continue;
    if (ignorer.includes(state.entity_id)) continue;

    const brut = Number(state.state);
    const valeur = Number.isFinite(brut) ? Math.round(brut) : null;
    liste.push({ nom: joliNom(state), valeur, dispo: valeur != null });
  }

  // Les plus basses d'abord : c'est ce qu'on vient voir. Les indisponibles
  // ferment la marche plutôt que de polluer le haut de liste.
  return liste.sort((a, b) => {
    if (a.dispo !== b.dispo) return a.dispo ? -1 : 1;
    return (a.valeur ?? 0) - (b.valeur ?? 0);
  });
}

export function openBatteries(ha) {
  openPanel({
    title: 'Batteries',
    subtitle: '',
    icon: 'battery',
    wide: true,
    html: `
      <div class="bat-resume">
        <span><b data-total>—</b> appareils suivis</span>
        <span class="bat-compteurs" data-compteurs></span>
      </div>
      <div class="bat-liste" data-liste></div>`,

    mount() { refreshPanel(); },

    update(panel) {
      const liste = releve(ha);
      const s = SEUILS();
      const bas = liste.filter((b) => b.dispo && b.valeur <= s.faible).length;
      const critiques = liste.filter((b) => b.dispo && b.valeur <= s.critique).length;

      panel.querySelector('[data-sub]').textContent = 'Maison';
      panel.querySelector('[data-total]').textContent = liste.length;
      panel.querySelector('[data-compteurs]').innerHTML =
        (bas ? `<span class="pastille faible">${bas} à recharger</span>` : '')
        + (critiques ? `<span class="pastille critique">${critiques} critique${critiques > 1 ? 's' : ''}</span>` : '')
        + (!bas && !critiques ? '<span class="pastille ok">Tout va bien</span>' : '');

      panel.querySelector('[data-liste]').innerHTML = liste.map((b) => {
        const n = niveau(b.valeur);
        return `
          <div class="bat ${n.cle}">
            <span class="bat-icone">${icon('battery')}</span>
            <span class="bat-nom">${b.nom}</span>
            <span class="bat-jauge"><i style="width:${b.dispo ? b.valeur : 0}%"></i></span>
            <b class="bat-valeur">${b.dispo ? `${b.valeur}%` : '—'}</b>
            <span class="pastille ${n.cle}">${n.mot}</span>
          </div>`;
      }).join('');
    },
  });
}
