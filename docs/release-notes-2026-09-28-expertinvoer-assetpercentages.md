# BiDash 2.28, assetpercentages in expertinvoer

Datum: 28 september 2026  
DVM-engine: 112, ongewijzigd

## Wat is aangepast

- Onder ieder subproces toont BiDash de beschikbare DVM-assettypen.
- Bij ieder gekozen assettype staat een invoerveld voor het
  afhankelijkheidspercentage.
- Bestaande gewichten uit het actieve DVM-model worden als percentages geladen.
- Een nieuw gekozen assettype start op 100% en kan direct worden aangepast.
- Ieder veld heeft uitleg over het doel en het effect in de berekening.

## Rekenregel

Alleen de aandelen van de subprocessen moeten samen 100% zijn. De percentages van
de assetafhankelijkheden zijn relatieve gewichten binnen één subproces en hoeven
samen geen 100% te vormen. Bij proefberekenen en toepassen normaliseert DVM de
positieve waarden. Daardoor betekenen 70% Detectie en 30% Camera dezelfde
verhouding als 35% Detectie en 15% Camera.

## Validatie en behoud

- Een gekozen assetafhankelijkheid moet groter zijn dan 0% en maximaal 100% zijn.
- Minstens één assettype per subproces blijft verplicht.
- Proefberekenen, toepassen en terugzetten gebruiken de ingevulde percentages.
- De voorgestelde percentages blijven onderdeel van de expertduiding in de
  integrale export. Na toepassen worden ze als subprocessgewichten in de
  DVM-export bewaard.
- Oudere expertduidingen en DVM-totaalbestanden blijven bruikbaar.
