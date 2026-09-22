# BiDash 2.22 en DVM 105, mapbronnen in totaalexport

Datum: 21 september 2026

## Oorzaak

De hoofdapp gebruikte voor een handmatige DVM- of integrale totaalexport dezelfde compacte DVM-snapshot als voor automatische opslag in IndexedDB. Die compacte snapshot laat zware signaalgeverrijen uit een map bewust weg. Daardoor kon een export er compleet uitzien, terwijl bijgewerkte open en historische storingen na herimport ontbraken.

## Opgelost

- Automatische lokale opslag blijft compact.
- Handmatige DVM-totaalexport vraagt expliciet `fullSources` op.
- De integrale BiDash-export gebruikt dezelfde volledige DVM-snapshot.
- Het Bronbeheermanifest gaat mee met de geselecteerde signaalgever- en DRIP-bronnen.
- De volledige export wijzigt de compacte lokaal opgeslagen werkruimte niet.
- De rondrittest controleert assetregister, open storingen, storingshistorie, DRIP-historie, U-routes, werkzaamheden, parameters, DRIP-selectie en Bronbeheerstatus.

## Betekenis

Na MTM- of CDMS-data uit een map te hebben bijgewerkt, kun je een handmatige totaalexport maken en die later opnieuw importeren zonder de bijgewerkte storingsdata kwijt te raken.
