# AGENTS.md

Single-page vanilla JS dashboard for Home Assistant. No build step, no
framework, no dependencies: index.html + style.css + ES modules in js/,
served as static files. All Home Assistant traffic goes through the
WebSocket wrapper in js/ha.js.

## Hard rules

- **Everything user-specific lives in config.js** (created from
  config.exemple.js, gitignored). Never hardcode an entity id, a room name,
  a coordinate or a URL in js/ — add a config field instead, with a
  commented example in config.exemple.js.
- **Bump CONFIG.version on every change.** It's displayed in the rail; it's
  how users see that their kiosk actually reloaded.
- **Keep it vanilla.** No npm, no bundler, no framework, no external
  runtime dependency. If a feature needs a library, it probably doesn't
  belong here.
- Code comments are in French; keep new ones consistent with that.
- Verify with `node --check` on every modified JS file. There is no test
  suite: the check is syntax + loading the page with a filled config.

## Architecture

- `js/ha.js` — WebSocket bridge: states cache, `state()`, `callService()`,
  `ask()` (promise), `onChange()`, `onEvent()`. Auto-reconnects.
- `js/panels.js` — panel host. A panel is `openPanel({title, icon, html,
  mount(panel), update(panel)})`: `html` is injected once, `update()` only
  refreshes values on every state change. Look at js/panel-lights.js for
  the canonical example.
- `js/screensaver.js` — everything that works without HA: clock, weather
  (Open-Meteo), background slideshow.
- `js/dimmer.js` — page-managed sleep; hardware brightness only exists
  under Fully Kiosk (`window.fully`).
- `js/icons.js` — inline SVG icon registry; add icons there, reference by
  name.
- `style.css` — single stylesheet; palette lives in CSS variables at the
  top; reuse them.

## Design rules the UI follows

- A tile either acts or opens a panel, never both.
- Entry points are never conditioned on activity (e.g. the music card
  stays visible when nothing is playing: that's when you start music).
- Prefer discovering over listing (batteries are found via
  `device_class: battery`; Sonos favorites via `browse_media`).
- Panels auto-close after inactivity; sleep never fires while a panel is
  open.

## Extending the dashboard

One principle drives the whole screen: **the home page serves the room the
tablet lives in**. The tiles on it are the handful of actions you actually
reach for from that spot — the lights around you, the thermostat, the one
scene you use at night. Everything else lives one tap away, in a panel.
We've been tempted to add "just one more button" many times; every button
added to the home page makes all the others a bit less visible, and past a
point the screen stops being used at all. When in doubt: main actions on
home, the rest in a panel.

Almost everything we've added to this dashboard ended up being a panel plus
a config section. Every time we started modifying the core instead (the
WebSocket bridge, the panel host, the dimmer), we regretted it: the panel
version was simpler and survived later changes. So if you're adding a
feature, it's worth asking first: what would the panel-shaped version of
this look like?

### How we build a panel

The path we follow, in the order that has worked best:

1. Start with the config, not the code: sketch the section in
   config.exemple.js (entities, labels, thresholds). It forces the design
   question early: what does a stranger's home need to provide? A nice
   pattern we ended up with: when an optional section is absent, the
   feature hides itself instead of breaking (the thermostat boost buttons
   are a good example).
2. js/panel-lights.js is our reference panel, the one we copy from: a
   template string with `data-*` hooks, `mount(panel)` that wires listeners
   once, `update(panel)` that only refreshes values. We learned to never
   rebuild HTML inside update(): it runs on every state change.
3. Wiring up is three small touches: an import + entry in the PANNEAUX map
   (js/main.js), a dock entry in the config's `raccourcis`, and an icon in
   js/icons.js if none fits.
4. For styling, the palette variables and existing pieces (`.panel-label`,
   `.segmented`, the card patterns) go a long way: a good new panel looks
   like it was always there.
5. Before calling it done: bump CONFIG.version (it's how you'll know your
   kiosk really reloaded) and `node --check` the files you touched.

### Tips from building this

- When Home Assistant can tell you something, let it: our batteries panel
  discovers sensors via `device_class`, the music favorites come from
  `browse_media`. Config lists that users must maintain get stale;
  discovery doesn't.
- Missing entities happen all the time (renames, integrations down). We
  show "—" instead of crashing, and the `numeric()` helper handles most of
  it.
- We trust `update()` over optimism: the UI shows what HA reports, not what
  we hope an action did.
- Some interaction habits we stuck with, and were glad we did: a tile
  either acts or opens a panel (never both), no long-press for meaningful
  actions, and entry points stay visible when idle — the music card is
  shown precisely when nothing plays, because that's when you start music.
- Our test for a well-integrated feature: the user only had to edit
  config.js to adopt it.

## Security constraints

- The HA token is client-side by design; the README documents the
  mitigations (dedicated non-admin local-only user, basic auth, LAN-only).
  Never "fix" this by moving secrets into the code or the image.
