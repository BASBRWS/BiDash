# Release notes, RIA4- en Windwaarschuwingfilter in assetregister

Datum: 15 september 2026

## Wijziging

Assetmanagement > Gezamenlijk assetregister krijgt twee extra vinkboxen:

- `Windwaarschuwing`;
- `RIA4`.

De vinkboxen gebruiken exact dezelfde speciale DRIP-classificatie die eerder voor Open storingen is toegevoegd. De classificatie komt dus uit de apart geladen referentielijsten voor Windwaarschuwing-DRIP’s en RIA4-DRIP’s.

## Filtergedrag

Zonder vinkbox blijft het volledige gezamenlijke assetregister zichtbaar. Met één vinkbox worden alleen de assets uit die speciale DRIP-groep getoond. Als beide vinkboxen actief zijn, geldt een OF-selectie: een asset wordt getoond wanneer deze bij Windwaarschuwing of RIA4 hoort.

Omdat de twee classificaties DVM-DRIP-groepen zijn, vallen BI-bedienassets buiten een actieve speciale selectie. De bestaande filters voor zoeken, verkeerscentrale, bron en `Alleen met open storing` blijven daarnaast gewoon werken.

Het KPI-aantal `Assets in register` blijft het totale geladen areaal tonen; de resultaatregel onder de tabel toont het aantal assets na toepassing van alle actieve filters.

## Rekenkundige impact

Deze wijziging is uitsluitend een presentatiefilter. De brondata, assetclassificatie, storingsberekening, dienstimpact, kosten en prognoses worden niet aangepast.
