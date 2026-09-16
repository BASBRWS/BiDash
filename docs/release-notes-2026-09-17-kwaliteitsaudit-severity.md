# Release notes kwaliteitsaudit: severity volgt of de beveiliging werkte

Datum: 17 september 2026

Versie: BiDash 2.13, DVM 82

## Opgelost

- Een veilig geblokkeerd locatieconflict begrensde de totaalscore niet meer als
  volledige systeemblokkade. Het is nu een waarschuwing; blokkerend is pas een
  conflict dat tóch een koppeling of impact kreeg.
- Een geladen maar lege BI-werkruimte (nul assets, nul functies) wordt niet langer
  als goed beoordeeld, maar als waarschuwing.
- Het verschil tussen bronregels en verwerkte assets wordt benoemd zodra het groot
  is.
- Het verschil tussen bronregels en getoonde meldingen wordt uitgesplitst
  (doorgerekend, ontdubbeld, niet geclassificeerd, zonder foutregel, zonder locatie,
  zichtbaar maar niet doorgerekend) zodra de engine die telling meelevert.
- Duplicaten worden pas geteld bij gelijk event-ID en bronbestand naast asset, tijd,
  foutcode en locatie. Dezelfde plek en foutcode uit twee bronbestanden telt niet
  meer als vals duplicaat.

## Waarom dit telde

De audit begrensde de score tot 69 zodra er één blokkerende bevinding was. Drie
veilig geblokkeerde locatieconflicten — 0,6% van de open meldingen — telden als
`critical` en trokken zo het hele oordeel naar Niet op koers, terwijl de beveiliging
juist deed wat ze moest doen: BiDash weigerde de verdachte koppeling en rekende geen
impact. De severity volgde of een beveiliging werd aangesproken, niet of ze werkte
of faalde.

Daarnaast beoordeelde de audit een lege BI-werkruimte als goed (nul assets, nul
functies leverde toch een groene bevinding), en het verschil tussen bron- en
verwerkte aantallen bleef onverklaard.

## Hoe het nu werkt

`site/core/quality-audit.js`:

- Een locatieconflict dat veilig geblokkeerd is, is een waarschuwing. Een conflict
  dat tóch een `assetKey` of `impact` kreeg, is `critical` — dan heeft de blokkade
  gefaald.
- BI: `bi` aanwezig maar nul assets én nul functies levert een waarschuwing, niet
  goed. Los daarvan blijft een niet-geladen BI een neutrale melding.
- Een verschil tussen `rawAssetCount` en de verwerkte assets levert een `info`- of
  bij meer dan 5% een `warning`-bevinding met het aantal en percentage.
- `faultFingerprint()` neemt event-ID en bronbestand mee. Ontbreekt het event-ID,
  dan valt de vergelijking terug op asset, tijd, foutcode en locatie.
- Een nieuwe bevinding splitst de verwerking van de bronregels uit, gevoed door
  `STATE.stats` dat de DVM-summary nu meelevert.

`site/engines/dvm-adapter-original.js` levert `stats` en `nietDoorgerekend` mee in de
summary en zet `eventId` expliciet op elke fout, zodat de audit hierop kan
uitsplitsen en ontdubbelen.

De onbekende-impactregel uit de vorige release blijft ongewijzigd: een dienst die een
exact percentage toont terwijl meldingen niet zijn doorgerekend, is nog steeds
blokkerend, en een niet doorgerekende melding telt nooit stil als nul verlies.

## Niet opgelost

- De drie concrete locatieconflicten en de niet-doorgerekende meldingen in de
  operationele werkruimte zelf. Dat vraagt de integrale BiDash-export waarmee die
  audit is uitgevoerd; het meegeleverde DVM-bestand (130 bronregels) is een andere
  werkruimte dan die audit (703 bronregels). Zonder die export kan een concreet
  conflict niet inhoudelijk worden nagelopen.
- Ontbrekende foutregels voor de niet-doorgerekende meldingen. Die horen alleen te
  worden toegevoegd als de impact inhoudelijk kan worden onderbouwd.

## Controle

- `tests/quality-audit.test.js` uitgebreid van 5 naar 11 tests: veilig geblokkeerd
  conflict als waarschuwing zonder blokker, gelekt conflict als blokker, lege
  BI-werkruimte als waarschuwing, asset-verschil benoemd, duplicaat alleen op
  event-ID en bronbestand, en de bronregeluitsplitsing.
- Tegen de oude auditcode falen de zes nieuwe tests.
- Volledige Node-suite: 214 tests geslaagd. Browsersuite: `browser.cjs`,
  `planning-large.cjs` en `planning-formation.cjs` geslaagd. Syntaxcontrole geslaagd.
- In Chromium is de versiebalk gemeten: `BiDash 2.13 · DVM 82`.

## Niet getest

- De audit op de operationele werkruimte. De controle gebruikt synthetische
  scenario's; er is geen operationele export gebruikt of toegevoegd.
