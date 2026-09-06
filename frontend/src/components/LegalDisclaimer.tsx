interface Props {
  variant: 'health' | 'affiliate';
}

export default function LegalDisclaimer({ variant }: Props) {
  if (variant === 'health') {
    return (
      <details className="text-sm leading-relaxed text-slate-500">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-slate-600">
          Diese Inhalte dienen nur zur Orientierung und ersetzen keine medizinische Beratung.
        </summary>
        <p className="pb-1 pl-1">
          Bei Fragen sprich bitte mit ärztlichem oder pharmazeutischem Fachpersonal.
          Nahrungsergänzungsmittel ersetzen keine ausgewogene Ernährung.
        </p>
      </details>
    );
  }
  return (
    <p className="text-xs text-gray-400 leading-relaxed">
      * Einige Produktlinks k&ouml;nnen Affiliate-Links sein. Wenn du dar&uuml;ber kaufst,
      erh&auml;lt der Betreiber ggf. eine Provision. F&uuml;r dich entstehen dadurch keine
      zus&auml;tzlichen Kosten und die Produktreihung orientiert sich nicht am Provisionsmodell.
    </p>
  );
}
