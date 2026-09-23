# BiDash 2.23, expertinvoer per dienstverlening

Datum: 22 september 2026

## Nieuw

- Onder **Regels & signalen** staat een generiek scherm **Expertinvoer**.
- Iedere dienstverlening heeft een eigen knop die het scherm direct met de juiste dienst opent.
- De expert ziet eerst de bestaande norm, uitkomst, subprocessen en assetafhankelijkheden uit DVM.
- Het formulier vraagt gericht naar doel en scope, processtappen, beslismomenten, overdrachten, afhankelijkheden, faalwijzen, herstel, meetwijze en bewijs.
- Ontbrekende relaties kunnen apart worden vastgelegd, ook als het andere proces, systeem, asset of de rol nog niet in BiDash voorkomt.
- Regelvoorstellen gebruiken een toetsbare ALS-DAN-structuur. Signaalvoorstellen bevatten conditie, ernst, actiehouder, actie, reactietijd en escalatie.
- De statussen **Concept**, **Ter beoordeling** en **Vastgesteld** ondersteunen inhoudelijke review. Voor vaststelling zijn alle kernvragen, een compleet regel- en signaalvoorstel en akkoordgegevens vereist.

## Testen en toepassen

- De expert kan de huidige dienstnorm en subprocessen als bewerkbaar model overnemen.
- Een nieuw subproces bevat een naam, aandeel in de dienstverlening, assetafhankelijkheden en onderbouwing.
- De subprocessen moeten samen 100% zijn. De afhankelijkheden binnen ieder subproces moeten ook samen 100% zijn.
- **Proefberekening uitvoeren** rekent het voorstel tijdelijk door en herstelt daarna automatisch het actieve model.
- Een volledig vastgesteld voorstel kan met **Vastgesteld model toepassen** actief worden gemaakt.
- DVM bewaart de vorige configuratie. **Vorige model terugzetten** maakt de toepassing ongedaan en rekent opnieuw.
- Vrije tekst, relaties en regel- of signaalvoorstellen blijven duiding en worden niet automatisch uitvoerbare regels.

## Opslag en overdracht

De duiding wordt lokaal in de BiDash-werkruimte opgeslagen. **Expertduiding dienstverlening** is een eigen selectie in de integrale export. Een oudere werkruimte zonder dit onderdeel blijft geldig en een deelimport zonder expertduiding laat bestaande duidingen behouden.

## Controle

Nieuwe tests bewaken het generieke gegevensmodel, statusvalidatie, vaststelling, opslag per dienstverlening, navigatie, selectieve export/import en beschikbaarheid in de read-only Context API.

Deze wijziging gebruikt BiDash 2.23 en DVM 110.
