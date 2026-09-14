# Release notes — snellere koppelingen en analysebeeldherbouw

Datum: 14 september 2026

## Aanleiding

Bij een grote DVM-totaalimport kon de voortgang lang blijven staan op **Koppelingen en analysebeeld herbouwen**. Dat was geen probleem met het getoonde percentage: in deze fase werden dezelfde assetlocaties tijdens meerdere controle- en herbouwpassen opnieuw gekoppeld aan het landelijke assetregister.

## Wijziging

- Tijdens uitsluitend de herbouwfase van een DVM-totaalimport worden identieke assetkoppelingen tijdelijk gememoiseerd.
- De memo-key bevat de velden die de bestaande koppelregel gebruikt: asset-/logidentiteit, type, weg, richting, hectometer, strook en verkeerscentrale.
- Herhaalde storingen op dezelfde assetlocatie gebruiken daardoor hetzelfde reeds berekende koppelresultaat in plaats van opnieuw dezelfde kandidaatpool te sorteren.
- De tijdelijke cache wordt na de totaalimport volledig leeggemaakt en verandert dus geen blijvende regels of brondata.
- De DRIP-historiekoppeling slaat tijdens deze specifieke totaalimport de interne herbouw van het asset-matchbeeld over, omdat `totaalImportJson()` dat beeld direct daarna zelf al opnieuw opbouwt. Daarmee verdwijnt een dubbele volledige pass.

De uitkomst van de bestaande koppelregels is niet gewijzigd. Alleen dubbel rekenwerk binnen dezelfde importfase wordt vermeden.

## Diagnostiek

Na een totaalimport staat op het DVM-frame tijdelijk `window.__BIDASH_LAST_REBUILD_PERF__` met aantallen cache-hits, cache-misses en unieke cache-items. Dit bevat geen bronregels of operationele inhoud en is alleen bedoeld om de prestatiewinst te kunnen controleren.

De Permissions-Policy- en iframe-sandboxwaarschuwingen die Edge in de console kan tonen zijn browserwaarschuwingen en geen foutmelding uit deze koppelberekening.

## Test

`tests/import-rebuild-performance.test.js` controleert dat identieke koppelingen tijdens de herbouw maar één keer worden berekend, dat relevante locatievelden de cache-key onderscheiden, dat de cache buiten de herbouwfase niet wordt gebruikt en dat de dubbele DRIP-matchbeeldopbouw wordt overgeslagen.
