# BiDash 2.50, groot assetregister

DVM blijft versie 130. Deze wijziging betreft de gezamenlijke presentatielaag.

## Gedrag

- Het register bouwt de assetweergave en de open-storings-/foutcodeindex eenmaal per bronrevisie.
- Getalopmaak hergebruikt Intl.NumberFormat in plaats van een nieuwe formatter per asset.
- Opbouw en zoeken verwerken maximaal 512 regels per blok, met ruimte voor browserbediening tussen de blokken.
- Typen wordt 150 ms gebundeld. Een nieuw verzoek breekt de vorige zoekactie af.
- Bladeren hergebruikt de huidige volledige selectie en toont maximaal 60 tabelregels.
- Bronwijzigingen, locatiecorrecties, herstel en Uitkomsten vernieuwen verversen de presentatielijst.
- Een BI-asset met dezelfde sleutel krijgt geen DVM-storing toegewezen.
- De querybouwer vervangt het formulier niet opnieuw bij het verlaten van een filterwaarde. Daardoor blijft Voorwaarde toevoegen direct klikbaar.

Alle assets blijven beschikbaar. DVM-formules, effectieve locaties, bronbestanden, import- en exportcontracten blijven bij de bestaande eigenaren.

## Controle

De unitregressie controleert cacheverversing, bronvolgorde, nul-HMP, status, ontkoppelde meldingen, gecombineerde foutcodes en afbreken van achterhaald werk. De browsertest gebruikt 50.000 synthetische assets en controleert paginering, EN-query, snelle zoekwisselingen en bronmutaties. De aangeleverde totaal-JSON is daarnaast lokaal gebruikt; operationele bronnen of afgeleide tellingen staan niet in Git.

Alle 434 unitcontroles en de browsertests voor het register, planningimport, selectieve export, herstel en mobiele navigatie zijn geslaagd.

De verbetering geldt voor het gezamenlijke Assetregister. Zware bronimports en andere engineanalyses blijven eigen bewerkingen; browserprestaties verschillen per apparaat.
