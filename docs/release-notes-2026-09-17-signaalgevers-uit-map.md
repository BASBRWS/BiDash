# Release notes signaalgevers uit een map lezen

Datum: 17 september 2026

Versie: BiDash 2.14, DVM 87

## Toegevoegd

- BiDash kan de ruwe **MTM-storinglijsten** nu rechtstreeks uit een map lezen
  (`X:/mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>`), naast het gecombineerde
  JSON-bestand. De knop **Uit map lezen (MTM)** staat op de kaart *Signaalgevers
  totaal* in Datasetbeheer.

## Waarom

Het gecombineerde JSON-bestand bevat veel meer dan BiDash gebruikt (alle alarmruns,
episodes, dekking, de DRIP-sectie en diagnostiek). Daardoor werd de werkruimte te
groot om lokaal te bewaren. Door de bundelaar in BiDash te bouwen leest BiDash de
ruwe bestanden zelf en houdt het alleen wat het nodig heeft: de open alarmen en de
geclassificeerde storingen. De ruwe alarmruns en episodes blijven in het geheugen en
gaan niet de opslag in.

## Hoe het werkt

`dvm-storingsbundelaar.js` is een BiDash-poort van de lokale bundelaar-HTML (v2.5):

- `sbMtmRijenUitTekst()` leest per bestand de alarmregels (`|id|code|omschrijving|
  locatie|start|`), bepaalt weg/richting/hectometer, de code, de MSI-unit en de
  categorie (MSI/SYSTEEM/DETECTOR/OVERIG) met `meenemen`.
- `sbBouwBundel()` reconstrueert per verkeerscentrale de alarmruns over de
  opeenvolgende momentopnamen. Een betrouwbare snapshot-afstand (mediaan × 3, tussen
  90 en 360 minuten) bepaalt of een verdwenen alarm netjes sluit of dat een datagat
  de run splitst. Wat aan het einde nog aanstaat, is `open_aan_einde`.
- `sbClassificeer()` maakt de langdurige (≥ 4 uur) en intermitterende (≥ 3 episodes
  binnen 60 minuten) storingen.

Alleen de open alarmen en de storingen worden bewaard; het resultaat loopt door
dezelfde koppeling en doorrekening als de JSON-bron (`pasSignaalgeverBundelToe`).

## Schema-tolerantie

De `storingen`-tabel bestaat in twee schema's. De mapping leest nu beide: v2.0
(`signaalgever`, `foutcodes`, `impactklassen`, `incident_venster_uur`,
`laatste_bewezen_aanwezig`) én v2.5 (`asset`, `foutcode`, `impactklasse`,
`duur_min_uur`, `einde_bewezen`, met `omschrijving`). De omschrijving gaat mee als
`melding`, aangevuld met signaalgever/impactklasse, zodat `classificeer()` de rij als
MSI herkent. Eerder bleef de historie uit een v2.5-bestand onherkend, waardoor de
doorrekening leeg bleef.

## Ongewijzigd

- De JSON-bron *Signaalgevers totaal* en haar of/of-vervanggedrag.
- `normRij()`, `classificeer()`, `foutregel()`, de koppeling aan All Assets en de
  doorrekening zelf.
- Er worden geen impactregels verzonnen: een foutcode zonder passende MSI-foutregel
  blijft zichtbaar maar niet-doorgerekend.

## Beperkingen

- De mapkeuze gebruikt `webkitdirectory` en werkt in Chromium/Edge; de parsing zelf
  is browseronafhankelijk.
- Alleen MTM (signaalgevers) wordt uit de map gelezen; DRIP blijft via de eigen
  bronnen.

## Controle

- `tests/storingsbundelaar.test.js` toegevoegd, 5 tests, die de verzonden pure
  functies uit `dvm-storingsbundelaar.js` op synthetische storinglijsten uitvoeren
  (parseren, alarmruns sluiten/openhouden, classificeren, padvalidatie) en de
  bundeluitvoer via de schema-tolerante mapping als MSI laten herkennen.
- DVM-versie 86 → 87, met de assertions in `tests/dvm-restore-policy.test.js`,
  `tests/drip-special-lists.test.js` en `tests/versiebalk.test.js`. Schilversie blijft
  2.14.
- Volledige Node-suite geslaagd (240 tests). Browsersuites `browser.cjs` en
  `planning-formation.cjs` geslaagd. JavaScript-syntaxcontrole geslaagd.

## Niet getest

- Het inlezen van een echte X:-map met duizenden bestanden in de browser. De controle
  gebruikt synthetische storinglijsten; er is geen operationele brondata gebruikt of
  toegevoegd.
