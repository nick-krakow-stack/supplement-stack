interface Props {
  variant: 'health' | 'affiliate';
}

export default function LegalDisclaimer({ variant }: Props) {
  if (variant === 'health') {
    return (
      <details className="text-sm leading-relaxed text-slate-500">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-slate-600">
          Die Inhalte dienen nur der allgemeinen Orientierung und ersetzen keine medizinische Beratung. Warum dieser Hinweis?
        </summary>
        <p className="pb-1 pl-1">
          Nahrungserg&auml;nzungsmittel ersetzen weder eine ausgewogene Ern&auml;hrung noch eine Diagnose
          oder Behandlung. Bitte wende dich bei gesundheitlichen Fragen oder Unsicherheiten an
          medizinisches Fachpersonal.
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
