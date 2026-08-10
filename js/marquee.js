// Fait défiler un texte uniquement lorsqu'il dépasse de son conteneur.
// L'élément doit contenir un seul enfant, qui porte le texte.

export function marquee(element) {
  const inner = element?.firstElementChild;
  if (!inner) return;

  element.classList.remove('marquee');
  element.style.removeProperty('--shift');
  element.style.removeProperty('--dur');

  const overflow = inner.scrollWidth - element.clientWidth;
  if (overflow <= 2) return;

  element.style.setProperty('--shift', `-${overflow}px`);
  // Vitesse constante quelle que soit la longueur, plus un temps de lecture
  // aux deux extrémités.
  element.style.setProperty('--dur', `${Math.max(7, overflow / 24 + 5)}s`);
  element.classList.add('marquee');
}

// Les polices web arrivent après le premier rendu et changent les largeurs :
// on remesure une fois qu'elles sont prêtes.
export function marqueeAll(root) {
  const run = () => root.querySelectorAll('[data-marquee]').forEach(marquee);
  run();
  document.fonts?.ready.then(run);
}
