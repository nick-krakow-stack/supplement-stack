export default function ImprintPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-600">Impressum</p>
      <h1 className="mb-6 text-3xl font-black text-slate-900">Impressum</h1>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Angaben nach &sect; 5 DDG</h2>
        <p>
          Nick Krakow
          <br />
          Einzelunternehmer
          <br />
          Brockesstr. 58
          <br />
          23554 L&uuml;beck
          <br />
          Deutschland
        </p>
        <p>
          E-Mail:{' '}
          <a className="font-bold text-blue-700 hover:underline" href="mailto:email@nickkrakow.de">
            email@nickkrakow.de
          </a>
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Umsatzsteuer</h2>
        <p>
          Kleinunternehmer gem&auml;&szlig; &sect; 19 UStG; Umsatzsteuer wird nicht
          ausgewiesen; eine USt-IdNr. ist nicht vorhanden.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Verantwortlich f&uuml;r Inhalte</h2>
        <p>
          Verantwortlich im Sinne des &sect; 18 Abs. 2 MStV:
          <br />
          Nick Krakow, Brockesstr. 58, 23554 L&uuml;beck
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Streitbeilegung</h2>
        <p>
          Ich bin weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-xl font-black text-slate-900">Affiliate-Hinweis</h2>
        <p>
          Supplement Stack kann Affiliate-Links zu Amazon und weiteren Partnern enthalten. Wenn
          du &uuml;ber solche Links einkaufst, kann der Betreiber eine Provision erhalten.
          Die Markierung erfolgt transparent im Produktbereich. Die Nutzung der App bleibt
          kostenlos.
        </p>
      </section>
    </article>
  );
}
