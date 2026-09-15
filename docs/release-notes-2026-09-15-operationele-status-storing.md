# Release notes – operationele status uit actuele storing

Datum: 15 september 2026

## Aanleiding

In Assetmanagement bestonden feitelijk twee verschillende signalen naast elkaar: de bronstatus `Operationeel / Niet operationeel` en het wel of niet aanwezig zijn van een open storing. Daardoor kon een technisch volledig uitgevallen asset nog als `Operationeel` in het register staan. Dit was vooral zichtbaar bij MSI-foutcode `1003` en bij Windwaarschuwing-/RIA4-DRIP's waarvan een open DRIP-incident nog niet aan de juiste asset was gekoppeld.

## Gewijzigd

Er is een derde operationele toestand toegevoegd:

- `Operationeel`;
- `Niet operationeel door storing`;
- `Niet operationeel`.

Voor signaalgevers/MSI zet een actuele foutcode `1003` de asset op `Niet operationeel door storing`. De bestaande bronstatus `Niet operationeel` blijft een afzonderlijke toestand en heeft voorrang wanneer een asset al structureel buiten bedrijf staat.

Voor Windwaarschuwing- en RIA4-DRIP's wordt een aantoonbaar open DRIP-incident nu opnieuw gekoppeld aan het assetregister. De matcher gebruikt niet alleen een reeds aanwezige `assetKey`, maar herkent ook DRIP-codes in namen zoals `(dBD143)` en `(D80a)`. Bij codes die op meerdere locaties voorkomen worden VC, weg, richting en hectometer gebruikt om de juiste asset te kiezen. Een onbesliste gelijke match wordt niet automatisch gekoppeld.

## Bediening

In `Assetmanagement > Gezamenlijk assetregister` is een filter `Operationele status` beschikbaar. De bestaande filters voor open storing, Windwaarschuwing en RIA4 blijven hiermee combineren.

In `Assetmanagement > Open storingen` is dezelfde status als kolom en filter toegevoegd. De memo van de actuele selectie neemt de verdeling naar operationele status mee.

## Rekenregel

Deze wijziging verandert de bestaande dienstimpactberekening niet. De status is een presentatielaag boven de bronstatus en de actuele storingskoppeling:

- MSI + open fout `1003` → `Niet operationeel door storing`;
- speciale DRIP (Windwaarschuwing of RIA4) + gekoppelde open DRIP-storing → `Niet operationeel door storing`;
- bronstatus structureel `Niet operationeel` → `Niet operationeel`;
- anders → `Operationeel`.
