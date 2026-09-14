# Release notes, grote integrale JSON laden

Datum: 14 september 2026

## Aanleiding

De DVM-doorrekening was al versneld, maar een grote `BiDash-integraal` export kon bij het terugladen nog steeds vastlopen. De integrale export bevat naast DVM-data ook planning en BI-data. Daardoor staat tijdens de DVM-import al veel data in het browsergeheugen.

De onderzochte export bevat ongeveer 80 MiB JSON. Het DVM-deel is ongeveer 47,5 MiB en de planning ongeveer 32,6 MiB. Binnen DVM staan ruim 50.000 assets en ruim 58.000 historische storingsregels.

## Oorzaak

De DVM-adapter startte `HUB.import()` direct na het laden van het iframe. De performancepatches worden via een dynamische module geladen en blokkeren het iframe-load event niet. Daardoor kon de eerste integrale import al starten voordat de snelle combiregels en de snelle analysebeeldherbouw actief waren.

Daarnaast maakte de adapter eerst `structuredClone(bundle)` van het volledige DVM-deel. Voor een DVM-deel van tientallen megabytes betekende dit een extra volledige kopie vlak voordat dezelfde data ook nog naar JSON werd omgezet en opnieuw werd ingelezen door de oorspronkelijke DVM-importer.

## Wijziging

`site/engines/dvm-adapter.js` is nu een kleine startguard. De bestaande adapter staat ongewijzigd in `site/engines/dvm-adapter-original.js` en wordt parser-synchroon geladen.

Voor iedere integrale DVM-import doet de startguard twee dingen:

- wachten totdat zowel de geïndexeerde combiregels als de geoptimaliseerde analysebeeldherbouw actief zijn;
- alleen de overbodige `structuredClone` van exact het inkomende DVM-bundle overslaan.

Andere `structuredClone` aanroepen blijven de native browserfunctie gebruiken. De inhoudelijke DVM-import, regels, berekeningen, prognoses en exports blijven daardoor ongewijzigd.

## Diagnostiek

Na een geslaagde import staat `window.__BIDASH_LAST_HUB_IMPORT_PERF__` in het DVM-frame met de totale importduur en de status van beide performancepatches.

## Test

`tests/dvm-integral-import-guard.test.js` controleert dat de bestaande adapter behouden blijft, dat de import op beide performancepatches wacht en dat alleen de clone van het inkomende DVM-bundle wordt overgeslagen.
