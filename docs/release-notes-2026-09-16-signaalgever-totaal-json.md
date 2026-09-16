# Release notes gecombineerde signaalgeverbron (JSON)

Datum: 16 september 2026

Versie: BiDash 2.14, DVM 84

## Toegevoegd

- Een nieuwe DVM-bron **Signaalgevers totaal (JSON)** in Datasetbeheer. Eén
  gecombineerd exportbestand (`datasets.mtm`) levert zowel de open alarmen als de
  historische storingen, als alternatief voor de losse Open storingen- en
  Storingshistorie-uploads.

## Waarom

De open storingen en de historie kwamen tot nu toe uit aparte bestanden. De
upstream-pijplijn levert ze inmiddels als één gestructureerd JSON-bestand
(`DRIP_MTM_totaal`, versie 2.0). Door dat bestand rechtstreeks te kunnen laden
vervalt het handmatig splitsen, terwijl de bestaande losse route blijft bestaan om
mee te vergelijken en later uit te faseren.

## Hoe het werkt

`signaalgeverTotaalBronnen()` in `dvm-3.js` zet het bestand om naar rijen die
`normRij()` al kent, zodat de bestaande koppeling en doorrekening ongewijzigd
blijven:

- **Open storingen**: `datasets.mtm.alarm_episodes` met `eindstatus:
  "open_aan_einde"` (en `meenemen !== false`). De omschrijving gaat mee als
  `melding`, zodat de bestaande MSI-foutregels (lampcircuit, OS-communicatie, fatale
  fout) blijven matchen.
- **Historie**: `datasets.mtm.storingen`. Deze records dragen geen omschrijving; met
  `signaalgever + impactklasse` als melding herkent `classificeer()` ze alsnog als
  MSI. De historie voedt zoals altijd alleen de prognose.

Alleen de signaalgevers (MTM) worden gelezen; een eventuele `datasets.drip`-sectie
wordt in deze stap genegeerd.

## Óf/óf, geen vermenging

De bron is bewust een óf/óf-keuze. Bij het laden van de JSON worden de losse Open
storingen- en Storingshistorie-bronnen geleegd en volledig door de JSON vervangen
(vervang-modus), zodat oud bestandsformaat nooit met de nieuwe JSON mengt. De oude
uploadknoppen blijven bestaan voor de bestaande werkwijze, zodat de nieuwe bron eerst
beproefd en de oude daarna uitgefaseerd kan worden.

## Ongewijzigd

- `normRij()`, `classificeer()`, `foutregel()`, de koppeling aan All Assets en de
  doorrekening zelf. De JSON levert alleen rijen aan; de rekenlogica verandert niet.
- De losse Open storingen- en Storingshistorie-uploads en hun gedrag.
- Er worden geen nieuwe impactregels verzonnen: een foutcode zonder passende
  MSI-foutregel blijft zichtbaar maar niet-doorgerekend, precies zoals bij de losse
  bestanden.

## Controle

- `tests/signaalgever-totaal.test.js` toegevoegd, 6 tests, die de verzonden
  omzetters uit `dvm-3.js` en `normRij()`/`classificeer()`/`foutregel()` uit
  `dvm-2.js` met de echte foutcodes uit `dvm-1.js` uitvoeren op een synthetische
  opzet met dezelfde structuur. Er is geen lokale brondata in de test of de commit
  opgenomen.
- DVM-versie 83 → 84, met de assertions in `tests/dvm-restore-policy.test.js`,
  `tests/drip-special-lists.test.js` en `tests/versiebalk.test.js`. De schilversie
  blijft 2.14.
- Volledige Node-suite geslaagd (233 tests). Browsersuites `browser.cjs`,
  `planning-formation.cjs` en `planning-large.cjs` geslaagd. JavaScript-syntaxcontrole
  geslaagd.

## Niet getest

- Het laden van het werkelijke, volledige exportbestand (18.514 open alarmen en
  58.421 storingen). De controle gebruikt een kleine synthetische opzet; de
  performance en de dekking van alle voorkomende foutcodes op de echte export zijn
  met de eigen bron te controleren.
