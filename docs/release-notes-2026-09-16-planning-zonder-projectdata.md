# Release notes planningmodule zonder ingesloten projectdata

Datum: 16 september 2026

Versie: BiDash 2.10, DVM 79

## Opgelost

- De ingesloten Primavera-export is verwijderd: 21 kB met 21 swimlanes, 103
  activiteiten, 37 mijlpalen, 110 relaties, 22 benoemde objecten en openstellingen
  tot 2040.
- De portfolio-, bouwblok-, verkeerscentrale- en triggerlijsten zijn verwijderd,
  inclusief openstellingskwartalen, LTS-versies, go/no-go-status, contractvorm,
  supporteinddata en bezettingspercentages.
- De vaste fasedefinities met FTE-bezetting, de balk- en conflictdefinities, het
  casusmodel met twee projecten en het meerjarenmodel met regio's en tunnels zijn
  verwijderd.
- De dashboardopbouwers met vaste KPI-cijfers en bedragen in euro's zijn verwijderd.
- De triggertellers in de balk stonden als vast getal in de opmaak, zonder bron.
  Ze volgen nu uit wat er geladen is.
- De projectnamen in het filter bovenaan zijn verwijderd.

In totaal ging het om 209 regels met projectinformatie, verspreid over 61 plaatsen
in een bestand van 9.361 regels. Het bestand is nu 8.510 regels.

## Waarom dit telde

BiDash wordt publiek gepubliceerd op GitHub Pages. Alles wat in `planning.html`
staat, wordt daarmee gepubliceerd — ook wat geen enkel scherm toont. De gegevens
waren geen illustratie: het ging om werkelijke objecten, openstellingsdata,
besluit- en organisatiemijlpalen en een releaseschema.

Een aparte bevinding maakte dat erger: de meeste van deze blokken waren niet
bereikbaar in de applicatie. Na het openen van elk scherm en het aanklikken van elke
knop, link en tegel bestonden de elementen `p6Canvas`, `dash-content`, `ntab-op`,
`gantt*`, `fte-panel` en `shift-pill` geen van alle. De renderfuncties keerden dus
direct terug. De gegevens werden gepubliceerd zonder ooit getoond te worden, wat
betekent dat niemand ze bij gebruik van de applicatie kon opmerken.

Alleen het triggerpaneel was wél bereikbaar, vanaf een tegel in de balk die op elk
scherm staat.

## Hoe het nu werkt

De planningmodule begint leeg. De tijdlijn komt uit een Primavera P6 XML-export, via
het bestaande scherm **Planning importeren**. Daar staat nu ook een tweede knop voor
een triggerbestand in JSON.

`ipl_zetTriggers()` controleert per regel of `naam`, `oorzaak` en een geldige
`klasse` aanwezig zijn. Een onvolledige regel wordt overgeslagen en niet half
getoond; de melding na het laden noemt beide aantallen. Een bestand zonder bruikbare
regels geeft een foutmelding in plaats van een leeg paneel.

Zonder geladen bestand staan de tellers op nul en legt het triggerpaneel uit dat er
geen bron is, met een knop naar het importscherm.

Een sjabloon zonder echte gegevens staat in `docs/voorbeeld-triggers.json`; het
formaat staat in `docs/GEBRUIKERSHULP.md`.

## Wat dit niet oplost

**De gegevens staan nog in de git-historie.** Deze wijziging haalt ze uit de
gepubliceerde applicatie en uit de huidige broncode, maar elke eerdere commit bevat
ze nog en de repository is publiek. Wil je ze ook daar weg, dan is een herschrijving
van de historie nodig, met de bijbehorende gevolgen voor iedereen die de repository
heeft gekloond. Dat is een aparte beslissing en is hier niet gedaan.

Ook de eerder gepubliceerde GitHub Pages-versies kunnen nog in caches en archieven
staan.

## Ongewijzigd

- De import van een Primavera P6 XML-export, de tijdlijn, de WBS-structuur, de
  relaties en de formatiegrafieken.
- De koppeling met de schil via `planning-adapter.js` en het volledige scherm.
- De rekenketens van DVM en BI.

## Controle

- `tests/planning-geen-projectdata.test.js` toegevoegd, 10 tests: geen objectnamen
  in de code, lege P6-, portfolio-, dashboard-, casus- en meerjarenstructuren,
  geen bedragen of go/no-go-velden, tellers op nul, en de laadroute uitgevoerd zoals
  verzonden, inclusief overgeslagen onvolledige regels en een bestand zonder
  bruikbare regels.
- Tegen de oude code gedraaid falen 9 van de 10.
- Volledige Node-suite: 176 tests geslaagd. Browsersuite: `browser.cjs`,
  `planning-large.cjs` en `planning-formation.cjs` alle drie geslaagd.
- Het ingesloten script van `planning.html` is apart op syntax gecontroleerd; de
  workflow controleert alleen losse `.js`-bestanden.
- In Chromium gemeten: tellers op nul, lege staat in het triggerpaneel, en na het
  laden van een proefbestand met één geldige en één onvolledige regel: één trigger
  geladen, één overgeslagen, teller op één.

## Niet getest

- Een werkelijk triggerbestand. De controle gebruikt een sjabloon en synthetische
  regels; er is geen operationele export gebruikt of toegevoegd.
- De schermen die de verwijderde blokken gebruikten. Die waren vóór deze wijziging
  al niet bereikbaar; dat is gemeten, niet hersteld. Of ze terug moeten komen, en
  dan gevoed uit een geladen planning, is een openstaande keuze.
