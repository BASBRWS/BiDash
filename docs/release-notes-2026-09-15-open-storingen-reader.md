# Release notes, open storingen gericht uitlezen

Datum: 15 september 2026

## Aanleiding

De bron-specifieke knop voor Open storingen kon bij een XLSX blijven staan op `Bestand lezen`. De algemene storingslezer koos voor kleinere XLSX-bestanden eerst de route waarbij het volledige bestand met `file.arrayBuffer()` in het geheugen werd gezet en daarna door SheetJS werd geopend.

## Wijziging

Open-storingenbestanden met extensie `.xlsx` of `.xlsm` gebruiken voortaan direct de bestaande geheugenarme XLSX-lezer.

Die lezer:

- leest eerst alleen de ZIP-index;
- haalt alleen de benodigde werkmaponderdelen op;
- streamt het eerste werkblad;
- bewaart alleen kolommen die voor de storingsanalyse nodig zijn;
- vermijdt de volledige `file.arrayBuffer()`-route voor actuele momentopnamen.

CSV en oude `.xls`-bestanden blijven via de bestaande storingslezer lopen.

Als de gerichte XLSX-lezer niet bruikbaar is, wordt de Excel-worker als fallback geprobeerd. Die fallback heeft nu een limiet van 30 seconden, zodat de interface niet onbeperkt op één leesstap kan blijven staan.

## Versie

De zichtbare integratieversie wordt `v2.5` en de DVM-versie `v74`.

## Test

`tests/live-snapshot.test.js` controleert dat `.xlsx` en `.xlsm` naar de gerichte route gaan, `.xls` en `.csv` niet, dat de gerichte lezer werkelijk `xlsxEersteBladLicht` gebruikt en dat de worker-fallback een tijdlimiet heeft.
