self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
    let dados = {};

    try {
        dados = event.data ? event.data.json() : {};
    } catch (e) {
        dados = {
            title: "Imperium TV",
            body: "Você tem uma nova notificação.",
            url: "/"
        };
    }

    const title = dados.title || "Imperium TV";
    const options = {
        body: dados.body || "Você tem uma nova notificação.",
        icon: dados.icon || "/logo.png",
        badge: dados.badge || "/logo.png",
        vibrate: [200, 100, 200],
        data: {
            url: dados.url || "/",
            tipo: dados.tipo || "geral"
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
    event.notification.close();

    const url = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if ("focus" in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

