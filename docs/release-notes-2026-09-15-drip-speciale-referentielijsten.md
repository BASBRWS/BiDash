# Release notes, aparte DRIP-referentielijsten voor Windwaarschuwing en RIA4

Datum: 15 september 2026

## Aanleiding

Windwaarschuwing-DRIP’s en RIA4-DRIP’s worden inhoudelijk als aparte DRIP-groepen gebruikt. De bestanden die aangeven welke DRIP’s tot deze groepen behoren zijn classificatie-/referentielijsten en geen storingshistorie. Ze mogen daarom niet onder DRIP-storingshistorie worden ingelezen.

Tegelijk moet op Assetmanagement > Open storingen zichtbaar zijn of een open DRIP-storing bij Windwaarschuwing of RIA4 hoort, zodat beide groepen afzonderlijk gefilterd kunnen worden.

## Nieuwe bronnen in DVM-bronbeheer

DVM-bronbeheer bevat twee extra bron-specifieke uploadknoppen:

- `Windwaarschuwing DRIP’s laden`;
- `RIA4 DRIP’s laden`.

Beide bronnen vereisen dat Assetregister / All Assets eerst is geladen.

De referentielijsten mogen Excel-, ODS-, CSV- of TSV-bestanden zijn. Alle werkbladen worden bekeken. De lezer herkent onder andere kolommen voor entity-id, asset-id, DRIP-code, Dynac, CDMS, OS-id en naam.

## Koppeling

De identifiers uit de referentielijst worden gekoppeld aan bestaande DRIP-assets en het afgeleide DRIP-areaal. De bronbeheerkaart toont:

- het bronbestand;
- het aantal unieke referenties;
- het aantal gekoppelde assets;
- het aantal niet gekoppelde referenties.

Een nieuwe lijst vervangt alleen de eerdere lijst van dezelfde categorie. De classificatie overschrijft geen storingshistorie en introduceert geen nieuwe impactfactor.

## Open storingen

De publieke open-storingenlijst gebruikt de nieuwe kenmerken naast eventueel al aanwezige `windwaarschuwing`- en `ria4`-velden. Daardoor werken de twee bestaande selectie-vinkboxen ook wanneer de classificatie uit een aparte referentielijst komt.

Een open DRIP-storing uit DRIP-historie kan bovendien rechtstreeks op DRIP-code tegen de referentielijst worden herkend wanneer de assetkoppeling nog niet beschikbaar is.

## Opslag

De twee referentielijsten worden compact als identifiers opgeslagen onder `parameters.dripSpecialLists` in de DVM-export. Bij een uitgestelde zware DVM-restore worden deze lichte classificatiebronnen wel hersteld. Het grote storings- of assetdeel hoeft daarvoor niet via de generieke totaalimport te worden herbouwd.

## Versie

BiDash v2.9, DVM v78.
