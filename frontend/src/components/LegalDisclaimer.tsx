interface Props {
  variant: 'health' | 'affiliate';
}

export default function LegalDisclaimer({ variant }: Props) {
  if (variant === 'health') {
    return (
      <p className="text-xs text-gray-400 leading-relaxed">
        * Die hier angezeigten Inhalte sind allgemeine Orientierungsinformationen und ersetzen
        keine medizinische Beratung, Diagnose oder Behandlung. Nahrungserg&auml;nzungsmittel sind
        kein Ersatz f&uuml;r eine ausgewogene Ern&auml;hrung oder medizinische Betreuung.
        Bei gesundheitlichen Fragen oder Unsicherheiten konsultiere bitte medizinisches Fachpersonal.
      </p>
    );
  }
  return (
    <p className="text-xs text-gray-400 leading-relaxed">
      * Einige Produktlinks k&ouml;nnen Affiliate-Links sein. Wenn du dar&uuml;ber kaufst,
      erh&auml;lt der Betreiber ggf. eine Provision. Die Markierung ist im Interface klar sichtbar
      und Empfehlungen orientieren sich nicht am Provisionsmodell.
    </p>
  );
}
