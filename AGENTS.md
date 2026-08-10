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

## Security constraints

- The HA token is client-side by design; the README documents the
  mitigations (dedicated non-admin local-only user, basic auth, LAN-only).
  Never "fix" this by moving secrets into the code or the image.
