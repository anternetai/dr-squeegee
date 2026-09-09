// Service worker for the Dr. Squeegee crew portal (/team).
//
// Deliberately minimal: it exists to receive push and to open the right screen
// when a notification is tapped. No offline caching — a stale cached schedule is
// worse than no schedule, and the crew needs the live board.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: "Dr. Squeegee", body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "Dr. Squeegee"
  const options = {
    body: payload.body || "",
    icon: "/apple-touch-icon.png",
    badge: "/apple-touch-icon.png",
    tag: payload.tag || "squeegee-crew",
    renotify: true,
    data: { url: payload.url || "/team" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/team"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse an open crew tab if there is one, so tapping a notification doesn't
      // pile up windows over a day of jobs.
      for (const client of clients) {
        if (client.url.includes("/team") && "focus" in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
