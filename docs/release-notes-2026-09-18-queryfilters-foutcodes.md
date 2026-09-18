# Release notes, queryfilters en foutcodebeheer

BiDash 2.15, DVM 100. Datum 18 september 2026.

## Queryfilters in Assetmanagement

Assetregister en Open storingen hebben een querybouwer. Elke voorwaarde bestaat uit
een veld, operator en waarde. Vanaf de tweede regel kies je EN of OF. Voorwaarden
mogen verschillende kolommen gebruiken. De evaluatie volgt SQL-logica, waarbij EN
voorrang heeft op OF.

Tekstfilters ondersteunen bevat, bevat niet, gelijk aan, niet gelijk aan, begint met,
eindigt met, leeg en niet leeg. Numerieke velden ondersteunen ook groter dan,
kleiner dan, minimaal en maximaal.

Voorbeeld: `Assettype is gelijk aan MSI` EN `Weg bevat A12` EN
`Impactpercentage is groter dan 50`.

Het veld **Asset heeft foutcode** beoordeelt alle open meldingen op hetzelfde asset.
Daardoor geeft `Asset heeft foutcode is gelijk aan 1001` EN `Asset heeft foutcode is gelijk aan 1003`
alleen assets en storingen terug waarbij beide codes op hetzelfde asset voorkomen.

## Foutcodes maken en toewijzen

Impactregels heeft een derde tab **Foutcodes en toewijzing**. Je kunt daar een code,
tekstpatroon, assettype, ernst, beschikbaarheidsimpact, prestatie-impact en
onderbouwing vastleggen. Een zelfgemaakte code kan direct worden toegewezen aan
geselecteerde meldingen zonder passende foutregel.

Expliciete toewijzingen worden in de DVM-parameters bewaard en gaan mee in de
reguliere totaalexport. Alleen een code met hetzelfde assettype kan worden toegewezen.
Locatieconflicten blijven geblokkeerd tot de assetkoppeling is hersteld.
