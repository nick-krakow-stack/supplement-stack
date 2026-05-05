export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-600">Datenschutz</p>
      <h1 className="mb-6 text-3xl font-black text-slate-900">Datenschutzerkl&auml;rung</h1>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <p>
          Diese Datenschutzerkl&auml;rung informiert dar&uuml;ber, wie Supplement Stack
          personenbezogene Daten verarbeitet, wenn du die Website und App nutzt.
        </p>
        <p>
          Verantwortlicher: Nick Krakow, Brockesstr. 58, 23554 L&uuml;beck,
          E-Mail:{' '}
          <a className="font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">
            email@nickkrakow.de
          </a>
          .
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Verarbeitete Daten</h2>
        <p>
          Je nach Nutzung verarbeitet Supplement Stack Account-Daten wie E-Mail-Adresse,
          Login-Informationen und Passwort-Hash, optionale Profil- und Pr&auml;ferenzdaten
          wie Alter, Geschlecht und Empfehlungsquelle, Health-Consent-Status, gespeicherte
          Stacks und eigene Produktdaten.
        </p>
        <p>
          Au&szlig;erdem werden technische Sicherheits- und Serverlogdaten verarbeitet, etwa
          IP-Adresse, Zeitpunkt, angefragte URL, Statuscode, Browser- und Ger&auml;tedaten.
          Die Cookie- und Analytics-Entscheidung wird lokal in deinem Browser gespeichert.
        </p>
        <p>
          Supplement- und Stack-Angaben k&ouml;nnen einen Gesundheitsbezug haben. Die App
          nutzt diese Angaben ausschlie&szlig;lich zur Bereitstellung der Funktionen. Sie bietet
          keine medizinische Beratung, Diagnose oder Therapie.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Zwecke und Rechtsgrundlagen</h2>
        <p>
          Die Verarbeitung erfolgt zur Bereitstellung von Account, Login, Stack-Verwaltung,
          eigenen Produkten und App-Sicherheit auf Grundlage von Art. 6 Abs. 1 lit. b
          DSGVO, soweit sie f&uuml;r die Nutzung des Dienstes erforderlich ist.
        </p>
        <p>
          Sicherheitslogs, Missbrauchserkennung und technische Stabilit&auml;t beruhen auf
          Art. 6 Abs. 1 lit. f DSGVO. Gesetzliche Aufbewahrungspflichten, soweit sie entstehen,
          beruhen auf Art. 6 Abs. 1 lit. c DSGVO.
        </p>
        <p>
          Gesundheitsbezogene Angaben und der Health Consent werden auf Grundlage deiner
          Einwilligung verarbeitet, soweit die Angaben einen besonderen Kategorienbezug im Sinne
          von Art. 9 DSGVO haben k&ouml;nnen, insbesondere Art. 9 Abs. 2 lit. a DSGVO.
          Analytics und der Zugriff auf nicht erforderliche Informationen im Endger&auml;t beruhen
          auf deiner Einwilligung, insbesondere Art. 6 Abs. 1 lit. a DSGVO und &sect; 25 TDDDG.
          Einwilligungen k&ouml;nnen mit Wirkung f&uuml;r die Zukunft widerrufen werden.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Hosting und technische Dienstleister</h2>
        <p>
          Die App l&auml;uft auf Cloudflare Pages und Cloudflare Functions. Daten werden f&uuml;r
          die App-Funktion in Cloudflare D1 und Cloudflare R2 verarbeitet. F&uuml;r Quellcode,
          Deployment und Backups wird GitHub beziehungsweise GitHub Actions genutzt.
        </p>
        <p>
          Diese Dienstleister k&ouml;nnen personenbezogene Daten als technische Dienstleister
          verarbeiten, soweit dies f&uuml;r Betrieb, Sicherheit, Deployment und Backup der App
          erforderlich ist.
        </p>
        <p>
          Bei Cloudflare, GitHub beziehungsweise GitHub Actions und Google Analytics k&ouml;nnen
          Verarbeitungen oder &Uuml;bermittlungen in Drittl&auml;nder, insbesondere die USA, nicht
          ausgeschlossen werden. Soweit erforderlich, werden nach M&ouml;glichkeit vertragliche
          oder gesetzliche Garantien wie Standardvertragsklauseln oder Angemessenheitsmechanismen
          genutzt.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Cookies, lokaler Speicher und Google Analytics</h2>
        <p>
          Supplement Stack nutzt einen Cookie- beziehungsweise Analytics-Banner. Deine Entscheidung
          wird im lokalen Speicher deines Browsers gespeichert, damit die Auswahl bei sp&auml;teren
          Besuchen ber&uuml;cksichtigt werden kann.
        </p>
        <p>
          Google Analytics 4 wird nur verwendet, wenn du aktiv zustimmst. Vor deiner Zustimmung
          wird das Google-Analytics-Skript nicht geladen und es werden keine Analytics-Events an
          Google gesendet. Bei Ablehnung bleibt Google Analytics deaktiviert.
        </p>
        <p>
          Nach Zustimmung k&ouml;nnen Seitenaufrufe innerhalb der App an Google Analytics
          &uuml;bermittelt werden. Dabei k&ouml;nnen technische Informationen wie aufgerufene URL,
          Zeitpunkt, Browser- und Ger&auml;teinformationen verarbeitet werden. Google gibt f&uuml;r
          Google Analytics 4 an, dass einzelne IP-Adressen nicht protokolliert oder gespeichert
          werden und IP-Adressen aus der EU vor der Protokollierung verworfen werden.
        </p>
        <p>
          Die Speicherung der Analytics-Daten richtet sich nach den Aufbewahrungseinstellungen
          der jeweiligen Google-Analytics-Property. Du kannst deine gespeicherte Entscheidung
          jederzeit &uuml;ber den Link
          <span className="font-bold"> Cookie-Einstellungen</span> im Footer &auml;ndern.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Speicherdauer</h2>
        <p>
          Account- und App-Daten werden grunds&auml;tzlich gespeichert, solange dein Account
          besteht oder die jeweilige App-Funktion genutzt wird. Wenn du deinen Account l&ouml;schst,
          werden deine zugeordneten App-Daten gel&ouml;scht, soweit keine gesetzlichen Pflichten
          entgegenstehen.
        </p>
        <p>
          Technische Logs werden nur so lange gespeichert, wie sie f&uuml;r Sicherheit,
          Fehleranalyse und Betrieb erforderlich sind. Gesetzliche Aufbewahrungsfristen bleiben
          vorbehalten.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Deine Rechte</h2>
        <p>
          Du hast nach Ma&szlig;gabe der DSGVO Rechte auf Auskunft, Berichtigung, L&ouml;schung,
          Einschr&auml;nkung der Verarbeitung, Daten&uuml;bertragbarkeit und Widerspruch. Soweit
          eine Verarbeitung auf Einwilligung beruht, kannst du diese Einwilligung jederzeit mit
          Wirkung f&uuml;r die Zukunft widerrufen.
        </p>
        <p>
          Du hast au&szlig;erdem das Recht, dich bei einer Datenschutzaufsichtsbeh&ouml;rde zu
          beschweren. F&uuml;r Anfragen erreichst du Nick Krakow unter{' '}
          <a className="font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">
            email@nickkrakow.de
          </a>
          . Eingeloggte Nutzer k&ouml;nnen Profil- und Account-Funktionen direkt in der App nutzen.
        </p>
      </section>
    </article>
  );
}
