export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-600">Datenschutz</p>
      <h1 className="mb-6 text-3xl font-black text-slate-900">Datenschutzerklärung</h1>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <p>
          Diese Datenschutzerklärung informiert darüber, wie Supplement Stack personenbezogene Daten
          verarbeitet, wenn du die Website und die App nutzt.
        </p>
        <p>
          Verantwortlicher: Nick Krakow, Brockesstr. 58, 23554 Lübeck,
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
          Je nach Nutzung verarbeitet Supplement Stack Account-Daten wie E-Mail-Adresse, Login-Informationen
          und Passwort-Hash, optionale Profil- und Präferenzdaten wie Alter, Geschlecht und
          Empfehlungsquelle, Health-Consent-Status, gespeicherte Stacks und eigene Produktdaten sowie
          dazugehörige Dosierungs- und Eingabedaten.
        </p>
        <p>
          Zusätzliche E-Mail-Funktionen verarbeiten:
          <br />
          - E-Mail-Adresse und einmaligen Passwort-Reset-Link für „Passwort vergessen“
          <br />
          - Stack-Mail-Inhalte (Stackname, Produktdaten, Inhaltsangaben, Dosierungen, Kosteninformationen),
          wenn du „Stack mailen“ nutzt.
        </p>
        <p>
          Außerdem werden technische Sicherheits- und Serverlogdaten verarbeitet, etwa IP-Adresse, Zeitpunkt,
          angefragte URL, Statuscode, Browser- und Gerätedaten. Die Cookie- und Analytics-Entscheidung wird
          lokal in deinem Browser gespeichert.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Zwecke und Rechtsgrundlagen</h2>
        <p>
          Die Verarbeitung erfolgt zur Bereitstellung von Account, Login, Stack-Verwaltung, eigenen Produkten
          und App-Sicherheit auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, soweit sie für die Nutzung des
          Dienstes erforderlich ist.
        </p>
        <p>
          Sicherheitslogs, Missbrauchserkennung und technische Stabilität beruhen auf Art. 6 Abs. 1 lit. f DSGVO.
          Gesetzliche Aufbewahrungspflichten, soweit sie entstehen, beruhen auf Art. 6 Abs. 1 lit. c DSGVO.
        </p>
        <p>
          Gesundheitsbezogene Angaben und der Health Consent werden auf Grundlage deiner Einwilligung verarbeitet,
          soweit sie einen besonderen Kategorienbezug im Sinne von Art. 9 DSGVO haben können, insbesondere
          Art. 9 Abs. 2 lit. a DSGVO. E-Mail-Zwecke, Analytics- und nicht erforderliche Informationen im
          Endgerät beruhen auf deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO und § 25 TDDDG). Einwilligungen
          können mit Wirkung für die Zukunft widerrufen werden.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Hosting und technische Dienstleister</h2>
        <p>
          Die App läuft auf Cloudflare Pages und Cloudflare Functions. Daten werden für die App-Funktionalität
          in Cloudflare D1 verarbeitet. Cloudflare KV und Cloudflare R2 werden außerdem als technische
          Speicherorte genutzt (z. B. Missbrauchsschutz-Zähler und Produktbilder).
        </p>
        <p>
          Passwort-Reset-Mails und Stack-Mails werden über den konfigurierten SMTP-Dienst versendet. In der
          aktuellen Konfiguration erfolgt der Versand über All-Inkl/SMTP (Host: w020a88d.kasserver.com, Port 465).
        </p>
        <p>
          Für Quellcode, Deployment und D1-Backups wird GitHub und GitHub Actions verwendet. D1-Backups werden
          als Workflow-Artefakt erstellt und nach 30 Tagen automatisch gelöscht.
        </p>
        <p>
          Diese Dienste werden nur im Rahmen ihrer technischen Aufgabe als Auftragsverarbeiter eingesetzt.
        </p>
        <p>
          Bei Cloudflare, GitHub beziehungsweise Google Analytics können Verarbeitungen oder Übermittlungen in
          Drittländer, insbesondere die USA, nicht ausgeschlossen werden. Soweit erforderlich, werden
          vertragliche oder gesetzliche Garantien genutzt.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Cookies, lokaler Speicher und Google Analytics</h2>
        <p>
          Supplement Stack nutzt einen Cookie- beziehungsweise Analytics-Banner. Deine Entscheidung wird im
          lokalen Speicher deines Browsers gespeichert, damit die Auswahl bei späteren Besuchen berücksichtigt
          werden kann.
        </p>
        <p>
          Google Analytics 4 wird nur verwendet, wenn du aktiv zustimmst. Vor deiner Zustimmung wird das
          Google-Analytics-Skript nicht geladen und es werden keine Analytics-Events an Google gesendet.
        </p>
        <p>
          Nach Zustimmung können Seitenaufrufe innerhalb der App an Google Analytics (Google LLC / Google
          Ireland Limited) übermittelt werden. Dabei werden technische Informationen wie aufgerufene URL,
          Zeitpunkt, Browser- und Geräteinformationen verarbeitet.
        </p>
        <p>
          Google Signals ist nicht aktiviert. Ad-Storage, Ad-User-Data und Ad-Personalisierung werden per
          Consent-Konfiguration weiterhin als „denied“ geführt.
        </p>
        <p>
          Die Speicherung der Analytics-Daten richtet sich nach den Aufbewahrungseinstellungen der jeweiligen
          Google-Analytics-Property. Du kannst deine gespeicherte Entscheidung jederzeit über den Link
          <span className="font-bold"> Cookie-Einstellungen</span> im Footer ändern.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Speicherdauer</h2>
        <p>
          Account- und App-Daten werden grundsätzlich gespeichert, solange dein Account besteht oder die
          jeweilige App-Funktion genutzt wird. Wenn du deinen Account löschst, werden zugehörige App-Daten
          gelöscht, soweit keine gesetzlichen Pflichten entgegenstehen.
        </p>
        <p>
          Technische Logdaten und Cloudflare-KV-Daten (z. B. Rate-Limits, Sicherheitszähler) werden nur so
          lange gespeichert, wie sie für Sicherheit und Missbrauchsschutz erforderlich sind. Aufgrund der
          aktuellen TTL-Logik enden diese Datensätze typischerweise innerhalb kurzer Zeit bis zu ca.
          2 Stunden.
        </p>
        <p>
          Cloudflare R2 speichert Produktbilder in Verbindung mit Produkt- und Nutzerangaben. Diese Daten
          werden solange gehalten, wie die jeweiligen Datensätze aktiv sind oder bis eine Löschung erfolgt.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Deine Rechte</h2>
        <p>
          Du hast nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung, Löschung,
          Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Soweit eine Verarbeitung
          auf Einwilligung beruht, kannst du diese Einwilligung jederzeit mit Wirkung für die Zukunft
          widerrufen.
        </p>
        <p>
          Datenschutzaufsicht:
          <br />
          Unabhängige Landesstelle für Datenschutz Schleswig-Holstein (ULD Schleswig-Holstein), Holstenstraße 98,
          24103 Kiel,{' '}
          <a
            className="font-bold text-blue-700 hover:underline"
            href="https://www.datenschutzzentrum.de/"
            target="_blank"
            rel="noreferrer noopener"
          >
            https://www.datenschutzzentrum.de/
          </a>
          .
        </p>
        <p>
          Für individuelle Rechte kannst du dich außerdem an den Verantwortlichen wenden:
          {' '}
          <a className="font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">
            email@nickkrakow.de
          </a>
          . Eingeloggte Nutzer können Profil- und Account-Funktionen direkt in der App nutzen.
        </p>
      </section>
    </article>
  );
}
