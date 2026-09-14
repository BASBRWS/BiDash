# Release notes, grote historie uitgesteld tijdens live import

Datum: 14 september 2026

## Aanleiding

Het praktijkbestand `dvm-dienstimpact-totaal_2026-08-27.json` bevat ongeveer 41,6 MB data, 50.852 assetregels, 57.970 historische storingsregels en 130 actuele open storingen.

De actuele dashboardweergave heeft bij het openen alleen de open storingen nodig. De oude importketen koppelde tijdens dezelfde totaalimport echter ook alle historische storingen direct aan het volledige assetregister en bouwde daarna opnieuw het asset-matchbeeld. Dat blokkeerde de browser onnodig lang rond de laatste importfase.

## Wijziging

Bij een historische set vanaf 20.000 regels gebruikt de totaalimport nu een tweefasenaanpak.

1. Tijdens de initiële import wordt de historie licht geclassificeerd, zonder de dure assetkoppeling.
2. Het live dashboard verwerkt direct de actuele open storingen.
3. Het initiële asset-matchbeeld slaat de grote historische set over.
4. Zodra de historische prognose daadwerkelijk wordt geopend, wordt de volledige historiekoppeling alsnog uitgevoerd met dezelfde memo-cache voor herhaalde assetlocaties.

De historische bronregels worden niet verwijderd, ingekort of vervangen. Alleen het moment waarop de kostbare assetkoppeling plaatsvindt verandert.

## Centrale importoptimalisatie

De centrale `mergeImport` maakt niet langer een volledige diepe kopie van de complete werkruimte. Alleen de topstructuur en de daadwerkelijk te wijzigen domeinen worden gekopieerd.

Een JSON-object dat direct vóór `mergeImport` al volledig door de veiligheidsvalidatie is gelopen, wordt ook niet voor een tweede keer recursief door dezelfde validatie gestuurd.

## Diagnostiek

Na een totaalimport bevat `window.__BIDASH_LAST_REBUILD_PERF__` nu ook:

- `historyDeferred`, of de zware historiekoppeling is uitgesteld;
- `deferredHistoryRows`, het aantal uitgestelde historische regels;
- de bestaande timings van de overige importfasen.

Daarnaast bevat `window.__BIDASH_HISTORY_DEFERRED__` de status van een nog uitgestelde historische koppeling.

## Functionele scheiding

Deze wijziging houdt de afgesproken datastromen strikt uit elkaar.

- actuele open storingen voeden de live prestatie en het dashboard;
- historische storingen blijven prognosegegevens;
- de prognose kan de volledige historische koppeling later alsnog uitvoeren;
- het assetregister blijft de gemeenschappelijke koppelbasis.

## Test

De regressietest controleert met 25.000 synthetische historische regels dat de grote historie niet door de initiële volledige inspectie of matchbeeldpass gaat, terwijl de kleine live set wel direct wordt verwerkt. Daarna wordt gecontroleerd dat de historie bij het openen van de prognose alsnog volledig wordt geïnspecteerd.
