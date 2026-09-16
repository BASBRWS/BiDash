# Release notes bewaakte runtime-patches en een zichtbare versie

Datum: 16 september 2026

Versie: BiDash 2.11, DVM 80

## Opgelost

- Elke runtime-patch heeft nu een test die controleert dát hij installeert en zijn
  vlag in de meegegeven scope zet. Dat waren er veertien.
- De koppeling in `signal-forecast.js` wordt tegen die registratie gespiegeld. Een
  weggevallen aanroep valt op, en een nieuwe patch zonder regel in de registratie
  laat de suite falen.
- De kopbalk toont de versie meteen bij het openen, ook voordat er een module is
  geladen. Engineversies komen erachter zodra de module zich meldt.
- De voet van de navigatie toonde `Integratie 2.3` terwijl de applicatie 2.10 was.
  Dat nummer stond hardgecodeerd in `index.html` en werd alleen overschreven nadat
  de DVM-module was geladen.

## Waarom dit telde

BiDash draait drie legacy-engines ongewijzigd in een iframe en hangt zijn
verbeteringen er als runtime-patch omheen. Installeert zo'n patch niet, dan valt de
applicatie stil terug op het oude gedrag: geen foutmelding, geen zichtbaar verschil,
wel andere uitkomsten.

De Node-suite bevestigde tot nu toe juist het omgekeerde. `tests/live-filter.test.js`
controleerde dat `installDvmLiveFilterPatch(globalThis)` `false` teruggeeft, omdat
Node geen `document` heeft. Die uitkomst is correct, maar het was de enige
gecontroleerde uitkomst: er stond nergens een test die vaststelt dat de patch in een
echte scope wél landt.

Het versienummer hing daarmee samen. Het stond op twee plekken — als letterlijke
tekst in `dvm-source-manager.js` en, verouderd, in `index.html` — en werd pas
zichtbaar wanneer de DVM-module vanuit het iframe in het document van de schil
schreef. Wie een verschil in uitkomsten wilde melden, kon de versie niet noemen
zonder eerst een module te openen.

## Hoe het nu werkt

`tests/runtime-patches.test.js` houdt een registratie van alle veertien patches: het
bestand, de exportnaam, de vlag, de koppeling en de scope waarin hij kan
installeren. Per patch draait één test die in een eigen realm installeert en de vlag
controleert. Drie tests bewaken de registratie zelf: de koppeling in
`signal-forecast.js`, de bewust geparkeerde patches met hun reden, en het feit dat
er geen `export function install…` in `site/core/` bestaat zonder regel in de
registratie.

De antwoorden op een herhaalde installatie verschillen per patch: twaalf melden
`true` omdat er al iets staat, `installDvmAnalysisRebuildPerformance` en
`installLoadProgress` melden `false` omdat er niets meer te doen was. Die keuze is
per patch vastgelegd zoals de patch hem maakt, zodat een stille wijziging opvalt.

`site/core/versie.js` is de enige plek met het versienummer van de schil.
`site/app.js` toont het bij het starten. Een module meldt haar eigen versie met
`postMessage({type:'hub:version',engine,versie})` en schrijft niet langer in het
document van de schil.

## Ongewijzigd

- De patches zelf. Er is geen patch gekoppeld, ontkoppeld of aangepast; de
  registratie legt de bestaande situatie vast, inclusief de drie filtermodules die
  bewust geparkeerd staan.
- De rekenketens; deze wijziging raakt geen enkele uitkomst.

## Controle

- `tests/runtime-patches.test.js` toegevoegd, 18 tests. `tests/versiebalk.test.js`
  toegevoegd, 6 tests.
- Drie regressies nagebootst en alle drie gevangen: een weggehaalde aanroep in
  `signal-forecast.js`, een hernoemde vlag in een patch, en een nieuwe
  `install…`-export zonder registratie. Alle drie leverden precies één falende test
  en zijn daarna teruggedraaid.
- Volledige Node-suite: 166 tests geslaagd. Browsersuite: `browser.cjs`,
  `planning-large.cjs` en `planning-formation.cjs` alle drie geslaagd.
- JavaScript-syntaxcontrole zoals de workflow die draait: geslaagd.
- De balk is in Chromium gemeten, toen nog op het oude nummer: bij het openen
  `BiDash 2.10` en na het openen van Dienstverlening `BiDash 2.10 · DVM 79`, met
  `Integratie 2.10` in de voet. Met deze release staan die op 2.11 en 80.

## Niet getest

- BI en planning melden geen versie. Die route is alleen met DVM gemeten; voor de
  andere twee is alleen vastgelegd dat een lege melding niets aan de balk toevoegt.
- De keuze uit punt 3 van de audit, over de richting van het storingsfilter. Deze
  wijziging legt de huidige tussenstand vast, maar beslist hem niet.
