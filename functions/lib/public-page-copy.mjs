export const INTAKE_PLAN_INTRO = Object.freeze({
  heading: 'Deinen Einnahmeplan erstellen',
  description: 'Ordne die Produkte aus deinem Stack nach Zeitpunkt und Häufigkeit. Du kannst den Plan ansehen, drucken oder als PDF speichern und an deine Kontoadresse senden.',
  boundary: 'Du legst deine geplante Menge selbst fest. Der Plan ersetzt keine medizinische Beratung und gibt keine persönliche Dosierung vor.',
  links: Object.freeze([
    Object.freeze({ href: '/einnahmeplan', label: 'Zu meinem Einnahmeplan' }),
    Object.freeze({ href: '/register', label: 'Kostenlos registrieren' }),
  ]),
})
