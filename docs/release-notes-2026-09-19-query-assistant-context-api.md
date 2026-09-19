# Release notes — BiDash 2.18: integrale Vraag BiDash-context

Datum: 19 september 2026

Versie: BiDash 2.18, DVM 102

## Doel

De lokale queryassistent kijkt niet langer alleen naar losse samenvattingstabellen. BiDash 2.18 introduceert een read-only Context API die bestaande DVM-, BI- en planninguitkomsten samenbrengt en de al geconfigureerde relaties expliciet bevraagbaar maakt.

## Nieuw

- Storing → assettype → subprocess → dienstverlening kan in één antwoord worden gevolgd.
- Dienstverlening → expliciet gekoppelde bedrijfsfunctie → actueel/benodigd FTE kan worden bevraagd.
- Dienstgekoppelde storingen kunnen worden verbonden met planningactiviteiten op dezelfde corridor.
- Dienstgekoppelde storingen kunnen worden verbonden met werkzaamheden via gekoppelde assets of dezelfde weg.
- Planningvragen ondersteunen activiteiten, mijlpalen, effectieve perioden, planningrelaties en actieve shifts.
- Capaciteitsvragen gebruiken de bestaande kwartaalvraag en capaciteitsgrenzen uit BI/planning.
- Werkzaamheden, U-routes, EOL en geladen historiebronnen zijn als querydomein beschikbaar.
- Vervolgvragen onthouden onder meer VC, weg, assettype, foutcode, jaar, kwartaal, DVM-dienst en planningsdienst.
- De chat kan melden welke databronnen in de huidige werkruimte wel en niet geladen zijn.

## Rekenkundige grens

De Context API is read-only. DVM blijft eigenaar van storingsimpact, subprocessen, dienstverlening, werkzaamheden/U-routes en verkeerskosten. BI blijft eigenaar van formatie en planningscapaciteit. De chat rekent deze waarden niet opnieuw uit.

Een gewogen verliesbijdrage in een chatantwoord wordt alleen gebruikt om dienstgekoppelde storingen te rangschikken. Zij is geen zelfstandig optelbaar dienstpercentage.

Een corridor-match tussen planning en storing toont samenloop en wordt niet als causaliteit gepresenteerd.

## Performancegrens

Historische bronstromen worden niet bij iedere chatvraag volledig gematerialiseerd. De chat toont in 2.18 welke historiebronnen zijn geladen en hun aantallen. Detailvragen over individuele historische incidenten worden later via dezelfde Context API aangesloten op de gescheiden datalaag.

## Privacy

Er is geen AI- of netwerkcall toegevoegd. De chat draait volledig lokaal en de bestaande Content Security Policy met `connect-src 'none'` blijft intact.

## Tests

Nieuwe regressietests controleren onder meer:
- storing → dienstverlening;
- planning ↔ storing via corridor;
- werkzaamheden ↔ storing via asset/weg;
- dienstverlening ↔ formatie via expliciete link;
- dienstverlening ↔ storing ↔ planning;
- dienstverlening ↔ storing ↔ werkzaamheden;
- planningselectie op weg/kwartaal;
- capaciteitsoverschrijding;
- planningafhankelijkheden;
- contextbehoud bij vervolgvragen.
