// Preserve deep links created before BEFORE's landing/app route split.
function forwardLegacyExperience() {
  const route=location.hash.slice(1).toLowerCase();
  if (['protect','challenge','proof'].includes(route)) {
    location.replace('/app/#'+route);
  }
}
forwardLegacyExperience();
window.addEventListener('hashchange',forwardLegacyExperience);
