// Panneau musique : lecteur du Sonos meneur, gestion du groupe d'enceintes
// avec volume par pièce, et favoris avec leurs pochettes réelles.

import { CONFIG } from '../config.js';
import { icon } from './icons.js';
import { openPanel } from './panels.js';

const REPEAT_CYCLE = { off: 'all', all: 'one', one: 'off' };
const KINDS = { Albums: 'Album', Playlists: 'Playlist', Tracks: 'Titre' };

function clock(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// La position n'est publiée qu'aux changements : on l'extrapole entre deux.
function elapsed(state) {
  const position = state?.attributes?.media_position;
  if (position == null) return null;
  if (state.state !== 'playing') return position;
  const since = state.attributes.media_position_updated_at;
  if (!since) return position;
  return position + (Date.now() - new Date(since).getTime()) / 1000;
}

function escape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

// Les favoris Sonos sont rangés en trois dossiers ; on les met à plat.
async function loadFavourites(ha, entity) {
  const root = await ha.ask({
    type: 'media_player/browse_media',
    entity_id: entity,
    media_content_type: 'favorites',
    media_content_id: '',
  });

  const items = [];
  for (const folder of root?.children || []) {
    const sub = await ha.ask({
      type: 'media_player/browse_media',
      entity_id: entity,
      media_content_type: folder.media_content_type,
      media_content_id: folder.media_content_id,
    });
    for (const child of sub?.children || []) {
      if (!child.can_play) continue;
      items.push({
        title: child.title,
        thumbnail: child.thumbnail,
        contentId: child.media_content_id,
        contentType: child.media_content_type,
        kind: KINDS[folder.title] || folder.title,
      });
    }
  }
  return items;
}

function template() {
  return `
    <div class="music-grid">
      <div class="np">
        <div class="np-top">
          <div class="np-art" data-art></div>
          <div class="np-info">
            <div class="np-tag">En lecture</div>
            <div class="np-title" data-title>—</div>
            <div class="np-artist" data-artist></div>
          </div>
        </div>
        <div class="np-bar"><div class="np-fill" data-fill></div></div>
        <div class="np-times"><span data-elapsed>0:00</span><span data-duration>0:00</span></div>
        <div class="np-controls">
          <button class="np-btn" type="button" data-act="shuffle" aria-label="Aléatoire">${icon('shuffle')}</button>
          <button class="np-btn" type="button" data-act="prev" aria-label="Précédent">${icon('prev')}</button>
          <button class="np-btn play" type="button" data-act="play" aria-label="Lecture ou pause"></button>
          <button class="np-btn" type="button" data-act="next" aria-label="Suivant">${icon('next')}</button>
          <button class="np-btn" type="button" data-act="repeat" aria-label="Répétition">${icon('repeat')}</button>
        </div>
      </div>

      <div class="cast">
        <div class="cast-head">
          <span class="panel-label">Diffuser sur</span>
          <span class="cast-count">${icon('link')}<span data-count></span></span>
        </div>
        <div class="cast-list" data-speakers></div>
      </div>
    </div>

    <div class="fav-head">
      <span class="panel-label">Favoris</span>
      <span class="hist-caption">appuyez pour lancer</span>
    </div>
    <div class="fav-row" data-favs><p class="muted">Chargement des favoris</p></div>`;
}

export function openMusic(ha, entity) {
  const step = (CONFIG.volumeStep ?? 2) / 100;
  const speakers = CONFIG.speakers || [];
  let favourites = [];
  let tick = null;

  const state = () => ha.state(entity);
  const call = (service, data) => ha.callService('media_player', service, entity, data);

  const members = () => {
    const list = state()?.attributes?.group_members || [];
    return list.length ? list : [entity];
  };

  const nudge = (target, direction) => {
    const level = ha.state(target)?.attributes?.volume_level;
    if (level == null) return;
    const next = Math.min(1, Math.max(0, Math.round((level + direction * step) * 100) / 100));
    ha.callService('media_player', 'volume_set', target, { volume_level: next });
  };

  openPanel({
    title: 'Musique',
    subtitle: state()?.attributes?.friendly_name || '',
    icon: 'music',
    wide: true,
    html: template(),

    mount(panel) {
      panel.querySelector('[data-act="prev"]').addEventListener('click', () => call('media_previous_track'));
      panel.querySelector('[data-act="next"]').addEventListener('click', () => call('media_next_track'));
      panel.querySelector('[data-act="play"]').addEventListener('click', () => call('media_play_pause'));

      panel.querySelector('[data-act="shuffle"]').addEventListener('click', () => {
        call('shuffle_set', { shuffle: !state()?.attributes?.shuffle });
      });

      panel.querySelector('[data-act="repeat"]').addEventListener('click', () => {
        call('repeat_set', { repeat: REPEAT_CYCLE[state()?.attributes?.repeat || 'off'] || 'all' });
      });

      panel.querySelector('[data-speakers]').addEventListener('click', (event) => {
        const button = event.target.closest('[data-vol]');
        const row = event.target.closest('[data-speaker], [data-group]');
        if (!row) return;
        const direction = button ? Number(button.dataset.vol) : 0;

        // Le volume du groupe déplace toutes les enceintes du même pas.
        if (row.hasAttribute('data-group')) {
          if (direction) members().forEach((target) => nudge(target, direction));
          return;
        }

        const target = row.dataset.speaker;
        if (direction) {
          nudge(target, direction);
          return;
        }
        // Un toucher hors des boutons fait entrer ou sortir du groupe.
        if (target === entity) return;
        if (members().includes(target)) ha.callService('media_player', 'unjoin', target);
        else call('join', { group_members: [target] });
      });

      panel.querySelector('[data-favs]').addEventListener('click', (event) => {
        const card = event.target.closest('[data-fav]');
        if (!card) return;
        const item = favourites[Number(card.dataset.fav)];
        if (!item) return;
        call('play_media', { media_content_type: item.contentType, media_content_id: item.contentId });
      });

      // La barre de progression avance seule entre deux mises à jour.
      tick = setInterval(() => {
        const current = state();
        if (current?.state !== 'playing') return;
        const seconds = elapsed(current);
        const duration = current?.attributes?.media_duration;
        panel.querySelector('[data-elapsed]').textContent = clock(seconds);
        if (duration) {
          panel.querySelector('[data-fill]').style.width = `${Math.min(100, (seconds / duration) * 100)}%`;
        }
      }, 1000);

      loadFavourites(ha, entity)
        .then((items) => {
          favourites = items;
          const row = panel.querySelector('[data-favs]');
          row.innerHTML = items.length
            ? items.map((item, index) => `
                <button class="fav" type="button" data-fav="${index}">
                  <span class="fav-cover"${item.thumbnail ? ` style="background-image:url('${escape(item.thumbnail)}')"` : ''}>
                    ${item.thumbnail ? '' : icon('music')}
                  </span>
                  <span class="fav-name">${escape(item.title)}</span>
                  <span class="fav-kind">${escape(item.kind)}</span>
                </button>`).join('')
            : '<p class="muted">Aucun favori</p>';
        })
        .catch((error) => {
          console.error('Favoris indisponibles', error);
          panel.querySelector('[data-favs]').innerHTML = '<p class="muted">Favoris indisponibles</p>';
        });
    },

    update(panel) {
      const current = state();
      const attrs = current?.attributes || {};
      const playing = current?.state === 'playing';

      panel.querySelector('[data-sub]').textContent = attrs.friendly_name || '';
      panel.querySelector('[data-title]').textContent = attrs.media_title || 'Rien en lecture';
      panel.querySelector('[data-artist]').textContent =
        [attrs.media_artist, attrs.media_album_name].filter(Boolean).join(' · ');

      const art = panel.querySelector('[data-art]');
      art.style.backgroundImage = attrs.entity_picture ? `url('${attrs.entity_picture}')` : '';

      const seconds = elapsed(current);
      const duration = attrs.media_duration;
      panel.querySelector('[data-elapsed]').textContent = clock(seconds);
      panel.querySelector('[data-duration]').textContent = clock(duration);
      panel.querySelector('[data-fill]').style.width =
        duration && seconds != null ? `${Math.min(100, (seconds / duration) * 100)}%` : '0%';

      panel.querySelector('[data-act="play"]').innerHTML = icon(playing ? 'pause' : 'play');
      panel.querySelector('[data-act="shuffle"]').classList.toggle('on', Boolean(attrs.shuffle));
      panel.querySelector('[data-act="repeat"]').classList.toggle('on', (attrs.repeat || 'off') !== 'off');

      const grouped = members();
      panel.querySelector('[data-count]').textContent =
        grouped.length > 1 ? `${grouped.length} pièces groupées` : 'Pièce seule';

      const level = (target) => {
        const value = ha.state(target)?.attributes?.volume_level;
        return value == null ? null : Math.round(value * 100);
      };

      const rows = speakers.map((speaker) => {
        const inGroup = grouped.includes(speaker.entity);
        const leader = speaker.entity === entity;
        const status = leader
          ? (grouped.length > 1 ? 'Meneur du groupe' : 'Seule')
          : (inGroup ? 'Dans le groupe' : 'Disponible');
        const value = level(speaker.entity);
        return `
          <div class="cast-row${inGroup ? ' in' : ''}${leader ? ' leader' : ''}" data-speaker="${speaker.entity}">
            <span class="cast-icon">${icon('speaker')}</span>
            <span class="cast-text">
              <span class="cast-name">${escape(speaker.label)}</span>
              <span class="cast-state">${status}</span>
            </span>
            <span class="vol">
              <button type="button" data-vol="-1" aria-label="Baisser">&minus;</button>
              <b>${value == null ? '--' : value}</b>
              <button type="button" data-vol="1" aria-label="Monter">+</button>
            </span>
          </div>`;
      });

      const levels = grouped.map(level).filter((value) => value != null);
      const average = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null;
      const names = speakers.filter((s) => grouped.includes(s.entity)).map((s) => s.label).join(' + ');

      rows.push(`
        <div class="cast-row group" data-group>
          <span class="cast-icon">${icon('volume')}</span>
          <span class="cast-text">
            <span class="cast-name">Volume du groupe</span>
            <span class="cast-state">${escape(names || '—')}</span>
          </span>
          <span class="vol">
            <button type="button" data-vol="-1" aria-label="Baisser">&minus;</button>
            <b>${average == null ? '--' : average}</b>
            <button type="button" data-vol="1" aria-label="Monter">+</button>
          </span>
        </div>`);

      panel.querySelector('[data-speakers]').innerHTML = rows.join('');
    },

    cleanup() {
      clearInterval(tick);
    },
  });
}
