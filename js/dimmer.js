// Mise en veille après inactivité, gérée par la page plutôt que par l'écran de
// veille de Fully. L'écran reste allumé et continue de répondre : le
// rétroéclairage descend, et la page se réduit à un fond noir avec l'heure.

import { CONFIG } from '../config.js';

// Interface JavaScript injectée par Fully Kiosk. Absente ailleurs (Mac par
// exemple), auquel cas on assombrit visuellement au lieu du rétroéclairage.
function nativeBrightness() {
  const api = window.fully;
  if (api && typeof api.setScreenBrightness === 'function') {
    return (level) => api.setScreenBrightness(level);
  }
  return null;
}

export function startDimmer() {
  const settings = CONFIG.dimmer;
  if (!settings?.enabled) return;

  // Hors de Fully (sur un ordinateur), la page ne se met pas en veille : il
  // n'existe aucun moyen de baisser le rétroéclairage, et un écran qui devient
  // noir sur un Mac dont on se sert gêne plus qu'il ne sert. La classe
  // « dimmed » reste posée partout, elle sert de repère à la mascotte ; seule
  // « veille », qui porte l'écran noir, est réservée à l'appareil mural.
  const setBrightness = nativeBrightness();
  const surTablette = Boolean(setBrightness);

  const apply = (level) => {
    if (!setBrightness) return;
    try {
      setBrightness(level);
    } catch (error) {
      console.warn('Luminosité inaccessible', error);
    }
  };

  // Le niveau assombri suit le jour et la nuit, comme le faisait l'automation
  // Home Assistant qu'il remplace.
  const dimLevel = () => {
    const hour = new Date().getHours();
    const day = hour >= settings.dayStartHour && hour < settings.nightStartHour;
    return day ? settings.dimmedDay : settings.dimmedNight;
  };

  // Entre 1h et 7h l'écran s'assombrit presque tout de suite ; le reste du
  // temps on laisse plusieurs minutes pour avoir le temps de lire.
  const delay = () => {
    const hour = new Date().getHours();
    const short = hour >= settings.shortDelayFromHour && hour < settings.shortDelayToHour;
    return short ? settings.delayNightMs : settings.delayDayMs;
  };

  let dimmed = false;
  let appliedLevel = null;
  let timer;

  const dim = () => {
    // Un panneau ouvert ou une conversation en cours suspendent
    // l'assombrissement : on lit, on parle, on règle, puis seulement on ferme.
    if (document.body.classList.contains('panel-open')
        || document.body.classList.contains('voice-active')) {
      timer = setTimeout(dim, delay());
      return;
    }
    if (dimmed) return;
    dimmed = true;
    document.body.classList.add('dimmed');
    document.body.classList.toggle('veille', surTablette);
    appliedLevel = dimLevel();
    apply(appliedLevel);
  };

  // Renvoie vrai si l'appel a effectivement réveillé un écran assombri.
  const wake = () => {
    clearTimeout(timer);
    timer = setTimeout(dim, delay());
    if (!dimmed) return false;
    dimmed = false;
    appliedLevel = null;
    document.body.classList.remove('dimmed', 'veille');
    apply(settings.activeLevel);
    return true;
  };

  // La page peut être rechargée alors que l'écran était assombri : on repart
  // toujours d'une luminosité connue.
  apply(settings.activeLevel);
  timer = setTimeout(dim, delay());

  window.addEventListener('pointerdown', (event) => {
    const wokeUp = wake();
    if (wokeUp && settings.wakeOnlyFirstTouch) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true });

  ['pointermove', 'keydown', 'wheel'].forEach((type) => {
    window.addEventListener(type, () => wake(), { capture: true, passive: true });
  });

  // Le mot de réveil rallume l'écran comme un toucher l'aurait fait.
  window.addEventListener('tablette-reveil', () => wake());

  // L'écran peut rester assombri plusieurs heures et traverser 7h ou 23h :
  // on réajuste alors la luminosité sans attendre un réveil.
  setInterval(() => {
    if (!dimmed) return;
    const level = dimLevel();
    if (level === appliedLevel) return;
    appliedLevel = level;
    apply(level);
  }, 60 * 1000);
}
