# Lus naar detectie in dienstverlening

Datum: 18 september 2026

Versie: BiDash 2.15, DVM 101

## Probleem

De bron en het assetregister gebruiken verschillende namen voor dezelfde functie,
zoals lus, detectie, detector, detectielus, meetlus en inductielus. Niet iedere
schrijfwijze kwam via hetzelfde assettype bij de detectieschakel van de
dienstverlening terecht. Een bekende foutcode kon daarnaast buiten de doorrekening
vallen wanneer de omschrijving anders was geschreven dan het patroon in de regel.

## Gewijzigd

- Alle genoemde bronvarianten worden genormaliseerd naar de technische sleutel
  `LUS`.
- In de bediening wordt `LUS` als Detectielus getoond.
- All Assets herkent ook Inductielus en detectorfamilies als detectielus. Een
  specifiek bouwdeel of type gaat voor op een bredere CI-familie.
- `LUS` voedt via `OBJ_BRON` de schakel detectie binnen subprocessen en
  dienstverlening.
- Bekende foutcodes 1006, 1007 en 5004 worden eerst op hun code gekoppeld en daarna
  pas op omschrijving.
- De MTM-mapuitvoer gebruikt de duidelijke categorie Detectielus en impactklasse
  Detectie.

## Veiligheidsregel

Een onbekende detectorcode blijft zichtbaar als open storing, maar krijgt geen
impact totdat een inhoudelijk onderbouwde foutregel is toegevoegd. BiDash verzint
geen impactpercentage.

## Controle

`tests/detectielus-keten.test.js`, `tests/storingsbundelaar.test.js` en
`tests/signaalgever-totaal.test.js` controleren de aliassen, het assetregister, de
MTM-parser, bekende en onbekende foutcodes, de zichtbare naam Detectielus en de
koppeling aan detectie binnen dienstverlening.
