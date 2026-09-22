# Release notes — DVM 109: DRIP uit map schrijft incrementeel bij

Datum: 22 september 2026

## Opgelost

`DRIP uit map (CDMS)` verving onbedoeld de reeds geladen DRIP-totaalhistorie. Dat gebeurde doordat de maproute `pasDripBundelToe()` zonder toevoegmodus aanriep.

Vanaf DVM 109 geldt:
- een reeds geladen DRIP totaal blijft staan;
- de mapsnede wordt als aanvullende bron toegevoegd;
- dezelfde regio/periode opnieuw lezen ververst die mapsnede;
- exacte overlap wordt niet dubbel opgenomen;
- open DRIP-afleiding, koppeling en Monte Carlo worden daarna opnieuw opgebouwd over het gezamenlijke bronbeeld;
- alleen de knop **Bron vervangen** wist nog de bestaande DRIP-historie.

Een optioneel basisbestand in de mapdialoog wordt alleen gebruikt voor **Download bijgewerkte JSON** en niet om de actieve werkruimte te vervangen.

## Versie

- BiDash 2.22
- DVM 109
