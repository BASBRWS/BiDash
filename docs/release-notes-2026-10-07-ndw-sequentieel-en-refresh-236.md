# Business Intelligence Dashboard WVM 2.36, DVM 120

Datum: 7 oktober 2026

## NDW v2.3 deelbronnen mogen na elkaar worden geladen

De browserbestandskiezer levert in de praktijk regelmatig maar één NDW-bestand aan. Daarom hoeft measurement_current/meetlocatieconfiguratie niet meer in dezelfde selectie als trafficspeed te staan.

Bij het eerste v2.3 bestand:
- de inhoud wordt herkend als configuratie of verkeersmeting;
- het bestand blijft tijdelijk in de DVM-runtime beschikbaar;
- bronbeheer toont welke helft is geladen en op welke helft nog wordt gewacht.

Bij het tweede bestand worden beide bronnen gecombineerd en gekoppeld via measurementSiteReference en meetindex.

## Oude NDW-data niet meer stilzwijgend actief na refresh

Een zware lokaal opgeslagen werkruimte herstelde parameters.kosten selectief. Daardoor werd ook een oude ndw69Snapshot automatisch actief. Dat verklaart waarom na een kale refresh direct de verkeersmeting van 8-9-2026 zichtbaar was.

Bij automatische opstartrestore wordt ndw69Snapshot nu niet meer in RULES.kosten geactiveerd. Ook oude automatische NDW-keuzes en automatisch overgenomen snelheden worden uit de actieve verkeersscenario's verwijderd.

De opgeslagen snapshot blijft wel in de lokaal opgeslagen werkruimte aanwezig. Via Gebruik uit werkruimte kan de gebruiker hem bewust opnieuw activeren.

Versies:
Dashboard 2.36.
DVM 120.
