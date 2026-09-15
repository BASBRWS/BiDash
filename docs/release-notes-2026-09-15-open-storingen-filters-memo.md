# Release notes, filters en memo voor open storingen

Datum: 15 september 2026

## Aanleiding

Assetmanagement > Open storingen combineert de actuele signaalgeverstoringen met aantoonbaar open DRIP-incidenten uit de geladen DRIP-storingshistorie. Voor operationeel gebruik ontbraken nog een assettypefilter, aparte selecties voor windwaarschuwing- en RIA4-DRIP's en een compacte memo van de actuele selectie.

## Wijziging

Het tabblad Open storingen krijgt aanvullend:

- een filter op assettype;
- een losse vinkbox `Alleen DRIP windwaarschuwing`;
- een losse vinkbox `Alleen DRIP RIA4`;
- bij gelijktijdig aanvinken van windwaarschuwing en RIA4 geldt een OF-selectie;
- een teller met zichtbaar aantal ten opzichte van alle open storingen;
- een knop `Memo huidige selectie`.

De storingenlijst toont nu tevens assettype, regionale beheerder en open duur. De DRIP-categorie wordt uit de reeds aanwezige DRIP-/assetkenmerken gehaald; er wordt geen nieuwe lijst met hardgecodeerde DRIP-namen geïntroduceerd.

## Memo

De memo volgt de filters die op het moment van genereren actief zijn. Hij bevat:

- aantal open storingen en verdeling per assettype;
- aantallen windwaarschuwing en RIA4 binnen de selectie;
- gemiddelde en langste bekende open duur;
- verdeling over verkeerscentrales en regionale diensten;
- per storing de naamduiding, assettype, locatie aan de weg, VC, regionale beheerder, duur en storingsduiding.

De memo kan worden gekopieerd en via de browser worden afgedrukt of als PDF opgeslagen.

## Datacontract

De publieke DVM-HUB verrijkt open storingen met `typeId`, `rd`, `district`, `start`, `einde`, `duurUren`, `wind` en `ria4`. Aantoonbaar open DRIP-incidenten uit de historische werkmap worden daarnaast via dezelfde `HUB.faults()` beschikbaar gemaakt. Voor DRIP wordt geen numerieke live-impact verzonnen wanneer daarvoor geen expliciete impactregel bestaat.

## Test

`tests/open-fault-view.test.js` controleert het assettypefilter, de twee speciale DRIP-selecties, duurweergave, memo-aggregaties en de aanwezigheid van de DVM-HUB- en UI-integratie.
