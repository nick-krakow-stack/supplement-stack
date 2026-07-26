# Stage-3-Stilreferenzen v2

Version: `2.0.0`
Status: `approved`
Zweck: lokale, reproduzierbare Kalibrierung für Lesbarkeit und Lernlogik.

## Referenzen

| Referenz | Slug | Eingefrorener lokaler Snapshot | Stärke |
|---|---|---|---|
| Magnesium | `magnesium` | `style-snapshots/v2/magnesium.md` | Kernaussage zuerst, kurze Erklärsätze, ruhige Übergänge, klare Trennung von Ernährung, Referenzwert und Supplement-Sicherheit |
| Vitamin A | `vitamin-a` | `style-snapshots/v2/vitamin-a.md` | anschauliche Stoffgruppen-Erklärung, merkbare Lernlogik, verständliche Formen- und Sicherheitsunterscheidung |

Die SHA-256-Werte stehen in
[`stage3-style-snapshots.v1.json`](stage3-style-snapshots.v1.json). Eine
inhaltliche Änderung benötigt eine neue Snapshot-Version statt stiller
Überschreibung. Die unveränderlichen Kopien liegen bewusst im versionierbaren
Frameworkpfad, nicht in transienten Research-Artefakten.

## Gemeinsame Stilannotation

- Ein fachfremder Leser versteht im Einstieg, was der Stoff ist und warum er im
  Körper- oder Supplement-Kontext relevant ist.
- Jede größere Sektion beginnt mit einer einfachen Kernaussage; Details folgen.
- Fachbegriffe werden unmittelbar erklärt, nicht in Klammerketten gestapelt.
- Zahlen erhalten Vergleich, Bezugsrahmen und Bedeutung.
- Tabellen, Listen und Karten lösen eine konkrete Verständnisaufgabe.
- Der Ton bleibt ruhig, präzise und anschaulich – ohne Gutachtenstil, Werbung
  oder künstliche Schulbuchfloskeln.

## Klare Abgrenzung

Diese Referenzen liefern **keine** Fakten für andere Stoffe und schreiben weder
Markdown-Skelett noch Abschnittsfolge vor. Der technische Vertrag ist
[`03_framework_hauptartikel.md`](03_framework_hauptartikel.md); der konkrete
Aufbau kommt aus Blueprint und Facts-Paket. Writer und Publication-Reviewer
öffnen die Vollsnapshots nur, wenn die kurze Annotation für eine Stilentscheidung
nicht ausreicht.
