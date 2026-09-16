# Release notes herkomst van de DRIP-classificatie

Datum: 16 september 2026

Versie: BiDash 2.11, DVM 80

## Opgelost

- Een referentielijst zonder herkende markerkolom past niet langer stilzwijgend de
  gekozen soort op alle regels toe. De aanname wordt benoemd, met het aantal regels
  waarop hij geldt.
- Kopteksten als `RIA-4 DRIP` en `Windwaarschuwing DRIP` gelden nu als markering.
  Eerder vielen die buiten de herkenning en werd zo'n bestand als aanname verwerkt.
- Windmeetkolommen zoals `Windrichting` en `Windsnelheid` gelden nadrukkelijk niet
  als markering.
- De bronkaart in Datasetbeheer toont bij elke geladen classificatielijst of de
  soort uit een kolom komt of is aangenomen.
- De herkomst gaat mee in de totaalexport en komt bij herstel weer terug.

## Waarom dit telde

`classifiedRows()` splitst een bestand op markerkolommen. Herkent het er geen, dan
krijgt elke regel de soort die met de uploadknop is gekozen. Dat is een redelijke
terugval voor de veelgebruikte lijst met één kolom DRIP-codes, maar er was geen
enkel verschil te zien tussen een bestand dat zichzelf classificeert en een bestand
waarvan de soort volledig uit de knop komt.

De kopherkenning werkte bovendien op vaste namen. `RIA-4 DRIP` stond daar niet
tussen, dus een gecombineerd bestand met die kop belandde ongesplitst onder één
soort. De gebruiker zag een geslaagde koppeling met een plausibel aantal assets, en
had geen aanleiding om te twijfelen.

Zo'n classificatie is geen detail: ze bepaalt welke open storingen in het RIA4- en
Windwaarschuwingbeeld meetellen.

## Hoe het nu werkt

`markerInfo()` herkent samengestelde kopteksten met een patroon in plaats van
alleen exacte namen, en houdt bij welke kolommen de soort bepaalden. Wind
*metingen* blijven er bewust buiten; `richting`, `snelheid`, `kracht`, `meting`,
`sensor` en `graden` sluiten een kolom uit.

`classifiedRows()` levert daarnaast `herkomst` (`markering` of `aanname`),
`markerKolommen` en `rijenBron`. Die velden worden opgeslagen bij de lijst, komen
terug in de melding na het laden, in `specialMeta()` op de bronkaart, en in
`exportState()` en `restoreDripSpecialLists()`.

## Ongewijzigd

- De terugval zelf. Een lijst met alleen DRIP-codes blijft werken zoals hij werkte;
  alleen is nu zichtbaar dat de soort van de knop komt.
- De koppeling aan assets en DRIP's, inclusief de locatiecontrole bij dubbele codes.
- Het actuele Open storingen-beeld en de doorrekening naar dienstverlening.

## Controle

- `tests/drip-markerherkomst.test.js` is toegevoegd, zes tests. Ze voeren de
  verzonden implementaties uit: `classifiedRows()`, `exportState()` en
  `restoreDripSpecialLists()` uit `dvm-special-drip-lists.js`, en `specialMeta()`
  letterlijk uit `dvm-source-manager.js`.
- Tegen de oude situatie gedraaid falen alle zes.
- Volledige Node-suite: 142 tests geslaagd. Browsersuite: `browser.cjs` en
  `planning-formation.cjs` geslaagd; `planning-large.cjs` liep de eerste keer in een
  time-out van 30 seconden en slaagde bij herhaling, zonder wijziging.
- JavaScript-syntaxcontrole zoals de workflow die draait: geslaagd.

## Niet getest

- Een operationele referentielijst. De controle gebruikt synthetische regels; er is
  geen operationele export gebruikt of toegevoegd.
- Kopteksten van bronnen buiten de patronen die hier zijn opgenomen. Een lijst met
  weer een andere schrijfwijze valt nog steeds onder de aanname, maar dat is nu
  zichtbaar in plaats van stil.
