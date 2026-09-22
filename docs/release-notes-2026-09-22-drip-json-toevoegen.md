# Release notes — DVM 106: DRIP totaal complementair aanvullen

Datum: 22 september 2026

## Wijziging

De bronkaart **DRIP totaal (JSON)** heeft naast **Bron vervangen** nu een tweede actie: **Voeg JSON toe**.

**Bron vervangen** houdt het bestaande gedrag: de huidige DRIP-storingshistorie wordt vervangen door het gekozen `datasets.drip`-bestand.

**Voeg JSON toe** is complementair:
- bestaande DRIP-bronnen blijven aanwezig;
- het nieuwe JSON-bestand wordt als afzonderlijke bron toegevoegd;
- een bron met dezelfde bestandsnaam vervangt zijn eerdere variant;
- exact overlappende incidenten uit verschillende bronnen worden niet dubbel opgenomen;
- daarna worden koppeling aan All Assets, open-DRIP-afleiding en DRIP Monte Carlo opnieuw opgebouwd over het samengestelde bronbeeld.

Datasetbeheer toont het totale aantal incidenten en het aantal samengevoegde bronnen.

## Tests

De regressietests borgen dat de extra knop naar de toevoegmodus routeert en dat overlappende DRIP-incidenten bij complementair samenvoegen niet dubbel worden opgenomen.

## Versie

- BiDash 2.22
- DVM 106
