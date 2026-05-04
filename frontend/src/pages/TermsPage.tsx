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
          Diese Nutzungsbedingungen gelten f&uuml;r die Nutzung von Supplement Stack, angeboten
          durch Nick Krakow, Brockesstr. 58, 23554 L&uuml;beck,
          E-Mail:{' '}
          <a className="font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">
            email@nickkrakow.de
          </a>
          .
        </p>
        <p>
          Supplement Stack ist ein kostenloser Dienst zur Verwaltung von Supplement-Stacks,
          Produktinformationen, gespeicherten Daten und eigenen Produktdaten. Eine kostenpflichtige
          Version oder ein Abonnement ist aktuell nicht vorgesehen.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">2. Account und Nutzung</h2>
        <p>
          Nutzer k&ouml;nnen einen Account anlegen, um Stacks und eigene
          Produkte zu speichern. Du bist daf&uuml;r verantwortlich, deine Zugangsdaten vertraulich
          zu behandeln und korrekte Angaben zu machen.
        </p>
        <p>
          Die App darf nicht missbr&auml;uchlich genutzt werden, insbesondere nicht zur
          St&ouml;rung des Betriebs, Umgehung von Sicherheitsfunktionen oder Eingabe rechtswidriger
          Inhalte.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">3. Keine medizinische Beratung</h2>
        <p>
          Supplement Stack stellt Informationen und Verwaltungsfunktionen bereit. Die Inhalte
          ersetzen keine &auml;rztliche Beratung, Diagnose oder Therapie. Entscheidungen zu
          Nahrungserg&auml;nzungsmitteln, Dosierungen oder gesundheitlichen Fragen triffst du
          eigenverantwortlich und solltest sie bei Bedarf mit medizinischem Fachpersonal
          besprechen.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">4. Eigene Produkte und Inhalte</h2>
        <p>
          Du kannst eigene Produkte und Stack-Daten speichern. Du bist daf&uuml;r verantwortlich,
          dass deine Eingaben richtig sind und keine Rechte Dritter verletzen. Supplement Stack
          kann Inhalte entfernen oder Funktionen einschr&auml;nken, wenn ein Missbrauch oder ein
          Rechtsversto&szlig; naheliegt.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">5. Verf&uuml;gbarkeit und &Auml;nderungen</h2>
        <p>
          Es besteht kein Anspruch auf jederzeitige Verf&uuml;gbarkeit. Wartung, technische
          St&ouml;rungen oder Weiterentwicklung k&ouml;nnen die Nutzung zeitweise einschr&auml;nken.
          Funktionen k&ouml;nnen ge&auml;ndert, erweitert oder eingestellt werden.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">6. Affiliate-Links</h2>
        <p>
          Supplement Stack kann Affiliate-Links zu Amazon und weiteren Partnern enthalten. Wenn
          du &uuml;ber solche Links einkaufst, kann der Betreiber eine Provision erhalten. F&uuml;r
          dich entstehen dadurch keine zus&auml;tzlichen Kosten.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">7. Haftung</h2>
        <p>
          Die App wird mit Sorgfalt weiterentwickelt. Eine Gew&auml;hr f&uuml;r Vollst&auml;ndigkeit,
          Richtigkeit oder Aktualit&auml;t aller Inhalte und Produktdaten wird nicht &uuml;bernommen.
          Gesetzliche Haftungsregelungen bleiben unber&uuml;hrt.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">8. Schlussbestimmungen</h2>
        <p>
          Es gilt deutsches Recht. Sollten einzelne Regelungen unwirksam sein, bleibt die
          Wirksamkeit der &uuml;brigen Regelungen unber&uuml;hrt.
        </p>
      </section>
    </article>
  );
}
