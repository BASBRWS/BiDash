# Release notes Help toont de laatste release notes bovenaan

Datum: 17 september 2026

Versie: BiDash 2.14

## Opgelost

- In de Help stonden de release notes alfabetisch op titel. Daardoor kwam bovenaan
  toevallig een note van 15 september te staan en leek dat de laatste, terwijl de
  nieuwste notes (16 en 17 september) verderop in de lijst stonden. De release notes
  staan nu op datum, nieuwste eerst.

## Waarom dit telde

`scripts/stage-docs.mjs` bundelt de Markdown uit `docs/` voor de Help-viewer. Alle
release notes kregen dezelfde sorteerprioriteit en werden daarna op titel gesorteerd.
De documentatiepagina's hebben een eigen vaste volgorde, maar de release notes hadden
geen datumvolgorde. Wie de Help opende om te zien wat er als laatste was gewijzigd,
zag de bovenste titel — en dat was een oudere note. Zo ontstond de indruk dat er sinds
15 september niets meer was bijgewerkt, terwijl de nieuwe notes er wel degelijk waren.

## Hoe het nu werkt

De sortering in `stage-docs.mjs` maakt onderscheid op categorie:

- De documentatiepagina's blijven vooraan staan in hun bestaande vaste volgorde
  (processflow, gebruikershulp, rekenvoorbeeld, systeemwerking, README, en de rest op
  titel).
- Daarna volgen de release notes, gesorteerd op de datum uit de bestandsnaam
  (`release-notes-JJJJ-MM-DD-...`), nieuwste eerst. Notes van dezelfde dag staan
  onderling op titel.

Een bestandsnaam zonder herkende datum sorteert achteraan, zodat een afwijkend
genoemde note de datumlijst niet verstoort.

## Ongewijzigd

- De inhoud van de release notes en de documentatie zelf.
- De Help-viewer (`site/help.js`) en de manier waarop de bundel wordt opgebouwd; alleen
  de volgorde in de bundel verandert.
- De documentatiesectie en haar volgorde.

## Controle

- `tests/help-page.test.js` uitgebreid met een test die controleert dat de release
  notes in de gegenereerde bundel aflopend op datum staan en dat de documentatie vóór
  de release notes blijft. Tegen de oude alfabetische sortering faalt die test.
- Schilversie 2.13 → 2.14, met de assertions in `tests/dvm-restore-policy.test.js`,
  `tests/drip-special-lists.test.js` en `tests/versiebalk.test.js`.
- Volledige Node-suite geslaagd (227 tests). JavaScript-syntaxcontrole geslaagd.
