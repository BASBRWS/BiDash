# Detectielussen uit de MTM-signaalgeverbron

Datum: 17 september 2026

Versie: BiDash 2.14, DVM 96

## Hersteld

De MTM-parser herkende detectoralarmen al, maar zette `meenemen` op `false`. Daardoor
verdwenen lusstoringen vóór de open-storingenlijst en vóór de dienstberekening. De
signaalgeveromzetter forceerde de resterende regels daarna naar MSI. Samen maakten
deze twee stappen een LUS-uitkomst onmogelijk.

Detector- en lusalarmen blijven nu in de open momentopname en historie. De categorie,
unit en omschrijving bepalen de typehint:

- detector, detectie, meetlus of lus wordt `LUS`;
- overige MTM-signaalgeverregels blijven `MSI`;
- een tekst over een wisselbord binnen een systeemalarm blijft MSI.

De bestaande LUS-regels zijn niet gewijzigd. Code 1006, 1007 en 5004 gebruiken hun
bestaande impact en voeden via `OBJ_BRON.detectie = 'LUS'` de detectieschakel van de
subprocessen en dienstverlening. Een andere detectorcode blijft zichtbaar als open
storing met "Passende foutregel ontbreekt". Er wordt geen impactwaarde afgeleid of
verzonnen.

## Compatibiliteit

Het JSON-schema en de selectieve export veranderen niet. Een bestaand bestand waarin
detectorregels al met `meenemen: false` zijn weggeschreven kan die regels niet
terughalen. Lees de MTM-map opnieuw in met DVM 96 om de detectiestoringen op te nemen.

## Controle

De regressietests gebruiken alleen synthetische regels en controleren:

- een detectorregel blijft `meenemen: true`;
- een open 1006-regel verschijnt in de open bron;
- de regel wordt `LUS` en krijgt 25 procent beschikbaarheidsimpact en 60 procent
  prestatie-impact uit de bestaande configuratie;
- LUS voedt de detectieschakel;
- een onbekende detectorcode blijft zichtbaar zonder verzonnen impact;
- MSI-regels en systeemalarmen blijven MSI.
