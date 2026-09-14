# Release notes — snellere koppelingen en analysebeeldherbouw

Datum: 14 september 2026

## Aanleiding

Bij een grote DVM-totaalimport kon de voortgang lang blijven staan op **Koppelingen en analysebeeld herbouwen**. In deze fase werden meerdere zware controle- en herbouwpassen achter elkaar op de hoofdthread uitgevoerd.

De eerste optimalisatie voorkwam herhaalde assetmatches en een dubbele DRIP-matchbeeldpass. Bij het grote praktijkbestand bleek daarna nog dubbel rekenwerk over te blijven.

## Wijziging

- Tijdens uitsluitend de herbouwfase van een DVM-totaalimport worden identieke assetkoppelingen tijdelijk gememoiseerd.
- De memo-key bevat de velden die de bestaande koppelregel gebruikt: asset-/logidentiteit, type, weg, richting, hectometer, strook en verkeerscentrale.
- Herhaalde storingen op dezelfde assetlocatie gebruiken daardoor hetzelfde reeds berekende koppelresultaat in plaats van opnieuw dezelfde kandidaatpool te sorteren.
- De tijdelijke cache wordt na de totaalimport volledig leeggemaakt en verandert geen blijvende regels of brondata.
- De DRIP-historiekoppeling slaat tijdens deze specifieke totaalimport de interne herbouw van het asset-matchbeeld over, omdat `totaalImportJson()` dat beeld direct daarna zelf opnieuw opbouwt.
- Wanneer het assetregister eerder in dezelfde totaalimport al met de ingelezen parameters en EOL-bron is opgebouwd, wordt de identieke dekkingsberekening in de 92%-fase niet nogmaals uitgevoerd.
- Wanneer de historische storingsinspectie nul herkenbare DVM-storingen oplevert, wordt diezelfde historische bron niet nogmaals door de asset-matchbeeldpass gehaald. De brondata blijft wel volledig geladen.
- Een herhaalde voortgangsmelding voor dezelfde herbouwfase wist de tijdelijke matchcache niet meer opnieuw.
- De zware afronding toont nu aparte fasen van 93 tot en met 98 procent. Daardoor is direct zichtbaar of tijd wordt besteed aan registerdekking, historie-inspectie, live-inspectie, DRIP-koppeling, assetmatches of schermopbouw.

De uitkomst van de bestaande koppelregels is niet gewijzigd. De aanpassing verwijdert alleen aantoonbaar dubbel werk.

## Diagnostiek

Na een totaalimport staat op het DVM-frame `window.__BIDASH_LAST_REBUILD_PERF__`. Dit bevat:

- cache-hits, cache-misses en unieke cache-items;
- het aantal overgeslagen dubbele registerdekkingspassen;
- of een inhoudelijk lege historische matchpass is overgeslagen;
- gemeten doorlooptijd per zware afrondingsstap.

Dit object bevat geen bronregels of operationele inhoud.

De Permissions-Policy- en iframe-sandboxwaarschuwingen die Edge in de console kan tonen zijn browserwaarschuwingen en geen foutmelding uit deze koppelberekening.

## Test

`tests/import-rebuild-performance.test.js` controleert de cache, de DRIP-optimalisatie, herhaalde 92%-meldingen, het hergebruik van de al opgebouwde registerdekking en het overslaan van een tweede historische matchpass wanneer de inspectie nul herkenbare regels bevat.
