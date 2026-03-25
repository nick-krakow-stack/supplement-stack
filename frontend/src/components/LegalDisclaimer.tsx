interface Props {
  variant: 'health' | 'affiliate';
}

export default function LegalDisclaimer({ variant }: Props) {
  if (variant === 'health') {
    return (
      <p className="text-xs text-gray-400 leading-relaxed">
        * Die hier angezeigten Informationen dienen der allgemeinen Information und stellen keine medizinische Beratung dar. Nahrungsergänzungsmittel sind kein Ersatz für eine ausgewogene Ernährung und gesunde Lebensweise. Konsultiere bei gesundheitlichen Fragen einen Arzt.
      </p>
    );
  }
  return (
    <p className="text-xs text-gray-400 leading-relaxed">
      * Werbelinks: Als Partner erhalten wir eine Provision, wenn du über unsere Links einkaufst. Dies beeinflusst unsere Empfehlungen nicht.
    </p>
  );
}
