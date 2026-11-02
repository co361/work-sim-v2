/* UI resources are versioned. Refresh this site's existing worker on direct game entry. */
(() => {
  if (!('serviceWorker' in navigator) || location.hostname !== 'co361.github.io') return;
  const source = document.currentScript && document.currentScript.src;
  if (!source) return;
  navigator.serviceWorker.register(new URL('../sw.js', source), {updateViaCache:'none'})
    .then(registration => registration.update()).catch(() => {});
})();
