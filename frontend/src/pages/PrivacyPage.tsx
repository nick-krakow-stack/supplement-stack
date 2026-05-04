export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-600">Datenschutz</p>
      <h1 className="mb-6 text-3xl font-black text-slate-900">Datenschutzerkl&auml;rung</h1>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <p>
          Diese Seite informiert kurz dar&uuml;ber, wie Supplement Stack personenbezogene Daten im
          Rahmen der Nutzung der App verarbeitet. Sie ist als Arbeitsfassung f&uuml;r die App gedacht
          und ersetzt keine finale rechtliche Pr&uuml;fung.
        </p>
        <p>
          Betreiber: Nick Krakow, Brockesstr. 58, 23554 L&uuml;beck,
          E-Mail: <a className="font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">email@nickkrakow.de</a>.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Nutzungsdaten und Google Analytics</h2>
        <p>
          Supplement Stack verwendet Google Analytics 4 nur, wenn du im Cookie- und
          Analytics-Banner aktiv zustimmst. Vor deiner Zustimmung wird das Google-Analytics-Skript
          nicht geladen und es werden keine Analytics-Events an Google gesendet.
        </p>
        <p>
          Nach Zustimmung k&ouml;nnen Seitenaufrufe innerhalb der App an Google Analytics
          &uuml;bermittelt werden. Dabei k&ouml;nnen technische Informationen wie aufgerufene URL,
          Zeitpunkt, Browser- und Ger&auml;teinformationen verarbeitet werden. Du kannst deine
          gespeicherte Entscheidung jederzeit &uuml;ber den Link
          <span className="font-bold"> Cookie-Einstellungen</span> im Footer &auml;ndern.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Account- und App-Daten</h2>
        <p>
          Wenn du einen Account anlegst oder eigene Supplement-Daten speicherst, verarbeitet die App
          die Daten, die f&uuml;r Registrierung, Login, Stack-Verwaltung, Wunschliste und eigene
          Produkte erforderlich sind.
        </p>
        <p>
          Gesundheitsbezogene Angaben und Supplement-Informationen dienen der App-Funktion und
          ersetzen keine medizinische Beratung.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Kontakt und Betroffenenrechte</h2>
        <p>
          Du kannst dich f&uuml;r Auskunft, Berichtigung oder L&ouml;schung deiner Daten an
          <a className="ml-1 font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">email@nickkrakow.de</a>
          wenden. Eingeloggte Nutzer k&ouml;nnen Profil- und Account-Funktionen direkt in der App
          nutzen.
        </p>
      </section>
    </article>
  );
}
