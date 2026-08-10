// Panneau de liste, utilisé aussi bien pour les courses que pour les tâches :
// ce sont deux entités « todo » de Home Assistant, donc un seul code.

import { icon } from './icons.js';
import { openPanel, refreshPanel } from './panels.js';

function echapper(texte) {
  return String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function openList(ha, reglage, iconeParDefaut = 'checklist') {
  if (!reglage?.entity) return;
  let elements = [];

  const charger = async (panel) => {
    try {
      const reponse = await ha.ask({ type: 'todo/item/list', entity_id: reglage.entity });
      elements = reponse?.items || [];
    } catch (error) {
      console.error('Liste illisible', error);
      elements = [];
    }
    rendre(panel);
    refreshPanel();
  };

  const rendre = (panel) => {
    const zone = panel.querySelector('[data-items]');
    if (!elements.length) {
      zone.innerHTML = '<p class="muted">Liste vide</p>';
      return;
    }
    zone.innerHTML = elements.map((item, index) => {
      const fait = item.status === 'completed';
      return `
        <button class="item${fait ? ' fait' : ''}" type="button" data-index="${index}">
          <span class="case">${fait ? icon('check') : ''}</span>
          <span class="item-nom">${echapper(item.summary)}</span>
        </button>`;
    }).join('');
  };

  openPanel({
    title: reglage.titre || 'Liste',
    subtitle: '',
    icon: iconeParDefaut,
    html: `
      <div class="items" data-items><p class="muted">Chargement</p></div>
      <form class="ajout" data-ajout>
        <input type="text" data-champ placeholder="Ajouter un article" autocomplete="off">
        <button type="submit" aria-label="Ajouter">+</button>
      </form>`,

    mount(panel) {
      charger(panel);

      panel.querySelector('[data-items]').addEventListener('click', (event) => {
        const bouton = event.target.closest('[data-index]');
        if (!bouton) return;
        const item = elements[Number(bouton.dataset.index)];
        if (!item) return;

        const fait = item.status === 'completed';
        // On bascule tout de suite à l'écran, sans attendre l'aller-retour.
        item.status = fait ? 'needs_action' : 'completed';
        rendre(panel);

        ha.callService('todo', 'update_item', reglage.entity, {
          item: item.uid || item.summary,
          status: item.status,
        });
        setTimeout(() => charger(panel), 900);
      });

      panel.querySelector('[data-ajout]').addEventListener('submit', (event) => {
        event.preventDefault();
        const champ = panel.querySelector('[data-champ]');
        const texte = champ.value.trim();
        if (!texte) return;
        champ.value = '';
        ha.callService('todo', 'add_item', reglage.entity, { item: texte });
        setTimeout(() => charger(panel), 900);
      });
    },

    update(panel) {
      const restants = elements.filter((i) => i.status !== 'completed').length;
      const faits = elements.length - restants;
      panel.querySelector('[data-sub]').textContent = elements.length
        ? `${elements.length} article${elements.length > 1 ? 's' : ''} · ${faits} pris`
        : 'Rien pour l\'instant';
    },
  });
}
