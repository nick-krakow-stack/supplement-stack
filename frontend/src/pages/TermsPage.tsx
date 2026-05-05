export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-600">
        Nutzungsbedingungen
      </p>
      <h1 className="mb-6 text-3xl font-black text-slate-900">Nutzungsbedingungen</h1>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">1. Anbieter und Geltungsbereich</h2>
        <p>
          Diese Nutzungsbedingungen gelten für die Nutzung von Supplement Stack, angeboten durch Nick Krakow,
          Brockesstr. 58, 23554 Lübeck, E-Mail:{' '}
          <a className="font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">
            email@nickkrakow.de
          </a>
          .
        </p>
        <p>
          Supplement Stack ist ein kostenloser Dienst zur Verwaltung von Supplement-Stacks, Produktinformationen,
          gespeicherten Daten und eigenen Produktdaten. Eine kostenpflichtige Version oder ein Abonnement ist
          aktuell nicht vorgesehen.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">2. Account und Nutzung</h2>
        <p>
          Nutzer können einen Account anlegen, um Stacks und eigene Produkte zu speichern. Du bist dafür
          verantwortlich, deine Zugangsdaten vertraulich zu behandeln und korrekte Angaben zu machen.
        </p>
        <p>
          Die App darf nicht missbräuchlich genutzt werden, insbesondere nicht zur Störung des Betriebs,
          Umgehung von Sicherheitsfunktionen oder Eingabe rechtswidriger Inhalte.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">3. Keine medizinische Beratung</h2>
        <p>
          Supplement Stack stellt Informationen, Berechnungen und Verwaltungsfunktionen bereit. Die Inhalte
          ersetzen keine ärztliche Beratung, Diagnose, Behandlung, Therapie oder Krankheitseingrenzung.
        </p>
        <p>
          Bei akuten Beschwerden, Notfällen oder Verdacht auf medizinische Komplikationen ist der Notruf bzw.
          ärztliche Notfallversorgung unverzüglich zu nutzen. Die App ist kein Ersatz für medizinische
          Behandlungs- oder Überwachungsentscheidungen.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">4. Eigene Produkte und Inhalte</h2>
        <p>
          Du kannst eigene Produkte und Stack-Daten speichern. Du bist dafür verantwortlich, dass deine
          Eingaben richtig sind und keine Rechte Dritter verletzen. Supplement Stack kann Inhalte entfernen
          oder Funktionen einschränken, wenn Missbrauch oder ein Rechtsverstoß naheliegt.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">5. Verfügbarkeit und Änderungen</h2>
        <p>
          Es besteht kein Anspruch auf jederzeitige Verfügbarkeit. Wartung, technische Störungen oder
          Weiterentwicklung können die Nutzung zeitweise einschränken. Funktionen können geändert,
          erweitert oder eingestellt werden.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">6. Medizinische Eingabefälle und Risiken</h2>
        <p>
          Wenn du Medikamente einnimmst, eine Erkrankung hast oder schwanger / stillend bist, holst du
          bitte vor Änderungen an Supplement- oder Dosierungsentscheidungen ärztlichen Rat ein. Wir
          geben keine Gewähr dafür, dass Inhalte für genau deine persönliche medizinische Situation
          geeignet sind.
        </p>
        <p>
          Bei Wechselwirkungen, Kontraindikationen oder Nebenwirkungsverdacht bitte direkte Rücksprache
          mit Ärzt:innen bzw. Apotheker:innen halten.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">7. Affiliate-Links</h2>
        <p>
          Supplement Stack kann Affiliate-Links zu Amazon und weiteren Partnern enthalten. Wenn du über solche
          Links einkaufst, kann der Betreiber eine Provision erhalten. Für dich entstehen dadurch keine
          zusätzlichen Kosten.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">8. Haftung</h2>
        <p>
          Die App wird sorgfältig betrieben und weiterentwickelt. Eine Garantie für Vollständigkeit, Richtigkeit
          oder Aktualität der Inhalte und Produktdaten wird nicht übernommen. Die Inhalte ersetzen keine
          individuelle ärztliche Beurteilung.
        </p>
        <p>
          Es wird keine Garantie für die Eignung für deinen individuellen Gesundheitszustand übernommen.
          Supplement Stack haftet nicht für Entscheidungen, die auf Basis der Plattformdaten in medizinischen
          Fragestellungen (insbesondere bei Medikamenten, Erkrankungen, Schwangerschaft oder Stillzeit)
          getroffen werden.
        </p>
        <p>Gesetzliche Haftungsregelungen bleiben unberührt.</p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">9. Schlussbestimmungen</h2>
        <p>
          Es gilt deutsches Recht. Sollten einzelne Regelungen unwirksam sein, bleibt die Wirksamkeit der
          übrigen Regelungen unberührt.
        </p>
      </section>
    </article>
  );
}
