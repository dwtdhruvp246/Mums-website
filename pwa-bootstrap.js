// Capture the browser's invitation before React hydrates; nothing is persisted on this device.
window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();
  window.__cateringInstallPrompt = event;
});
window.addEventListener("appinstalled", function () {
  window.__cateringAppInstalled = true;
  delete window.__cateringInstallPrompt;
});
