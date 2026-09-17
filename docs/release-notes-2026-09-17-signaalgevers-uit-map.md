# Release notes signaalgevers uit een map lezen

Datum: 17 september 2026

Versie: BiDash 2.14, DVM 95

## Toegevoegd

- BiDash kan de ruwe **MTM-storinglijsten** nu rechtstreeks uit een map lezen
  (`X:/mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>`), naast het gecombineerde
  JSON-bestand. In Datasetbeheer staat hiervoor een eigen kaart **Signaalgevers uit
  map (MTM)**. Het resultaat vult dezelfde bron als *Signaalgevers totaal* en vervangt
  de losse Open storingen en Storingshistorie.
- **Gerichte mapkeuze**: in Edge/Chrome gebruikt BiDash `showDirectoryPicker` en daalt
  het zelf alleen af in `mtm/<gekozen regio>/storinglijst/<gekozen periode>` — de rest
  van de (enorme) X-schijf wordt tijdens het aflopen gesnoeid, dus je mag gewoon de
  X-schijf kiezen. Lukt die moderne mapkiezer niet, dan valt BiDash terug op de gewone
  mapinvoer; kies dan `X:\mtm` (niet heel X:), want die leest de hele gekozen map in.
- Voor het lezen opent een **configuratiedialoog**: kies één of meer
  **verkeerscentrales**, optioneel een **periode** (vanaf/tot) en optioneel een
  **basisbestand** (eerder totaal-JSON). Zo wordt niet in één keer te veel gelezen en
  kun je per regio bijwerken; met een basisbestand blijven de niet-gekozen regio's
  ongewijzigd.
- **Inzicht in de laatste datum**: de dialoog toont wat er nu geladen is en tot welke
  datum (totaal en per regio), en bij een gekozen basisbestand de laatste datum per
  regio. Ook de bronkaart en de laadmelding tonen de laatste-entry-datum, zodat je
  ziet wat de volgende te lezen periode zou zijn.
- **Download bijgewerkte JSON**: na een maplezing biedt het voortgangsvenster een knop
  *Download bijgewerkte JSON* die het resultaat als lean totaal-JSON opslaat
  (`datasets.mtm` met open alarmen + storingen en `metadata.watermarks`). Dat bestand
  is direct bruikbaar als basisbestand bij een volgende maplezing.
- **Alle signaalgeverstoringen tellen als MSI**: `classificeer()` honoreert nu een
  expliciete typehint. De signaalgeverregels krijgen `assetTypeHint:'MSI'`, zodat een
  omschrijving met bijvoorbeeld "wisselbord" niet als los assettype wordt geclassificeerd
  dat niet in het register zit en anders de hele doorrekening zou blokkeren.
- **Datasetbeheer werkt meteen bij**: ook via de moderne mapkiezer (die niet door de
  bron-inputhandler loopt) worden na afloop de kaart *Signaalgevers totaal* en het
  overzicht ververst.
- **Voortgang en foutmeldingen**: tijdens het lezen verschijnt een voortgangsvenster
  vóór de gebruiker (het data-gereedheidspaneel staat bovenaan de pagina en valt in
  Datasetbeheer buiten beeld). Het toont fase en percentage (aantal geselecteerde
  bestanden, per-bestand voortgang, reconstructie, koppeling) en bij afloop de uitkomst
  met een Sluiten-knop. Klopt er iets niet — geen bestanden voor de gekozen
  regio/periode, een ongeldig basisbestand, of geen herkende MSI-meldingen — dan toont
  hetzelfde venster (en de laadmelding) expliciet wat er mis is.

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

`sbFilterBestanden()` beperkt de te lezen bestanden op de gekozen regio's en periode
(uit de bestandsnaam-context), zodat een grote map niet in één keer volledig wordt
verwerkt. `sbCombineerMetBasis()` vervangt in een meegegeven basis alleen de gekozen
regio's door de nieuw gelezen gegevens en houdt de overige regio's ongewijzigd.

## Prestatie: lichtere automatische opslag

BiDash bewaart de werkruimte automatisch lokaal (IndexedDB). Met de signaalgeverdata
(tienduizenden ruwe rijen) blokkeerde die serialisatie telkens de pagina ("wachten of
sluiten") en overschreed ze de opslaglimiet. De automatische opslag (`adapter.export`
met `autosaveLean`) laat de `_signaalgeverTotaal`-bronnen nu weg — die zijn per sessie
opnieuw in te lezen (map of JSON), of te bewaren met de downloadknop. De **analyse
blijft volledig werken** (in het geheugen) en de **handmatige totaalexport bevat de
signaalgeverdata gewoon**. Alleen de automatische lokale momentopname is lichter.

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

- De gerichte mapkeuze gebruikt `showDirectoryPicker` (Edge/Chrome, beveiligde
  context). Waar die niet beschikbaar is, geldt de `webkitdirectory`-terugval die de
  hele gekozen map inleest; kies dan `X:\mtm` en niet heel X:. De parsing zelf is
  browseronafhankelijk.
- Alleen MTM (signaalgevers) wordt uit de map gelezen; DRIP blijft via de eigen
  bronnen.

## Controle

- `tests/storingsbundelaar.test.js` toegevoegd, 9 tests, die de verzonden pure
  functies uit `dvm-storingsbundelaar.js` op synthetische storinglijsten uitvoeren
  (parseren, alarmruns sluiten/openhouden, classificeren, padvalidatie, regio-/
  periodefilter, basiscombinatie, watermerken) en de bundeluitvoer via de schema-
  tolerante mapping als MSI laten herkennen.
- DVM-versie 86 → 95, met de assertions in `tests/dvm-restore-policy.test.js`,
  `tests/drip-special-lists.test.js` en `tests/versiebalk.test.js`. Schilversie blijft
  2.14. De maplezer kreeg een eigen bronkaart met een gele (`primary`) knop; de eerste
  opzet gebruikte een tweede knop met de standaard `tb-btn`-stijl (witte tekst op een
  witte kaart), waardoor die onzichtbaar was.
- Volledige Node-suite geslaagd (247 tests). Browsersuites `browser.cjs` en
  `planning-formation.cjs` geslaagd. JavaScript-syntaxcontrole geslaagd.

## Niet getest

- Het inlezen van een echte X:-map met duizenden bestanden in de browser. De controle
  gebruikt synthetische storinglijsten; er is geen operationele brondata gebruikt of
  toegevoegd.
