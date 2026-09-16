# Release notes afgeleide hersteltijd als bovengrens

Datum: 16 september 2026

Versie: BiDash 2.10, DVM 79

## Opgelost

- Een hersteltijd die volgt uit een automatische afsluiting op de peildatum telt
  niet langer mee als gemeten duur.
- De herstelduurverdeling voor de Monte Carlo gebruikt alleen gemeten duren. Een
  afgeleide duur valt in de simulatiepool terug op de ingestelde MTTR, net als een
  melding zonder duur.
- De duurdekking per assettype en per asset telt alleen gemeten duren.
- Memo's tonen bij zo'n regel `afgeleid, bovengrens` achter de duur.

## Waarom dit telde

Verdwijnt een MSI-storing uit de nieuwe momentopname, dan sluit `closeHistoryRow()`
die af op de peildatum van die lijst en berekent de duur als peildatum min start.
Het werkelijke herstel lag ergens tussen de vorige en de nieuwe momentopname, dus
die duur is een bovengrens.

De herkomst werd al vastgelegd in `_afgeslotenDoorNieuweMomentopname`,
`_afsluitPeildatum` en `_afsluitBronBestand`, maar die velden werden nergens
gelezen. `normRij()` nam ze niet mee, waardoor de afgeleide duur ononderscheidbaar
in de duurstatistiek terechtkwam. Hoe langer de periode tussen twee momentopnamen,
hoe hoger de MTTR werd, zonder dat er iets aan de werkelijkheid was veranderd.

## Hoe het nu werkt

`normRij()` zet de herkomst om in twee velden op de melding: `duurAfgeleid` en
`duurBetrouwbaar`. De duurdekking (`duurN`), de globale en lokale duurankers in
`bouwLiveMcHistorie()` en de duurpool van de wegdeelsimulatie gebruiken alleen
betrouwbare duren.

Dit volgt het patroon dat de DRIP-historie al kent met `duurBetrouwbaar`, waar een
gecensureerde episode ook buiten de duurstatistiek blijft.

## Ongewijzigd

- De assetverliesuren binnen de rapportageperiode. Daar blijft de duur als
  bovengrens bruikbaar en wordt hij nog steeds op de periode begrensd. Deze
  wijziging raakt de actuele beschikbaarheidsberekening dus niet.
- Het afsluiten zelf, de ontdubbeling tegen de bestaande historie en de scheiding
  tussen historische en actuele stromen.
- De ingestelde MTTR en de overige verdelingskeuzes.

## Controle

- `tests/afgeleide-hersteltijd.test.js` is toegevoegd. De test voert de verzonden
  implementaties uit: `closeHistoryRow()` uit `live-snapshot.js` en `normRij()` plus
  `bouwLiveMcHistorie()` letterlijk uit `dvm-2.js`.
- De acceptatietest verschuift alleen de peildatum van de tweede momentopname, van
  100 naar 2.000 uur na de start, en controleert dat de duurankers identiek blijven.
  Een vierde test toont aan dat de verdeling wél verschuift wanneer de afgeleide
  duur zou meetellen; zonder die controle zou de derde test niets bewijzen.
- Tegen de oude situatie gedraaid faalt de acceptatietest, en met de markering in
  `normRij()` erbij weggehaald falen er twee.
- Volledige Node-suite: 136 tests geslaagd. Browsersuite: `browser.cjs`,
  `planning-large.cjs` en `planning-formation.cjs` alle drie geslaagd.
- JavaScript-syntaxcontrole zoals de workflow die draait: geslaagd.

## Niet getest

- Doorrekening met operationele brondata. De controle gebruikt een synthetische
  set; er is geen operationele export gebruikt of toegevoegd.
- Het effect op een reeks van meer dan twee opeenvolgende momentopnamen.
