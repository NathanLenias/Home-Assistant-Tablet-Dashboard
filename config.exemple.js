// Copy this file to `config.js`, fill it in, and you're done: everything else
// reads its settings from here.
//
// Note: the sample labels below are in French because the UI strings in
// index.html are too. Both are yours to translate freely.

export const CONFIG = {
  // Shown discreetly in the rail. Bump it on every change: one glance tells
  // you whether the tablet is really running the latest version, no console
  // needed (a kiosk page that's already loaded never reloads by itself).
  version: 1,

  // ---------- Home Assistant ----------
  ha: {
    // Leave empty to use the host serving the page automatically. Only set
    // this if the page is served on a different port than HA
    // (e.g. "wss://home.example.com:8443/api/websocket").
    url: '',

    // Long-lived access token. Create a DEDICATED user: non-admin, with
    // "local access only" checked, then: Profile > Security > Tokens.
    // Never use a token from your admin account.
    token: 'PASTE_YOUR_TOKEN_HERE',
  },

  // ---------- Location (Open-Meteo weather) ----------
  location: { latitude: 48.8566, longitude: 2.3522 }, // Paris — set your own

  // ---------- Sleep after inactivity ----------
  // Handled by the page itself: the screen fades to black with just the
  // clock, and the first touch wakes it without triggering the button
  // underneath. Hardware backlight is only driven under Fully Kiosk.
  dimmer: {
    enabled: true,
    delayDayMs: 5 * 60 * 1000,
    delayNightMs: 10 * 1000,
    shortDelayFromHour: 1,
    shortDelayToHour: 7,
    activeLevel: 160,
    dimmedDay: 90,
    dimmedNight: 5,
    dayStartHour: 7,
    nightStartHour: 23,
    wakeOnlyFirstTouch: true,
  },

  // ---------- Air quality ----------
  // A CO2 sensor in ppm, or leave empty to hide the line.
  airQuality: { entity: '' },

  // ---------- Rail temperatures ----------
  temperatures: [
    { label: 'Salon', icon: 'sofa', entity: 'sensor.your_living_room_temp' },
    { label: 'Bureau', icon: 'desk', entity: 'sensor.your_office_temp' },
    { label: 'Frigo', icon: 'fridge', entity: 'sensor.your_fridge_temp' },
  ],

  // ---------- Rail touch shortcuts ----------
  // type: 'light' | 'climate' | 'script'
  // Design rule: a tile either acts or opens, never both. A light toggles
  // directly; a thermostat always opens its panel.
  controls: [
    { label: 'Salon', icon: 'bulb', type: 'light', entity: 'light.your_lamp' },
    { label: 'Thermostat', icon: 'thermometer', type: 'climate', entity: 'climate.your_thermostat' },
    { label: 'Cuisine', icon: 'bulb', type: 'light', entity: 'light.your_kitchen_group' },
    { label: 'Nuit', icon: 'moon', type: 'script', entity: 'script.your_night_scene' },
  ],

  // ---------- Dock (opens the panels) ----------
  raccourcis: [
    { id: 'lumieres', label: 'Lumières', icon: 'bulb' },
    { id: 'batteries', label: 'Batteries', icon: 'battery' },
    { id: 'aspirateur', label: 'Aspirateur', icon: 'robot' },
    { id: 'courses', label: 'Liste de courses', icon: 'cart' },
    { id: 'taches', label: 'Tâches', icon: 'checklist' },
  ],

  // ---------- Batteries panel ----------
  // Nothing to list: sensors are auto-discovered via device_class: battery.
  // Adding a device to your home makes it appear here for free.
  batteries: {
    seuils: { critique: 15, faible: 30, surveiller: 50 },
    // Patterns stripped from displayed names, to avoid "Robot Battery Battery".
    nettoyer: [' Batterie', ' Battery level', ' battery level'],
    ignorer: [],
  },

  // ---------- List panels (todo entities) ----------
  listes: {
    courses: { entity: 'todo.your_shopping_list', titre: 'Liste de courses' },
    taches: { entity: 'todo.your_task_list', titre: 'Tâches' },
  },

  // ---------- Lights panel ----------
  // Beware of Hue-created groups: a Hue "room" group can drag in lamps from
  // other rooms. Check the entity's `lights` attribute, and prefer individual
  // lamps.
  lumieres: {
    ambiances: [
      { label: 'Détente', icon: 'sun', script: 'script.your_relax_scene' },
      { label: 'Film', icon: 'film', script: 'script.your_movie_scene' },
      { label: 'Dîner', icon: 'utensils', script: 'script.your_dinner_scene' },
      { label: 'Nuit', icon: 'moon', script: 'script.your_night_scene' },
    ],
    pieces: [
      { label: 'Salon', entity: 'light.your_living_room_lamp', detail: 'Lampe' },
      { label: 'Cuisine', entity: 'light.your_kitchen_group', detail: '4 spots' },
      { label: 'Chambre', entity: 'light.your_bedroom_lamp', detail: 'Lampe' },
    ],
  },

  // ---------- Media players (Sonos or others) ----------
  // First playing player in this list wins. Favorites and their artwork are
  // discovered live through browse_media, nothing hardcoded.
  mediaPlayers: ['media_player.your_speaker_1', 'media_player.your_speaker_2'],

  // Speakers offered in the "play on" section of the music panel.
  speakers: [
    { label: 'Séjour', entity: 'media_player.your_speaker_1' },
    { label: 'Bureau', entity: 'media_player.your_speaker_2' },
  ],

  // Volume button step, in percentage points.
  volumeStep: 2,

  // ---------- Vacuum panel ----------
  // The floor plan is a plain array of strings: one line per row, a dot for
  // an empty cell. The CSS grid is derived from it, nothing else to touch.
  // Keys are Home Assistant AREA ids (used with vacuum.clean_area), which
  // survive a robot re-mapping.
  aspirateur: {
    entity: 'vacuum.your_vacuum',
    batterie: 'sensor.your_vacuum_battery',
    pieceActuelle: 'sensor.your_vacuum_current_room',
    surface: 'sensor.your_vacuum_cleaning_area',
    duree: 'sensor.your_vacuum_cleaning_time',
    derniereFin: 'sensor.your_vacuum_last_clean_end',
    pieces: ['salon', 'cuisine', 'chambre'],
    libelles: { salon: 'Salon', cuisine: 'Cuisine', chambre: 'Chambre' },
    plan: [
      'salon cuisine',
      'salon chambre',
    ],
  },

  // ---------- Thermostat boost (optional) ----------
  // Scripts of your own that force heating for a while, plus a timer entity
  // that tracks the remaining time. Omit this block entirely to hide the
  // boost buttons in the thermostat panel.
  // thermostat: {
  //   boost: {
  //     15: 'script.your_boost_15_min',
  //     30: 'script.your_boost_30_min',
  //     stop: 'script.your_boost_stop',
  //   },
  //   boostTimer: 'timer.your_boost_timer',
  // },

  // ---------- Background slideshow ----------
  // Image URLs, local or remote. The slideshow rotates them with a slow
  // Ken Burns zoom.
  background: {
    intervalMs: 60000,
    images: [
      // '/local/wallpapers/forest.webp',
      // '/local/wallpapers/ocean.webp',
    ],
  },
};
