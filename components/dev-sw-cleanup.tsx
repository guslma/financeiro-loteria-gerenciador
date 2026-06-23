"use client"

import { useEffect } from "react"

// O PWA fica desabilitado em desenvolvimento (next.config.mjs), mas o
// navegador pode ter um service worker de uma sessão anterior em que o app
// rodou em modo produção (ex: testes de build/Docker). Esse worker antigo
// tenta pré-cachear arquivos de build que não existem mais e gera erros
// "bad-precaching-response" no console. Como não deveria haver nenhum
// service worker ativo em dev, removemos qualquer um que sobrar.
export function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }, [])

  return null
}
