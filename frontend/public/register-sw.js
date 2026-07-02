;(function () {
  if (!("serviceWorker" in navigator)) return

  var isLocalhost =
    location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "[::1]"
  var isSecure = isLocalhost || location.protocol === "https:"

  // ── Em HTTP (IP puro): desregistra qualquer service worker antigo ──
  // Service Workers não funcionam em HTTP não-localhost. Se um SW da
  // versão anterior ficou registrado, ele intercepta os fetchs e força
  // HTTPS, quebrando tudo com ERR_SSL_PROTOCOL_ERROR.
  if (!isSecure) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (var i = 0; i < registrations.length; i++) {
        registrations[i].unregister()
      }
    })
    return
  }

  // ── HTTPS ou localhost: registra o service worker normalmente ──
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var installing = reg.installing
        if (!installing) return
        installing.addEventListener("statechange", function () {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
    })
    .catch(function () {
      // falha silenciosa - o app funciona sem SW
    })
})()
