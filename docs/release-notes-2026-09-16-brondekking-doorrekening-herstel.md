# Release notes brondekking laat de doorrekening weer toe

Datum: 16 september 2026

Versie: BiDash 2.12, DVM 81

## Opgelost

- De landelijke dienstverlening viel terug naar `0,00 tot 100,00%` met `brondekking
  0,0%` zodra één assettype open meldingen had die niet doorgerekend konden worden.
  Ook de wél doorgerekende meldingen telden dan niet meer mee.
- Een type met een gat (bijvoorbeeld 435 van 657 doorgerekend) voedt de
  dienstverlening nu weer met de waarde uit de doorgerekende meldingen.
- Alleen een type dat open meldingen heeft maar waarvan er géén enkele is
  doorgerekend, blijft een onbekende band. Anders zou het als volledig beschikbaar
  gelden terwijl niemand weet wat die meldingen doen.

## Waarom dit telde

De vorige stap (open meldingen tellen uit de bron) legde een gat bloot tussen wat er
in de bron zit en wat `doorrekenen()` kan verwerken. Om te voorkomen dat een
bevestigde bron met zo'n gat een vals-exact percentage gaf, zette `v68TypeStatus()`
het assettype op onbekend zodra er ook maar één melding niet doorgerekend was.

Dat was te grof. `v68Subproces()` behandelt een onbekend type als een volle band
(ondergrens 0%, bovengrens 100%) en telt het niet als bekende dekking. Omdat vrijwel
elke dienst op signalering leunt, en signalering in de praktijk altijd een klein gat
heeft, viel daardoor de héle dienstverlening terug naar de volle band met 0%
dekking. De 435 doorgerekende signaleringsmeldingen — een reëel, zij het
optimistisch, verlies — werden weggegooid.

## Hoe het nu werkt

`v68TypeStatus()` onderscheidt twee gevallen:

- **Blind** (`blindeMeldingen`): er staan open meldingen in de bron, maar geen enkele
  is doorgerekend. Het berekende verlies is dan nul en zou 100% beschikbaarheid
  suggereren. Dit type krijgt `besch = null` en gaat als onbekende band de
  dienstverlening in. Dit is het DRIP-geval uit de melding.
- **Gedeeltelijk** (gat, maar minstens één doorgerekend): het verlies uit de
  doorgerekende meldingen is een bruikbare, optimistische waarde. Die wordt gebruikt;
  het gat blijft zichtbaar in de tabel als `N doorgerekend` onder het bronaantal.

De enige gedragswijziging ten opzichte van de code van vóór de vorige stap is dus de
blind-uitzondering. Een type met doorgerekende meldingen rekent weer door zoals het
altijd deed.

## Ongewijzigd

- `doorrekenen()` en de voorwaarden waaronder een melding afvalt.
- `v68Subproces()` en `v68Dienst()`: de band- en dekkingsmechaniek zelf.
- Het zichtbaar maken van het gat in de brondekkingstabel.

## Bekende beperking

Een gedeeltelijk doorgerekend type telt mee als bekende dekking op basis van zijn
optimistische waarde; het verlies van de niet-doorgerekende meldingen zit er niet in.
Dat gat staat wel in de tabel. De echte oplossing is dat die meldingen doorgerekend
wórden — dat vraagt een passende foutregel of locatie, en staat los van deze
wijziging.

## Controle

- `tests/brondekking-open-meldingen.test.js` uitgebreid. Nieuw: een gedeeltelijk
  doorgerekend type houdt een waarde, een blind type wordt onbekend, en een subproces
  dat op een bevestigd-met-gat type leunt haalt daar dekking uit in plaats van op nul
  te blijven. Deze laatste voert de verzonden `v68Subproces()` uit met de typen die
  `v68TypeStatus()` oplevert.
- Tegen de vorige (te grove) code gedraaid falen vier van deze tests, waaronder de
  reproductie van de gemelde storing.
- Na de merge met `main` (die parallel het lokale kwaliteitsdashboard en een eigen
  DRIP-live-herstel toevoegde): volledige Node-suite 208 tests geslaagd, inclusief de
  test van de andere auteur die eist dat een blind type geen exact percentage geeft.
  Browsersuite `browser.cjs`, `planning-large.cjs` (na één herhaling wegens een
  time-out) en `planning-formation.cjs` geslaagd. Syntaxcontrole geslaagd.
- In Chromium is de versiebalk gemeten: `BiDash 2.12 · DVM 81`.

## Niet getest

- De doorrekening met de operationele bestanden waarin dit is opgemerkt. De controle
  gebruikt synthetische regels; er is geen operationele export gebruikt of toegevoegd.
- Of de niet-doorgerekende DRIP-meldingen daadwerkelijk een impact krijgen zodra er
  een passende foutregel voor hun foutcode bestaat. Dat is de openstaande, diepere
  oorzaak; deze wijziging maakt alleen de terugval ongedaan.
