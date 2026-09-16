# Release notes open meldingen in de brondekking

Datum: 16 september 2026

Versie: BiDash 2.11, DVM 80

## Opgelost

- De brondekkingstabel meldde nul open meldingen voor DRIP en de status `volledige
  bron, geen open storing`, terwijl Open storingen veertien open DRIP-storingen
  toonde. De tabel telt nu de open meldingen in de actuele bron.
- Staat er een verschil tussen wat er in de bron zit en wat is doorgerekend, dan
  wordt dat benoemd en levert het assettype geen exact percentage meer.
- Een uit de DRIP-historie afgeleide actuele melding krijgt weg, richting,
  hectometer en verkeerscentrale uit het assetregister voordat ze de doorrekening in
  gaat. Zonder locatie viel ze eerder uit de berekening.
- De kolom Beheerder in Open storingen toonde een getal in plaats van de beherende
  regiodienst.

## Waarom dit telde

De brondekkingstabel telde `STATE.meldingen`, het resultaat ná `doorrekenen()`. Die
functie laat een melding vallen zonder locatie (`zonderLocatie`) of zonder passende
foutregel (`zonderFoutregel`). De storingslijst bouwt haar beeld op een andere
route en vult de locatie wél aan uit het assetregister, dus daar waren dezelfde
meldingen gewoon zichtbaar.

Voor DRIP liepen die twee uit elkaar. `dripOpenRow()` nam alleen `x.weg` over uit
het historie-incident; draagt de historie geen weg, dan had de regel geen locatie en
verdween ze in `doorrekenen()`. De virtuele bron stond wel in
`LIVE_STORINGSBRONNEN`, dus de tabel toonde keurig de bronbestanden — met nul
meldingen erachter.

Het gevolg was erger dan een verkeerd getal. Wie op grond van `geen open storing`
het vinkje `Volledige actuele storingsbron voor dit areaal` zette, kreeg een exacte
dienstbeschikbaarheid waarin het DRIP-verlies op nul stond. De band die BiDash
elders gebruikt om onbekende dekking zichtbaar te houden, werd hier juist gesloten
op grond van een gat.

## Hoe het nu werkt

`v68BronRijenPerType()` classificeert de rijen van de actuele bronnen en telt per
assettype. `v68TypeStatus()` zet daar het doorgerekende aantal naast:

- `inBron` is wat de tabel toont in de kolom Open meldingen.
- `nietDoorgerekend` is het verschil. Is dat groter dan nul, dan staat het
  doorgerekende aantal eronder en noemt de status de reden.
- `besch` en `prestatie` blijven leeg wanneer er open meldingen zijn maar géén
  enkele is doorgerekend; zo'n type is onbekend en gaat als band de dienstverlening
  in. Een type met een deel doorgerekend rekent gewoon door met die meldingen. De
  precieze regel en de correctie daarop staan in de release notes
  `brondekking-doorrekening-herstel`.

`deriveOpenDripRows()` accepteert een optionele functie die per incident de plaats
uit het register oplevert. De patch in de engine geeft die mee en gebruikt daarvoor
dezelfde matcher als de storingslijst. Een incident dat zelf een locatie draagt,
houdt die; zonder resolver blijft het gedrag zoals het was.

Voor de beheerder gebruikt de storingslijst nu `rapportRdWaarde()`, dezelfde regel
als de rapportages: alleen een herkende regiodienst telt, anders wordt hij uit de
verkeerscentrale afgeleid, en anders blijft de waarde leeg.

## Ongewijzigd

- `doorrekenen()` zelf, inclusief de voorwaarden waaronder een melding afvalt.
- De impactregels, de wegingen en de rekenketen van asset naar dienstverlening.
- De scheiding tussen historische en actuele stromen, en de regel dat alleen een
  aantoonbaar open DRIP-incident als actueel wordt afgeleid.
- De storingslijst zelf; die toonde deze meldingen al.

## Controle

- `tests/brondekking-open-meldingen.test.js` toegevoegd, 10 tests, en
  `tests/storingslijst-beheerder.test.js`, 6 tests. Beide voeren de verzonden
  implementaties uit: `v68BronRijenPerType()` en `v68TypeStatus()` letterlijk uit
  `dvm-2.js`, `deriveOpenDripRows()` uit `drip-open-from-history.js`, en
  `regioDienst()` uit `dvm-faults-extension.js` met `rapportRdWaarde()` uit
  `dvm-1.js`.
- Tegen de oude code gedraaid falen 13 van de 16.
- Volledige Node-suite: 192 tests geslaagd. Browsersuite: `browser.cjs`,
  `planning-large.cjs` en `planning-formation.cjs` alle drie geslaagd.
- JavaScript-syntaxcontrole zoals de workflow die draait: geslaagd.

## Niet getest

- De doorrekening met de operationele bestanden waarin dit is opgemerkt. De controle
  gebruikt synthetische regels; er is geen operationele export gebruikt of
  toegevoegd.
- Of de veertien DRIP-storingen na deze wijziging ook werkelijk een impact krijgen.
  Met een locatie halen ze de eerste horde, maar `doorrekenen()` vraagt daarna nog
  een passende foutregel voor hun foutcode. Is die er niet, dan blijven ze staan als
  niet-doorgerekend — nu wel zichtbaar in de tabel in plaats van als nul. Dat is met
  de eigen bron te controleren: het aantal achter `doorgerekend` hoort dan gelijk te
  worden aan het bronaantal.
- Welke bronkolom de getallen in het veld `rd` leverde. De afleiding is nu
  onafhankelijk van die kolom, maar de oorzaak in het bronbestand is niet
  onderzocht.
