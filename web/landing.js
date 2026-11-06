// Keep pre-release deep links working after moving the product to /app/.
const route=location.hash.slice(1).toLowerCase();
if (['protect','challenge','proof'].includes(route)) {
  location.replace('/app/#'+route);
}
