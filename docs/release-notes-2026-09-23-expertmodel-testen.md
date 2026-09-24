# BiDash 2.23 en DVM 110, expertmodel testen en terugzetten

Datum: 23 september 2026

## Nieuw

- Expertinvoer toont de huidige dienstnorm en subprocessen als bewerkbaar modelvoorstel.
- Je kunt een subproces toevoegen met een naam, dienstaandeel, assetafhankelijkheden en onderbouwing.
- Een proefberekening vergelijkt de actieve dienstuitkomst met het voorstel en herstelt daarna automatisch de actieve configuratie.
- Een volledig vastgesteld voorstel kan bewust worden toegepast.
- De vorige dienstconfiguratie wordt als rollback-snapshot bewaard en kan vanuit hetzelfde scherm worden teruggezet.
- Nieuwe en gewijzigde subprocessen blijven behouden in de DVM-totaalexport en na herimport.

## Validatie

- De dienstnorm moet tussen 0 en 100 procent liggen.
- De aandelen van alle subprocessen moeten samen 100 procent zijn.
- De afhankelijkheden binnen ieder subproces moeten samen 100 procent zijn.
- Een subproces vereist een unieke naam en minimaal één afhankelijkheid.
- Toepassen vereist de status Vastgesteld en een compleet expertvalidatiedossier.

## Veilig gedrag

Een proefberekening schrijft geen modelwijziging weg. Vrije tekst, relaties, regelvoorstellen en signaalvoorstellen worden niet automatisch omgezet in actieve regels. Alleen het zichtbare, gestructureerde modelvoorstel kan na vaststelling worden toegepast.

