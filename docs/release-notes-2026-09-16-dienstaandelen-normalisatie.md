# Release notes dienstaandelen normaliseren bij het laden

Datum: 16 september 2026

Versie: BiDash 2.10, DVM 79

## Opgelost

- De dienstverlening toonde een band van 0,00 tot 0,00 procent zolang het scherm
  Impactregels nog niet was geopend en er ook geen parameters waren geïmporteerd.
- De subprocesaandelen worden nu genormaliseerd zodra de regels zijn geladen, dus
  vóór iedere doorrekening, in plaats van pas bij het renderen van het regelscherm.
- `v68Dienst()` telt een nog niet genormaliseerd aandeel als 1, gelijk aan
  `normaliseerSubprocesAandelen()` en `dienstWaardeUitSubprocessen()`. Een ontbrekend
  aandeel kan daardoor niet meer stil tot nul wegingen en een lege dienstwaarde leiden.

## Waarom dit telde

`v68Dienst()` woog met `Number(sp.gewicht)||0`. In een verse sessie is dat aandeel
leeg, waardoor alle wegingen nul werden: dekking 0, geen exacte waarde en een band
0,00–0,00 procent. Dat beeld verscheen zowel op het DVM-overzicht als in de
hub-samenvatting, die dezelfde `summary()` gebruikt.

De blootstelling was reëel: de aanbevolen laadvolgorde loopt via DVM-bronbeheer en
raakt het regelscherm niet. Een gebruiker die assetregister en open storingen laadde
en daarna naar Dienstimpact ging, zag nul procent dienstverlening terwijl de
onderliggende gegevens een heel ander beeld gaven.

## Ongewijzigd

- De rekenregel zelf. Met genormaliseerde aandelen leverde de keten al de juiste
  uitkomst; alleen het moment van normaliseren is verplaatst.
- Het gesloten-verdelingsgedrag bij het handmatig aanpassen van één aandeel.
- Afhankelijkheden binnen een subproces. Die tellen apart op tot 1 en worden door
  de normalisatie niet geraakt.
- Onbekende beschikbaarheid blijft een band zonder exacte waarde.

## Controle

- `tests/dienst-aandelen.test.js` is toegevoegd. De test laadt de echte
  engine-bestanden en controleert gedrag, niet de aanwezigheid van een regel broncode.
- De test is tegen de oude situatie gedraaid: zonder de normalisatie bij het laden
  faalt hij, en met daarbij de oude weging falen drie van de vijf gevallen.
- Volledige Node-suite: 132 tests geslaagd.
- Browsersuite: `tests/browser.cjs`, `tests/planning-large.cjs` en
  `tests/planning-formation.cjs` alle drie geslaagd.
- In de browser gecontroleerd dat een verse sessie zonder enig geopend scherm bij
  75 procent signaleringsbeschikbaarheid 86,25 procent voor Verkeersmanagement
  oplevert, gelijk aan de handberekening 100 − 0,55 × 25.

## Niet getest

- Doorrekening met operationele brondata. De controle is uitgevoerd met een
  synthetische set; er is geen operationele export gebruikt of toegevoegd.
