# Release notes — filter actuele storingen

Datum: 14 september 2026

## Wat verandert

Na het laden van de actuele open-storingenmomentopname kan de gebruiker in DVM Datasetbeheer zelf bepalen welke meldingen meetellen in het actuele overzicht en de daarvan afgeleide dienstimpact en verkeerskosten.

Beschikbare filtergroepen zijn storingstype/foutregel, gevolg, noodmaatregel, assettype, oorzaak, prioriteit/ernst, verkeerscentrale, regionale dienst, district en weg. Lege waarden zijn als `(geen waarde)` afzonderlijk selecteerbaar.

## Belangrijk gegevenscontract

Het overzichtsfilter wijzigt nooit de geladen bronmomentopname. De volledige lijst blijft beschikbaar voor de vergelijking tussen opeenvolgende momentopnamen. Het automatisch afsluiten en historiseren van verdwenen MSI-storingen blijft daarom gebaseerd op de volledige oude en nieuwe lijst.

Historische storingsanalyse en prognosekalibratie worden niet door dit filter beïnvloed. Alleen `doorrekenen(...,{actueel:true})` ontvangt de gefilterde selectie.

## Standaard en opslag

Standaard telt alles mee. De configuratie bewaart expliciete uitsluitingen; waarden die in een latere momentopname voor het eerst voorkomen tellen daarom automatisch mee totdat de gebruiker ze uitsluit.

De configuratie staat onder `RULES.cfg.liveOverviewFilter` en reist mee wanneer de DVM-parameters in een totaalexport worden meegenomen.

## Zichtbaarheid

Het actuele DVM-overzicht toont of het filter actief is en hoeveel open bronregels meetellen. Vanuit die melding kan de gebruiker rechtstreeks naar de filterinstellingen.

De procesflow is vastgelegd in `docs/afbeeldingen/storingsfilter-flow.svg` en wordt via Help uit de Markdown-documentatie getoond.

## Techniek en tests

- `site/core/live-overview-filter.js` bevat de filterlogica en DVM-runtime-integratie.
- `site/core/signal-forecast.js` activeert zowel de bestaande snapshot-sync als het live-overzichtsfilter.
- De geheugenarme storingsimport bewaart extra kolomnamen voor storingstype, oorzaak, prioriteit/ernst en maatregel wanneer die in de bron aanwezig zijn.
- `tests/live-overview-filter.test.js` controleert standaardgedrag, uitsluitingen, lege waarden, nieuwe waarden, bronbehoud, scheiding van snapshotlogica en parameteropslag.
