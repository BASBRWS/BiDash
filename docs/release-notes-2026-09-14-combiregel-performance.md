# Release notes, combiregels bij grote totaalimport

Datum: 14 september 2026

## Aanleiding

De eerdere optimalisatie van de assetkoppelingen verkortte de fase `Koppelingen en analysebeeld herbouwen`, maar een grote DVM-totaalimport kon daarna nog steeds vastlopen rond 92 procent.

Bij controle met de aangeleverde totaalexport van ongeveer 41,6 MB bleek de historische storingsset ruim 58.000 regels te bevatten. In stap 5 van `doorrekenen()` werden voor iedere actieve combiregel alle meldingen met alle andere meldingen vergeleken. Dat is een kwadratische N x N-bewerking en kan bij deze omvang miljarden kandidaatvergelijkingen veroorzaken.

## Wijziging

`site/core/dvm-combi-performance.js` vervangt alleen de kandidaatselectie van stap 5 door een geïndexeerde variant.

De selectie beperkt eerst op:

- weg en richting;
- assettype en foutcode;
- hectometrering binnen `maxKm`;
- tijdvenster binnen `venMin`.

Pas daarna worden de bestaande combiregels op de overblijvende kandidaten toegepast. Kandidaten worden teruggezet in hun oorspronkelijke meldingsvolgorde, zodat de bestaande cap-, stapel- en trace-logica gelijk blijft.

De rest van `doorrekenen()` blijft ongewijzigd. De rekenuitkomst, caps, zwaartefactoren, combinatietrace, wegdeelaggregatie, dienstverlening en netwerkaggregatie gebruiken dus dezelfde logica als voor deze wijziging.

## Waarom dit het 92-procentprobleem raakt

De zware historische doorrekening wordt gestart nadat de totaalimport de datasets heeft opgebouwd. Daardoor kon de voortgang al rond 92 procent staan terwijl de browser nog in stap 5 van de historische analyse zat. De oude dubbele lus hield de hoofdthread daarbij langdurig bezet.

De nieuwe kandidaatindex verlaagt het aantal vergelijkingen van alle mogelijke meldingsparen naar alleen inhoudelijk relevante buren in ruimte en tijd.

## Diagnostiek

Na een doorrekening staat op het DVM-frame `window.__BIDASH_LAST_COMBI_PERF__` met:

- `messages`, aantal doorgerekende meldingen;
- `rules`, aantal actieve combiregels;
- `candidateChecks`, aantal kandidaten na indexselectie;
- `pairChecks`, aantal werkelijk passende combinaties;
- `hits`, aantal toegepaste combinaties;
- `durationMs`, rekentijd van alleen de combifase.

Deze diagnostiek bevat geen bronregels of operationele inhoud.

## Test

`tests/dvm-combi-performance.test.js` vergelijkt de nieuwe methode met de oude dubbele lus op meerdere deterministische datasets en eist exact dezelfde meldingsuitkomst en hetzelfde aantal hits. Een tweede test gebruikt 20.000 synthetische meldingen en controleert dat de kandidaatselectie ruim onder N x N blijft.
