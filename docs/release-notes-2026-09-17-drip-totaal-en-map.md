# Release notes DRIP-storingshistorie uit totaal-JSON of CDMS-map

Datum: 17 september 2026

Versie: BiDash 2.14, DVM 98

## Toegevoegd

- De DRIP-storingshistorie kan nu, net als de signaalgevers, op twee manieren
  worden geladen, elk met een eigen kaart in Datasetbeheer:
  - **DRIP totaal (JSON)**: één bestand met `datasets.drip` (DRIP-episodes en
    geclassificeerde storingen).
  - **DRIP uit map (CDMS)**: BiDash leest de ruwe DRIP-logs rechtstreeks onder
    `X:/cdms/<vc>/log/<jaar>/<maand>/<dag>`, reconstrueert de episodes en
    storingen en bewaart alleen wat nodig is.
- **Gerichte mapkeuze**: in Edge/Chrome gebruikt BiDash `showDirectoryPicker` en
  daalt het zelf alleen af in `cdms/<gekozen regio>/log/<gekozen periode>` — de rest
  van de X-schijf wordt tijdens het aflopen gesnoeid, dus je mag gewoon de X-schijf
  kiezen. Lukt die moderne mapkiezer niet, dan valt BiDash terug op de gewone
  mapinvoer; kies dan `X:\cdms` (niet heel X:).
- Voor het lezen opent een **configuratiedialoog**: kies één of meer
  **verkeerscentrales**, optioneel een **periode** (vanaf/tot) en optioneel een
  **basisbestand** (eerder DRIP-totaal JSON). Met een basisbestand blijven de
  niet-gekozen regio's ongewijzigd.
- **Voortgang, foutmeldingen en download**: tijdens het lezen verschijnt een
  voortgangsvenster met fase en percentage; na afloop biedt het een knop
  *Download bijgewerkte JSON* die het resultaat als lean DRIP-totaal-JSON opslaat
  (`datasets.drip`), direct bruikbaar als basisbestand bij een volgende maplezing.

## Verwijderd

- De losse **DRIP-storingshistorie-upload** (XLSX/CSV-incidentwerkmap) is als aparte
  bronkaart en uploadknop verwijderd en volledig vervangen door DRIP totaal en DRIP
  uit map. De in-app knoppen op de DRIP-tab verwijzen nu naar de twee nieuwe bronnen.

## Ongewijzigd

- De koppeling van de DRIP-historie aan het DRIP-areaal (eerst op CDMS-code, anders
  op weg/richting/hectometer), de afleiding van open DRIP-incidenten uit historie en
  de DRIP Monte Carlo blijven functioneel identiek: de nieuwe bronnen bouwen dezelfde
  `DRIP_HIST_STATE` en roepen dezelfde `herbouwDripHistorie()` aan.
- Het uit het assetregister afgeleide DRIP-areaal (`DRIP_STATE`) en de losse
  **Windwaarschuwing**- en **RIA4**-selectielijsten blijven bestaan.
- De handmatige totaalexport en de back-up/restore van de DRIP-historie blijven op
  het bestaande `dripHistorie`-onderdeel werken; een teruggezette back-up herstelt de
  koppeling automatisch.

## Hoe het werkt

`dripDatasetNaarBron()` (`dvm-3.js`) vertaalt `datasets.drip.storingen` en de open
`episodes` naar de incidentvorm die `DRIP_HIST_STATE` al kent. `pasDripBundelToe()`
zet die als enige bron, roept `herbouwDripHistorie()` aan en laat de bestaande
koppeling en open-DRIP-afleiding het werk doen. De map-poort in
`dvm-storingsbundelaar.js` (`sbDripEventsUitTekst()`, `sbBouwDripBundel()`,
`sgVolgendeCtxDrip()`) leest de tab-gescheiden CDMS-logregels (status URGENT/OK,
power UIT/AAN) en gebruikt dezelfde `sbClassificeer()` als MTM voor langdurige en
intermitterende storingen.

## Controle

- `tests/drip-totaal.test.js` toegevoegd (5 tests): CDMS-logparsing, episodes
  sluiten/openhouden, padvalidatie + regio-/periodefilter + maptraversal, de
  omzetting van `datasets.drip` naar incidenten met open-DRIP-herkenning via
  `drip-open-from-history.js`, en de basiscombinatie per regio.
- `tests/dvm-source-manager.test.js` bijgewerkt: de losse DRIP-historie-upload
  bestaat niet meer; DRIP totaal en DRIP uit map hebben een eigen uploadroute.
- DVM-versie 97 → 98, met de assertions in `tests/dvm-restore-policy.test.js`,
  `tests/drip-special-lists.test.js` en `tests/versiebalk.test.js`. Schilversie
  blijft 2.14.
- Volledige Node-suite geslaagd (253 tests). Browsersuites `browser.cjs` en
  `planning-formation.cjs` geslaagd. Een headless engine-controle bevestigt dat de
  nieuwe DRIP-functies in de DVM-engine beschikbaar zijn en `dripDatasetNaarBron`
  in de browser de juiste incidenten oplevert, zonder pagina-fouten.

## Niet getest

- Het inlezen van een echte X:-CDMS-map met duizenden bestanden in de browser. De
  controle gebruikt synthetische logs; er is geen operationele brondata gebruikt of
  toegevoegd.
