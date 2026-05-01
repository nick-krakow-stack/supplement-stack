interface Props {
  variant: 'health' | 'affiliate';
}

export default function LegalDisclaimer({ variant }: Props) {
  if (variant === 'health') {
    return (
      <p className="text-xs text-gray-400 leading-relaxed">
        * Die hier angezeigten Informationen dienen der allgemeinen Information und stellen keine medizinische Beratung dar. Nahrungserg&auml;nzungsmittel sind kein Ersatz f&uuml;r eine ausgewogene Ern&auml;hrung und gesunde Lebensweise. Konsultiere bei gesundheitlichen Fragen einen Arzt.
      </p>
    );
  }
  return (
    <p className="text-xs text-gray-400 leading-relaxed">
      * Einige Links k&ouml;nnen Affiliate-Links sein. Wenn du dar&uuml;ber einkaufst, erhalten wir ggf. eine Provision. Unsere Empfehlungen bleiben davon unbeeinflusst.
    </p>
  );
}
