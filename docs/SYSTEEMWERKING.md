# BiDash — systeemwerking en kwaliteitscontract

Status: beschrijving van BiDash 2.60 en DVM 140, bijgewerkt op 15 oktober 2026 voor MTM-BSS-gebeurtenissen met expliciete registratie en herstel. De storingslevenscyclus, uitvoerbare memobesluiten en PDOK-kaart blijven beschikbaar.
Dit document bevat geen operationele brongegevens. Bij een functionele wijziging moeten code, tests, `docs/GEBRUIKERSHULP.md`, `docs/processflow.md`, de gepubliceerde Help-pagina en deze beschrijving samen worden beoordeeld en waar nodig bijgewerkt.

## 1. Doel en grenzen

BiDash brengt dienstverlening, buitenassets, verkeerskosten, personele capaciteit,
contracten en planning samen voor besluitvorming. De gebruiker laadt eigen lokale
bestanden. GitHub Pages host de applicatie en vanaf 2.47 een periodiek opgehaalde openbare NDW-feed. Gebruikersdata wordt lokaal verwerkt en opgeslagen.

Het systeem is momenteel een gezamenlijke gebruikersinterface met drie bestaande
rekenmodules. Het is geen volledig herschreven, uniforme engine. De adapters
verbinden de modules. Hun DOM, globale variabelen en oorspronkelijke rekenfuncties
blijven van belang. Een visueel geslaagde wijziging bewijst geen correcte berekening.

Dit document beschrijft de bestaande werking en de voorwaarden voor wijzigingen.
Het is geen onafhankelijke validatie van de verkeerskundige of statistische modellen.
Modelaannames mogen niet als metingen of zekerheden worden gepresenteerd.

## 2. Architectuur en eigenaarschap

![Logische architectuur van BiDash in vier lagen binnen één browserorigin: de schil met schermen en orchestratie, de kern met gedeelde contracten, de bruggen via window.HUB, en de drie rekenmodules DVM, BI en planning in eigen iframes, met daarnaast de lokale opslag](afbeeldingen/architectuur.svg)

Een leeswijzer bij deze tekening staat in [architectuur.md](architectuur.md). De onderstaande tabel blijft de normatieve indeling.

| Onderdeel | Code | Verantwoordelijkheid |
| --- | --- | --- |
| Ingang en vormgeving | `site/index.html`, `site/style.css` | Gezamenlijke werkruimte, horizontaal hoofdmenu, fullscreen en Help-ingang |
| Gebruikershulp | `site/help.html`, `docs/GEBRUIKERSHULP.md`, `docs/processflow.md` | Bedieningsuitleg, laadvolgorde en procesflows |
| Navigatie | `site/ui/routes.js` | Hoofdgroepen, subroutes en doelmodule |
| Orchestratie | `site/app.js` | Importvoorstel, herstel, opslag, gezamenlijke weergave, adapters |
| Versie | `site/core/versie.js` | Het versienummer van de schil, de tekst in de kopbalk en in de voet van de zijbalk |
| Datalaadvoortgang | `site/core/load-progress.js`, `site/core/import-progress-bridge.js` | Eén zichtbare importstatus voor hubbestanden en specialistische DVM-bronnen; bytevoortgang waar de browser die kan meten en fasestatus tijdens parsing/doorrekening |
| Laatste stand | `site/core/latest-snapshot.js` | Herkent integrale en DVM-totaal-JSON, kiest de nieuwste geldige momentopname uit een gekoppelde lokale map en bewaakt maptoestemming |
| Gegevenscontract | `site/core/model.js` | Deelimport, selectie-export, validatie, gecombineerde signalen |
| Expertduiding | `site/core/service-expert-input.js` | Generiek schema, volledigheid, statusvalidatie en opslag per dienstverlening |
| Live storingssync | `site/core/live-snapshot.js` | Vervangen actuele momentopname, behouden van verdwenen meldingen als onbekend en bijwerken van dezelfde historie |
| Live overzichtsfilter | `site/core/live-overview-filter.js` | Gebruikersselectie van open meldingen die in de actuele DVM-doorrekening meetellen, zonder de bronmomentopname te veranderen |
| Opslag | `site/core/storage.js` | IndexedDB, transactioneel schrijven |
| DVM | `site/engines/dvm.html`, `dvm-1.js` t/m `dvm-3.js` | Buitenassets, storingen, dienstimpact, verkeerskosten, prognoses, memo’s |
| BI | `site/engines/bi.html`, `bi-1.js` t/m `bi-3.js` | Formatie, capaciteit, contracten, interne bedienketens |
| Planning | `site/engines/planning.html` | XML-model, WBS, afhankelijkheden, verschuivingen, planninggrafieken; begint leeg, alle projectgegevens komen uit geladen bestanden |
| Bruggen | `*-adapter.js` | Expliciete gegevensuitwisseling via `window.HUB` |
| Planninganalyse | `site/engines/planning-analysis.js` | Pure weekberekening met selectie van actieve meetmomenten, gedeeld door de formatiegrafieken |
| Canvas | `site/engines/planning-canvas.js` | Begrensd tekenvlak en scrollcoördinaten |
| Gedeelde modulestijl | `site/engines/component.css` | Vormgeving binnen de frames |
| Lokale bibliotheek | `site/vendor/` | Spreadsheetverwerking zonder externe CDN |

### Runtime-patches

De drie rekenmodules draaien ongewijzigd in hun iframe. Verbeteringen hangen er als
runtime-patch omheen: een module uit `site/core/` die bestaande functies in de scope
van de engine omwikkelt en daarna een eigen vlag zet, zoals
`__BIDASH_DVM_LIVE_PATCH_ACTIVE__`. `site/core/signal-forecast.js` is de enige plek
waar die patches worden gekoppeld.

Installeert een patch niet, dan valt de applicatie stil terug op het oude gedrag:
geen foutmelding, geen zichtbaar verschil, wel andere uitkomsten. Daarom geldt:

- Elke patch zet één eigen vlag in de scope waarin hij installeert.
- Elke patch staat met die vlag in `tests/runtime-patches.test.js`. Een nieuwe
  `export function install…` zonder regel in dat bestand laat de suite falen.
- Een patch die bewust niet gekoppeld is, blijft daar ook staan, met de reden in
  `signal-forecast.js`. Niet gekoppeld is een keuze die je vastlegt, geen regel die
  je weglaat.

### Versienummer

Het versienummer van de schil staat in `site/core/versie.js` en nergens anders.
`site/app.js` toont het bij het starten in de kopbalk en in de voet van de zijbalk,
dus vóórdat er een module is geladen. Een module meldt haar eigen engineversie met
`postMessage({type:'hub:version',engine,versie})`; de schil zet die erachter. Een
module schrijft niet zelf in het document van de schil.

Eén eigenaar per rekenregel:

- DVM berekent buitenasset-impact, de actuele storingsselectie, subprocessen, dienstbeschikbaarheid en verkeerskosten.
- BI beheert de VWM/CIV-formatienormen en capaciteit; planning past die regels toe.
- BI beheert contract- en interne bedienketenregels. Ketenbeschikbaarheid is niet automatisch hetzelfde als DVM-dienstbeschikbaarheid.
- De hub combineert uitkomsten en expliciete koppelingen; hij introduceert geen tweede dienst-, kosten- of formatiemodel.

`bi-adapter.js` verplaatst oude BI-aggregaatassets met IDs volgens
`ndw_(msi|drip)_` naar `legacyDvmAssets`. Oude storingsregels worden waar aanwezig
bewaard als `legacyDvmRegels`, maar niet opnieuw toegepast. Andere BI-assets worden
niet automatisch als duplicaat verwijderd. Overlap vraagt inhoudelijke beoordeling.

## 3. Gebruikersfuncties

| Hoofdgroep | Inhoud |
| --- | --- |
| Overzicht | Dienstverlening, capaciteit, brondag en gezamenlijke signalen; DVM toont zichtbaar hoeveel open storingen na het ingestelde live filter meetellen |
| Assetmanagement | Register, open storingen, wegdelen, levensduur/DRIP, bedienketens |
| Dienstverlening | Impact, verkeerskosten, gebied, regio, rekenverslag, memo’s |
| Planning | Tijdlijn, planningsdashboard, project/budget, dashboardbeheer |
| Formatie & contracten | Functies, VWM- en CIV-model, contracten, bedrijfsgegevens |
| Regels & signalen | Signalering, dienst-functiekoppelingen, domeinregels en expertinvoer per dienstverlening |
| Scenario’s | Huidige verkeerskosten, MSI-toekomst, BI-scenario’s; DRIP via DVM |
| Data & export | Lokale import met zichtbare voortgang, nieuwste stand uit een gesynchroniseerde SharePoint-map, datasetbeheer inclusief live storingsfilter, lokale kwaliteitsaudit, selectieve back-up, oorspronkelijke broninvoer |
| Help | Gebruikersuitleg, aanbevolen laadvolgorde, actuele storingslijst en procesflow |

Rechtsboven in de hoofdwerkruimte staat een Help-knop naar `site/help.html`. Die pagina is onderdeel van de gepubliceerde `site/`-map en werkt dus ook wanneer de repository later niet publiek toegankelijk is. De inhoud volgt de documentatie in `docs/`.

Behoud verdiepende doorklikken, filters, bronvermelding, scope en terugnavigatie.
Een nieuwe navigatie mag oorspronkelijke analyses niet onbereikbaar maken.

### Presentatie van grote assetregisters

Vanaf BiDash 2.50 bouwt `site/core/asset-register-view.js` één lokale presentatielijst uit de bestaande DVM- en BI-adapters. De lijst bewaart bronvolgorde, effectieve locatie, status en queryvelden; bronrijen en rekenuitkomsten veranderen niet. Open storingen en unieke foutcodes worden één keer per DVM-assetsleutel gegroepeerd. Een gelijknamige BI-sleutel krijgt geen DVM-storingen. Ontkoppelde meldingen blijven in de landelijke storings-KPI staan.

Opbouw en filtering verwerken blokken van maximaal 512 regels met een browserpauze ertussen. Een nieuw zoekverzoek of bronrevisie breekt achterhaald werk af. Typen wordt 150 ms gebundeld. De huidige selectie wordt bij bladeren hergebruikt; uitsluitend de huidige 60 assetregels worden als tabel opgebouwd. De telling en query blijven over de volledige geladen populatie gaan. Getalopmaak gebruikt gedeelde `Intl.NumberFormat`-instanties.

`hub:changed`, werkruimteherstel en Uitkomsten vernieuwen maken de presentatielijst ongeldig, ook als een bronobject op dezelfde plek is gewijzigd. Alleen dezelfde origin en bekende bronframes mogen zo'n melding leveren. Openen en bladeren wijzigen geen dienstberekening. De cache wordt niet geëxporteerd of opgeslagen. De eerste opbouw en een nieuwe zoekselectie kunnen kort Assetregister bijwerken tonen; grote bronimports blijven aparte bewerkingen.

`npm run test:assets` controleert het echte schilscherm met een synthetisch register van 50.000 assets, paginering, foutcodeselecties met EN, zoeken, mutaties en lege storingen. `tests/asset-register-view.test.js` bewaakt bronbehoud, nul-HMP, foutcodegroepering, hergebruik en afbreken van oude taken. Een lokale vergelijking is aanvullend uitgevoerd met de aangeleverde DVM-totaal-JSON; die bron en afgeleide tellingen zijn niet opgenomen in Git. Browsertijden zijn omgevingsafhankelijk; deze wijziging is geen garantie voor importtijden of mobiele apparaten.

### Status en open storingen vanaf BiDash 2.51 / DVM 131

De eerdere presentatielijst uit 2.50 loste niet alle blokkades op. `asset-register-special-filter.js` omwikkelde nog steeds `HUB.assets()` en vergeleek ieder asset met alle actuele meldingen. De schermfilters veranderden daardoor ook de adapterpopulatie vóór de cache. Die module maakt nu uitsluitend filterbediening. `HUB.assets()` blijft het volledige register aanbieden. De paginalijst groepeert meldingen per assetsleutel en gebruikt dezelfde bestaande `operationalStatusForAsset`-regel, met alleen de meldingen van dat asset. Status, Windwaarschuwing en RIA4 worden als selectiefilters toegepast; Windwaarschuwing en RIA4 combineren als OF en omvatten uitsluitend DVM-assets. De huidige-schermcontext van Vraag dashboard volgt dezelfde selecties. De register-KPI blijft de volledige populatie tellen.

`dvm-faults-extension.js` bouwt één sleutelindex per leesactie voor registerassets en gekoppelde DRIPs. De eerste registratie bij een dubbele sleutel blijft leidend, zoals bij de voormalige find. Een ongekoppelde DRIP zoekt alleen binnen het DRIP-areaal; de bestaande identificatie-, locatieconflict- en classificatieregels blijven gelden. Speciale referenties gebruiken de bestaande recordIndex/candidateRecords/matchesRecord-keten. `HUB.faults()` blijft synchroon beschikbaar; de aanvullende `HUB.faultsAsync({isCurrent})` verwerkt opbouw en verrijking in korte blokken met afbreken van achterhaalde verzoeken. Beide leveren dezelfde meldingen, status, onbekende impact en duur, zonder historie opnieuw toe te voegen.

`open-fault-parent-ui.js` is de enige eigenaar van de gezamenlijke storingslijst. De schil vraagt via een documenthook een weergave aan en bouwt geen tweede volledige tabel. Een verborgen storingsscherm leest of tekent geen storingen. De vorige observer op de tabelinhoud is verwijderd; alleen bronwijzigingen, schermzichtbaarheid en filters vragen nieuw werk aan. Bronwijzigingen gaan via de reeds gecontroleerde hubberichten naar het interne documentevent bidash:data-change. Filteren en foutcodegroepering verwerken korte blokken; typen wordt 150 ms gebundeld. De lijst toont 60 meldingen per pagina, met selectie en telling over alle actuele meldingen. Bladeren hergebruikt de selectie. De memo blijft de volledige selectie bevatten, ook voorbij de zichtbare pagina.

`tests/fault-enrichment-performance.test.js` controleert indexgebruik, gelijke synchrone/asynchrone uitkomsten, nul en onbekende duur/impact, afbreken, dubbele sleutels en DRIP-conflicten. `tests/assetmanagement-responsiveness.cjs` gebruikt de echte adapters en statusmodules met 50.000 synthetische assets en 5.000 meldingen, met viermaal vertraagde CPU. Hij controleert browsertaakduur, verborgen scherm, volledige adapterpopulatie, status-/speciale filters, paging, snelle zoekwisselingen, memo en nieuwe lege bron. De eerdere test uit 2.50 verving HUB.assets/HUB.faults voor zijn UI-controles en dekte de nu gevonden omwikkelingen onvoldoende; die test blijft aanvullend bestaan. Grote bronimports, expliciete volledige memo-opbouw en andere analyses zijn afzonderlijke bewerkingen. De lokale browsertest bewijst niet dat ieder gebruikersapparaat of iedere dataset dezelfde tijdgrens haalt.

### Achtergrondkaart bij Gebied & knelpunten, 2.55 / DVM 135

De eerdere NWB-kaartconstante bevatte geen wegassen. Daardoor kon het scherm knelpuntpunten zonder herkenbare kaart of een onjuiste melding over geladen NWB tonen. `gebiedKaartTegels()` in `dvm-3.js` laadt nu de openbare BRT Achtergrondkaart van Kadaster / PDOK als WMTS-afbeeldingen onder de bestaande SVG-markeringen. De officiële RD New-matrix gebruikt oorsprong (-285401.92, 903401.92), 256 pixels per tegel en beginresolutie 3440.64 meter per pixel; de matrixnamen zijn tweecijferig. De geometrie en knelpuntpunten delen dezelfde RD-projectie. De uitsnede gebruikt de beschikbare registercoördinaten, knelpuntcoördinaten en geladen NWB-geometrie. Zonder coördinaten verschijnt een landelijke kaart met uitleg; er worden geen knelpuntposities verzonnen.

Gebiedskeuze, in-/uitzoomen, Hele regio en selectie vanuit de ranglijst verversen dezelfde kaart. Per weergave worden maximaal 64 zichtbare tegels gevraagd. Er is geen externe kaartbibliotheek, extra gegevensimport, opslag- of exportsectie. De kaart verandert de dienstberekening niet. Knopen zonder kaartpositie blijven in de ranglijst en in de telling. Geladen NWB-lijnen en de bestaande veilige snap binnen 250 meter op dezelfde weg blijven bruikbaar, maar ontbrekende NWB-data wordt niet als geladen gepresenteerd. Een laadstatus en Kadaster/PDOK-bronvermelding staan onder de kaart. Bij kaartuitval blijven de markeringen, selectie en ranglijst werken.

`tests/gebied-kaart.test.js` controleert RD-projectie, matrix-URL's, tegelgrenzen, ontbrekende coördinaten, tellingen en CSP. `tests/gebied-kaart-browser.cjs` controleert laden, zoom, VC-selectie, selectie vanuit de ranglijst, mobiel, ontbrekende kaartverbinding en het ontbreken van referrer/cookies. Standaard gebruikt deze test nagebootste afbeeldingen; met `PDOK_LIVE=1` leest hij de echte openbare kaartdienst. De beschikbaarheid van die dienst blijft een externe afhankelijkheid.

## 4. Lokale gegevens en beveiliging

De hoofdwerkruimte heeft `schema: 1` en bevat `dvm`, `bi`, `planning`, `links`,
`expertReviews`, `history`, `qualityAudit` en `qualityHistory`. IndexedDB gebruikt database
`bidash-integraal`, objectstore `workspace`,
sleutel `current`. Modules gebruiken daarnaast lokale browseropslag. Een back-up
is een gedownloade export; browseropslag is geen garantie tegen gegevensverlies.
Gebruik één werkruimte-tab tegelijk; er is geen uitgewerkte meergebruikerssynchronisatie.

### Grote werkruimten vanaf 2.58 / DVM 138

De bestandsgrootte van een JSON is niet gelijk aan de omvang van de intern opgeslagen werkruimte. Object- en veldmetadata, tekstcodering, levenscyclusvelden en afgeleide selecties tellen mee. De Chromium-melding met `serialized keys and/or value are too large` treedt op per IndexedDB-record; zij is geen bewijs dat het bronbestand onleesbaar is. In de aangeleverde foutmelding was het record circa 212 MB bij een grens van circa 133 MB. De recente verrijking van storingsrijen en de effectieve DRIP-selectie vergroten de opgeslagen vorm. De exacte verdeling in de actuele gebruikersexport is niet gemeten.

`storage.js` bewaart de werkruimte daarom als een generatie opslagdelen met een interne groottebegroting van 4 MiB. `workspace-parts.js` verdeelt grote arrays, objecten en teksten zonder JSON-stringificatie van de werkruimte. Null, nul, undefined en tekst blijven onderscheiden. Een snapshot vóór het schrijven voorkomt dat latere wijzigingen in dezelfde opslaghandeling terechtkomen. Schrijfopdrachten binnen de module lopen op volgorde.

De bestaande database `bidash-integraal` en store `workspace` houden versie 1. `current` bevat bij nieuwe opslag een intern manifest. Delen gebruiken eigen samengestelde sleutels met generatie en volgnummer. Pas wanneer alle delen zijn bevestigd, vervangt één transactie het manifest en verwijdert zij de vorige generatie. Bij een fout blijft de vorige `current` staan en worden de nieuwe delen opgeruimd. Lezen van manifest en delen gebeurt binnen één leestransactie; ontbrekende of ongeldige delen geven een fout, geen gedeeltelijke werkruimte. Oude ongedeelde `current`-records blijven leesbaar en worden bij de volgende geslaagde opslag omgezet.

Andere sleutels, waaronder de lokale mapkoppeling, blijven gewone native IndexedDB-waarden. De NDW-lezer gebruikt dezelfde centrale `read()` in plaats van rechtstreeks `current` te lezen, zodat ook een gesplitste werkruimte kan worden gebruikt. De handmatige JSON-/XML-export en de bestaande compacte DVM-autosavekeuze veranderen niet. Deze wijziging verwijdert geen bronrijen en maakt eerder weggelaten MTM-autosavegegevens niet alsnog aanwezig.

De recordgrens wordt hiermee omzeild, maar RAM- en totale browserquota blijven bestaan. Een harde browserstop vóór de manifestwissel kan onbevestigde delen achterlaten; ze worden niet als werkruimte ingelezen. De vorige bevestigde stand blijft dan leidend. Er is geen aparte automatische opruiming van zulke crashresten. De browserregressie controleert een reproduceerbare recordfout boven 128 MiB, compleet teruglezen, behoud na een deelopslagfout, oude opslag, schrijfvolgorde, ontbrekende delen, NDW en echte import/herladen.


- Geen uploads van gebruikersbestanden naar GitHub, telemetrie of externe AI-diensten.
- Geen operationele XML/JSON, uitsneden, screenshots of afgeleide operationele tellingen in de repository of publiek
- Dat geldt ook voor gegevens die als voorbeeld of demonstratie in de broncode staan. Een ingesloten projectplanning, portfolio- of triggerlijst is een publicatie van die gegevens, ook als geen enkel scherm haar toont. Een module begint leeg en toont wat de gebruiker laadt. `tests/planning-geen-projectdata.test.js` bewaakt dit voor de planningmodulee CI-logs. Gebruik synthetische testgegevens.
- De hoofdschil behoudt `connect-src 'none'`. Het DVM-frame gebruikt vanaf 2.47 `connect-src 'self'` voor vaste GET-verzoeken naar de openbare NDW-kopie op dezelfde website. De downloader gebruikt geen cookies, referrer of gebruikersgegevens. Vanaf 2.55 / DVM 135 staat uitsluitend `img-src` daarnaast het vaste PDOK-pad `https://service.pdok.nl/kadaster/brt-achtergrondkaart/wmts/v2_0/` toe voor openbare kaarttegels. De RD-tegelmatrix, kolom en rij bepalen de URL; brongegevens, assetsleutels en storingen worden niet verstuurd. De beeldverzoeken gebruiken anonieme CORS en geen referrer. De kaartdienst ontvangt de normale netwerkgegevens en de opgevraagde kaartruitsnede. Andere externe hosts blijven geblokkeerd. Externe bronlinks zijn geen toestemming om gebruikersdatasets te verzenden.
- De hoofdschil staat geen inline stijl toe. Dynamische schilonderdelen gebruiken klassen uit `site/style.css`; voeg geen `unsafe-inline` toe om een geblokkeerde stijl te omzeilen.
- Modules draaien onder dezelfde origin. Frames met `allow-scripts` en `allow-same-origin` zijn geen beveiligingsgrens tegen kwaadaardige eigen code.
- `postMessage` wordt alleen verwerkt voor dezelfde origin én bekende bronframes.
- JSON-validatie weigert `__proto__`, `constructor`, `prototype` en te diepe nesting. Dit vervangt niet de inhoudelijke validatie van een dataset.
- XML wordt met de bestaande parsers verwerkt. Controleer parserfouten en houd geïmporteerde labels veilig bij HTML-weergave; voer broninhoud nooit als code uit.

## 5. Import, herstel en export

### Formaten en volgorde

Ondersteund zijn de bestaande DVM-totaal-JSON, BI-dataset-JSON en planning-XML
(MS Project en Primavera P6), plus de integrale JSON. Specialistische DVM-invoer
blijft via bronbeheer beschikbaar. ZIP is geen beloofd hub-importformaat: pak een
planningarchief uit en laad de XML, tenzij ZIP-ondersteuning apart is geïmplementeerd.

De handmatige DVM-totaalexport bewaart zowel de feitelijke bronrijen als de
bronidentiteit en samenvatting van Bronbeheer. Bij een gecombineerde
signaalgeverbron blijven `_signaalgeverTotaal`, het oorspronkelijke bestand,
peildatum, herkomst en tellingen behouden. Het `bronbeheer`-manifest bewaart de
samenvattingen van Signaalgevers totaal en DRIP totaal. Bij herstel gebruikt de
doorrekening nog steeds de bestaande storingssecties, terwijl Bronbeheer dezelfde
gecombineerde bronkaarten terugtoont. Oude totaalexports zonder manifest blijven
bruikbaar; vaste signaalgeverbronsleutels worden bij import alsnog herkend.

Automatische lokale opslag en handmatige export zijn bewust twee verschillende
paden. `HUB.export()` levert standaard een compacte snapshot voor IndexedDB en
laat zware, uit een map opgebouwde signaalgeverrijen weg. Alleen een expliciete
`HUB.export({fullSources:true})` levert de volledige handmatige back-up. De
hoofdapp gebruikt die volledige variant voor zowel DVM-totaal-JSON als de
integrale BiDash-export, zonder de compacte lokale werkruimte ermee te vervangen.
De integrale export neemt daarnaast het bij de geselecteerde storingsdelen horende
`bronbeheer`-manifest mee. Daardoor blijven bijgewerkte MTM- en CDMS-mapgegevens,
U-routes, werkzaamheden, classificatielijsten en hun bronstatus na export en
herimport beschikbaar.

De aanbevolen DVM-volgorde is All Assets, historische storingen, U-routes, werkzaamheden en als laatste de actuele open storingslijst. Installatie-/ingebruiknamedatum, EOL en expliciete levensduur worden uit All Assets gelezen. De actuele storingslijst is de volledige momentopname voor het live dashboard. Daarna kan de gebruiker in Datasetbeheer instellen welke open meldingen in de actuele doorrekening meetellen. Historische storingen zijn een aparte gegevensstroom voor historie en prognose en worden door dat live filter niet gewijzigd.

Naast de losse Open storingen- en Storingshistorie-uploads is er een gecombineerde bron **Signaalgevers totaal (JSON)**. Dat is één exportbestand (`datasets.mtm`) met zowel de open alarmen als de historische storingen. `signaalgeverTotaalBronnen()` in `dvm-3.js` zet de records om naar rijen die `normRij()` al kent: `alarm_episodes` met `eindstatus: "open_aan_einde"` (en `meenemen !== false`) worden de open-storingenstroom, `storingen` worden de historie. Elke open alarmregel draagt haar omschrijving als `melding`, aangevuld met `categorie` en signaalgever (`unit`). `canoniekAssetType()` en `signaalgeverAssetType()` houden daarbij MSI- en detectorregels uit elkaar: lus, lussen, detectie, detector, detectielus, meetlus en inductielus worden intern `LUS`; de overige MTM-signaalgeverregels worden `MSI`. `registerAssetType()` past dezelfde normalisatie toe op All Assets en laat een specifiek bouwdeel of type voorgaan op de bredere CI-familie. `OBJ_BRON.detectie = 'LUS'` koppelt dit technische type aan de schakel detectie in subprocessen en dienstverlening. Bekende foutcodes matchen eerst op de code en daarna op de omschrijving, zodat een andere omschrijving bij code 1006, 1007 of 5004 de impactregel niet blokkeert. Een historische storing zonder omschrijving krijgt `signaalgever + impactklasse` als melding met hetzelfde doel. Een detectorcode zonder passende LUS-regel blijft zichtbaar maar niet-doorgerekend; er wordt geen impact verzonnen. De bron is bewust een óf/óf-keuze: bij het laden vervangt ze de losse Open storingen- en Storingshistorie-bronnen (vervang-modus), zodat oud bestandsformaat nooit met de JSON mengt. De oude uploadknoppen blijven bestaan voor de bestaande werkwijze. De bronnen dragen een `_signaalgeverTotaal`-vlag zodat Datasetbeheer ze onder de eigen kaart "Signaalgevers totaal" toont in plaats van onder Open storingen en Storingshistorie (die dan leeg blijven); de doorrekening gebruikt onverminderd `STORINGSBRONNEN` en `LIVE_STORINGSBRONNEN`. Verwijderen op die kaart wist beide stores in één keer.

De `storingen`-tabel bestaat in twee schema's. `signaalgeverHistorieRij()` en `signaalgeverOpenRij()` lezen beide: v2.0 (`signaalgever`, `foutcodes`, `impactklassen`, `incident_venster_uur`, `laatste_bewezen_aanwezig`) én v2.5 (`asset`, `foutcode`, `impactklasse`, `duur_min_uur`, `einde_bewezen`, met een `omschrijving`). De omschrijving gaat mee als `melding`, aangevuld met signaalgever/impactklasse. De expliciete typehint bewaart daarbij MSI als `MSI` en detectie/lus als `LUS`, ook wanneer de omschrijving zelf geen bruikbaar typewoord bevat.

### Netwerkschakels als rapportagebasis

Bronbeheer heeft een aparte Excel-upload Netwerkschakelmatrix. Verplichte kolommen zijn Code, Verkeerscentrale, Rijksweg, Netwerkschakel, HMP van en HMP tot. Van, Tot, Richting HMP, Rekenlengte (km), Status, Controlepunt en bronverwijzingen blijven bewaard. Het matrixblad wordt herkend op HMP-kolommen; Toelichting en Bronnen worden niet als grenzen ingelezen. De upload werkt ook vóór All Assets. Ongeldige regels blokkeren vervanging zonder de vorige matrix te wissen.

De bron leeft in `DVM_NETWERKSCHAKELS_STATE` en de zelfstandige JSON-sectie `netwerkschakels`. Beide totaalexports en de integrale selectie-export bewaren de oorspronkelijke matrixrijen en bestandsnaam. Deelimports zonder deze sectie behouden de bestaande matrix; een expliciete lege sectie of volledige vervanging zonder matrix herstelt de oude wegindeling. De lichte matrix wordt ook bij uitgesteld werkruimteherstel teruggezet; de bestaande beperking voor zware DVM- en NDW-restores blijft gelden.

Koppeling gebruikt eerst genormaliseerde A/N-weg, hectometer, optionele rijrichting en hectoletter. Bij één passende code gaat de locatie vóór de administratieve bron-VC. De matrix-VC bepaalt schakelrapportage, kosten, memoscope en MSI-prognose; de bron-VC blijft intact en het verschil staat in de koppelcontrole. Bij meerdere codes kan een unieke match op bron-VC onderscheid maken. Overlap binnen dezelfde VC blijft onbeslist. HMP-richting geeft de volgorde van de hectometrering en is geen rijrichting. Een optionele Zijde/Rijrichting of Hectoletter beperkt de koppeling. Min/max ondersteunt aflopende HMP. Een gedeelde grens gaat naar het vak met die HMP als ondergrens, ook bij aflopende hectometrering. Onbesliste overlap tussen verschillende codes, ontbrekende HMP en locaties buiten de matrix blijven expliciet niet gekoppeld. De reden onderscheidt ontbrekende weg, ontbrekende HMP, grenzen, zijde en hectoletter. Expliciete hectoletters uit register en storingsbron blijven bij normalisatie en assetkoppeling behouden. Meerdere grensregels met dezelfde code zijn toegestaan bij dezelfde schakelidentiteit. Niet gekoppelde assets en doorgerekende meldingen blijven in afzonderlijke groepen, zonder het volledige wegareaal nogmaals te gebruiken.

Vanaf 2.48 delen register en storingen de weg-/HM-parser. Een expliciete N-prefix in een naam zoals N031G blijft N31, ook met een verbindings- of parallelbaanletter. HM, HMP en hectometer worden als kilometereenheid gelezen; nul blijft nul. De nauwkeurige locatie uit de naam gaat vóór generieke veldwaarden. Een kale wegcode gebruikt de bestaande terugval naar A, tenzij een expliciete prefix of PW-BPS-code het type vastlegt. Een verkeerd getypeerde weg kan individueel worden gecorrigeerd.

Vanaf 2.54 / DVM 134 accepteert die gedeelde parser ook scheidingsstreepjes vóór de rijrichting en HMP, bijvoorbeeld `A4-Li-7,49`, `N031-G-HMP-42,125` en `A15-R-12-345`. Een streepje tussen kilometer en meters blijft een decimale notatie. De A/N-prefix, oorspronkelijke zijletter, HMP nul en bronnaam blijven behouden. Register, storingen en netwerkschakels gebruiken dezelfde genormaliseerde locatie.

MSI- en LUS-koppelingen controleren bekende VC, oorspronkelijke zijde, hectoletter, HMP binnen de bestaande tolerantie en eenheid/rijstrook. Een expliciete eenheid gaat voor; anders wordt een uniek nummer uit MSI-, rijstrook- of detectortekst gelezen. Een tekst met meerdere nummers geeft geen willekeurige eerste rijstrook. De nieuwe logalias gebruikt type, VC, weg, oorspronkelijke zijde, HMP en eenheid; een algemene foutcode is geen assetidentiteit. Een expliciete `logId` blijft behouden. Oude locatiealiassen blijven opgeslagen en exporteerbaar, maar worden alleen gevolgd als de bronkenmerken passen. Een alias zonder eenheid mag meerdere rijstroken op dezelfde plek niet aan één asset koppelen. Een verkeerde oude alias wordt genegeerd; de gewone locatiekoppeling zoekt daarna een passend asset. Ontbreekt dat, dan blijft de melding zichtbaar op haar eigen bronlocatie zonder assetsleutel. Nieuwe handmatige aliassen volgen dezelfde controles. Een individuele locatiecorrectie accepteert bij dezelfde identiteit ook de bewaarde oorspronkelijke locatie, zonder een andere rijstrook te accepteren. Richting- en VC-filters vallen bij nul kandidaten niet terug op het andere gebied of de andere rijrichting.

De bestaande rekenketen behoudt verschillende foutcodes en incidenten op hetzelfde asset. Exacte doublures worden eenmaal verwerkt; type, canonieke VC, oorspronkelijke zijde, hectoletter en genormaliseerde eenheid onderscheiden de storingen ook bij hetzelfde incidentnummer. De importmatchcache bewaart diezelfde onderscheidende bronkenmerken. Historie blijft gescheiden van open meldingen. Er is geen maximum van één foutmelding per asset ingevoerd.

Andere zijletters dan LI/RE blijven als `zijdeBron` bewaard. Een gesorteerde hoofdbaanindex zoekt alleen op dezelfde A/N-weg, binnen de bestaande assettolerantie, standaard 0,35 km. Bron-VC kan de kandidaten beperken. Bij bruikbare RD-coördinaten wordt de dichtstbijzijnde hoofdbaan binnen 200 meter gebruikt; anders geldt HMP-afstand. Twee hoofdrijrichtingen met een verschil van maximaal drie meter RD of vijf meter HMP blijven onbeslist. Een handmatig gekozen LI/RE beperkt de zoekrichting. De schakel gebruikt bij een afgeleide zijbaankoppeling `hoofdbaanHm`; de feitelijke asset-HMP blijft behouden. Geen automatische wissel tussen A- en N-wegen en geen dubbele fysieke assettelling. Ontbrekende hoofdbaankandidaten en echte matrixgaten worden hierdoor niet opgevuld. Dit is een herleidbare nabijheidskoppeling, geen topologisch gevalideerde NWB-koppeling.

Bij individuele assetconfiguratie kan de gebruiker weg, hoofdrijrichting, HM/HMP, hectoletter en optionele RD-coördinaten wijzigen. Correcties staan onder `RULES.assetConfig.overrides[assetKey].locatie`, met een aanpassingsdatum. `bronLocatie` bewaart de oorspronkelijke genormaliseerde locatie; naam, entity-id, sleutel en oorspronkelijke bronrij veranderen niet. Opslaan valideert volledig vóór vervangen, bouwt areaal en alle indices opnieuw op, werkt het DRIP-model bij, herkoppelt context, maakt historie/prognose ongeldig en herberekent actuele meldingen. Het leeftijdsbeeld gebruikt het effectieve register. De nieuwe locatie wordt aan de schil gemeld voor lokale opslag. Totaalexport en de losse assetconfiguratie-export bewaren de correctie via de bestaande parameters. Herladen van dezelfde assetidentiteit past haar opnieuw toe. **Herstel alleen bronlocatie** bewaart de overige individuele rekenwaarden; de bestaande volledige assetreset verwijdert alle individuele overrides.

Een DRIP met handmatige locatiecorrectie accepteert bij een unieke identiteit/koppeling ook een bronlocatie die nog overeenkomt met de bewaarde oorspronkelijke locatie. De melding krijgt de gecorrigeerde locatie met een correctiemarkering. Een andere weg of conflicterende oorspronkelijke locatie blijft geweigerd. Individuele configuratie-import valideert locatiecorrecties vóór vervangen; een ongeldige correctie in oudere totaalparameters valt terug op de bronlocatie met zichtbare melding.

Vanaf 2.46 opent Bronbeheer en het schakeloverzicht **Koppelingen en grenzen controleren**. De dialoog groepeert niet gekoppelde actieve assets en huidige doorgerekende/niet-doorgerekende meldingen met passende codes en VC-verschillen. Alleen de geladen bronnen en huidige analyse worden gecontroleerd. De gebruiker kan HMP, VC, code, naam, zijde en hectoletter aanpassen en grensregels toevoegen of verwijderen. Een volledig gevalideerde kopie vervangt de matrix pas bij opslaan; ongeldige invoer behoudt de vorige matrix. Een gewijzigde HMP krijgt een opnieuw afgeleide lengte. Handmatige grenzen krijgen een zichtbare ongecontroleerde status. Er worden geen geografische grenzen geraden of operationele waarden in de applicatie ingebed. Een nieuwe Excel-upload vervangt deze lokale correcties.


Vanaf 2.49 / DVM 130 krijgt iedere probleemgroep **Oplossen**. De dialoog toont betrokken registerassets via hun stabiele sleutels en gekoppelde meldingen via `assetKey`. Locatiecorrecties gebruiken dezelfde validatie en herberekening als de individuele configuratie, maar blijven in de dialoog. De actuele schakel of foutreden staat bij elk asset; na opslaan wordt de probleemlijst vernieuwd. Grote groepen tonen maximaal twintig assetkaarten per pagina, met zoeken binnen de groep. Losse meldingen zonder registerkoppeling openen de bestaande assetkoppeling in Impactregels.

**Matrixregels bekijken** filtert op de weg van het probleem. **Ontbrekende grensregel toevoegen** vult alleen bekende weg, VC en LI/RE in, met lege grenzen. Asset-HMP's worden niet als schakelgrenzen aangenomen. De matrixinvoer blijft tijdens assetcorrecties en sluiten/heropenen behouden zolang dezelfde matrixbron actief is; pas matrixopslaan vervangt de effectieve grenzen. Bediening en resultaatmelding blijven bovenaan zichtbaar. Nul als wegnummer, A0, N0 of RW/PW000 betekent een onbekende weg, geen snelweg A0. Een herkenbaar registerasset met naam of entity-id blijft behouden voor correctie; HM/HMP nul blijft geldig. De oorspronkelijke bronrij blijft intact.

De effectieve `rijen`, optionele `oorspronkelijkeRijen` en `aangepastOp` gaan mee in de zelfstandige `netwerkschakels`-exportsectie. Oorspronkelijke rijen worden eenmalig bewaard en bij herstel ook gevalideerd. **Oorspronkelijke Excel-grenzen herstellen** verwijdert lokale correcties en rekent opnieuw. Opslaan maakt afhankelijke analyses en prognoses ongeldig en meldt de wijziging aan de schil voor lokale opslag. De originele XLSX op schijf verandert niet. De dialoog bouwt de controles alleen bij openen en opslaan, zonder achtergrondpolling.

`doorrekenen` behoudt foutimpact en ketenformules maar aggregeert per schakel en rijrichting. De noemers komen uit unieke operationele registerassets binnen die grenzen en richting, apart voor MSI, camera, LUS en DRIP. Groepen zonder open storing zijn inbegrepen zodra register en actuele bron beschikbaar zijn. Zonder passend typeareaal blijft de bestaande geschatte-noemerterugval herkenbaar; zonder register of actuele analyse wordt in het schakeloverzicht geen 100 procent aangenomen. Herkende meldingen zonder passende foutregel worden aan hun schakel gekoppeld en apart geteld; bij zo’n gat blijven de schakelpercentages onbekend, zonder een gezond resultaat te tonen. Netwerk- en schakelgemiddelden volgen hetzelfde bestaande MSI-areaalgewicht. Deze percentageregels zijn modeluitkomsten en bewijzen geen volledige brondekking; het bestaande brondekkingsmodel van de hoofdschil blijft leidend voor de landelijke dienstbanden.

Netwerkschakels toont alle codes uit de matrix met HMP, status, actief areaal, open storingen, vier dienstpercentages en kosten per brondag. Details blijven per richting bereikbaar. NDW gebruikt één meting op dezelfde weg en rijrichting bij de representatieve zwaarste storing; buiten de schakel kan een ruimere NDW-koppeling ontstaan en blijft die als scenario controleerbaar. Er worden geen meetpunten opgeteld. Het trajectmodel krijgt de HMP-lengte van de schakel als standaard; expliciete verkeersinvoer gaat voor. Kosten blijven een som van scenario’s met zichtbare ontbrekende waarden en overlaprisico. Sleutels bevatten schakelcode, naam, grenzen, VC en rijrichting, zodat oude wegscenario’s en scenario’s met gewijzigde grenzen niet automatisch aan de nieuwe schakel worden toegekend.

Historie, MSI-leeftijdscohorten, MSI-toekomstgroepen, memoscope, rekenverslag en verkeerskosten volgen dezelfde schakelgroepen. U-routes en werkzaamheden behouden hun bestaande asset- en geografische koppeling en contextwerking; de matrix voegt geen verkeerskundig effect toe. De voorlopige bronstatus wordt getoond en wordt niet als NWB-validatie opgewaardeerd. Er worden geen operationele brongegevens in Git gepubliceerd.

### Gezamenlijk DVM-bronoverzicht

Bronbeheer toont twee afgeleide kaarten: DVM open storingen en DVM storingshistorie. Camera, Detectielus, MSI en DRIP zijn DVM-assettypen. De kaarten lezen de bestaande live- en historie-inspecties en de unieke DRIP-incidenten; ze voeren geen nieuwe storingen in en starten geen tweede doorrekening. Signaalgevers totaal levert open en historische MSI-/Detectielusregels. DRIP totaal levert de eigen historie plus de aantoonbaar open selectie. Expliciete CAM-typehints in een MTM-bestand blijven CAM; zonder cameraregels wordt geen camerahistorie aangenomen. Losse bronuploads blijven beschikbaar als aanvullende of alternatieve invoer. De afgeleide kaarten hebben geen verwijderknop, omdat verwijderen via de oorspronkelijke bronkaart verloopt.

Oudere MTM-bundels kunnen detectorregels met `meenemen:false` uitsluiten. `signaalgeverOpenActief()` neemt zulke aantoonbare LUS-regels weer mee wanneer ze nog open staan. De bekende LUS-codes 1006, 1007 en 5004 geven bij ontbrekende typewoorden dezelfde typehint; code 1005 blijft zonder detectoraanwijzing MSI. Onbekende detectorcodes blijven zichtbaar zonder verzonnen impact. De bestaande percentages en `OBJ_BRON.detectie = LUS` blijven leidend. Een expliciete camera wordt niet door een LUS-code overschreven. SYSTEEM en overige categorieën blijven herkenbaar als SYSTEEM of ONBEKEND. Open uitgesloten bronregels blijven zichtbaar met `bron_uitgesloten`, zonder toegepaste impact. Gesloten alarmepisodes blijven in de historie, ook wanneer zij niet in de classificatietabel voorkomen.

Een vervangende MTM-bundel of losse actuele lijst behoudt de onafhankelijke virtuele DRIP-bron uit DRIP totaal. Beide laadvolgordes, herhaald vervangen en een MTM-bestand zonder open alarmen behouden de DRIP-selectie zonder haar dubbel op te nemen. Historie blijft buiten het live dashboard. `tests/dvm-totaal-stromen.test.js` voert hiervoor de echte runtimepatches, omzetters, broninspectie en doorrekening uit.

### Losse signaalgeverimporter vanaf 2.59 / DVM 139

`site/signaalgever-importer.html` is een aparte pagina met één VC per scan, een standaard begin op 1 januari 2025 en een einddatum vandaag. Er is geen All Assets nodig. Een verborgen DVM-frame levert uitsluitend de gedeelde parser, normalisatie en `sbSignaalgeverSynchroniseer`. De importer verwerkt de gekozen bestanden per kalenderdag, met voortgang en Stoppen tussen bestandslezingen. De bronselectie is dezelfde gesnoeide maptraversal als in Bronbeheer. De pagina wordt via de website geladen; het is geen zelfstandig offline bestand.

`site/core/signaalgever-import.js` beheert de bewaartermijn en VC-overdracht. Open en onzekere meldingen blijven onbeperkt, inclusief hun historische incidentrijen. Alleen een bewezen of afgeleid afgesloten melding met een sluitdatum respectievelijk einde herstelvenster vóór de grens van één kalenderjaar wordt verwijderd. Een ontbrekende sluitdatum, oude legacyregel, starttijd of `tot` is geen verwijdergrond. De exacte kalendergrens blijft bewaard; een schrikkeldag valt terug op de laatste geldige dag van de maand. De retentie loopt per dagbatch en nogmaals bij downloaden.

De importer bewaart zijn stand in de afzonderlijke database `bidash-signaalgever-importer`. `createWorkspaceStorage(databaseName)` levert dezelfde transactionele blokopslag en een eigen schrijfqueue; de bestaande exportfuncties van `storage.js` gebruiken ongewijzigd `bidash-integraal`. Alleen na een volledige geslaagde scan van de gekozen VC wordt de bevestigde importerstand vervangen. Een lees-/parsefout of Stoppen vóór opslag laat de vorige stand intact. Gebruik één importer-tab tegelijk. Maak na iedere VC een handmatige JSON-back-up; er is geen accountsynchronisatie.

De selectieve DVM-totaaluitvoer draagt `signaalgeverImport: {versie: 1, vcs: [...]}`. Zowel `model.mergeImport` als `leesSignaalgeverTotaalBestand` valideert de scope en de per-VC-peildatum. Alleen de aangeleverde VC's worden bijgewerkt; andere MTM-VC's, CAM/DRIP-bronnen en overige DVM-onderdelen blijven behouden. Een oudere peildatum dan de geladen VC wordt geweigerd. Reguliere totaalexports behouden hun bestaande vervangingsgedrag. Het tijdelijke overdrachtskenmerk wordt niet meegenomen naar de samengevoegde dashboardstand of een gewone integrale back-up. Bronpeildata, snapshotdekking en bewaartermijn per VC blijven wel bewaard. Een afzonderlijke overdracht kan weer als basis worden gebruikt.

De importer herstelt geen ontbrekende bestanden en verruimt de bestaande sluitregels niet. Onherkenbare of onvolledige bronnen stoppen de scan in plaats van stil te worden overgeslagen. Alleen de structuur en aangetroffen waarnemingen zijn controleerbaar. De beginselectie vanaf 2025 kan oudere open meldingen bevatten als ze in die snapshots aanwezig zijn; zonder bronwaarneming of basisbestand is zo'n melding niet te reconstrueren. De daadwerkelijke meerjarige netwerksnelheid en inhoudelijke brondekking zijn niet vastgesteld. Zie [release notes 2.59](release-notes-2026-10-15-losse-signaalgeverimporter-259.md) voor controles en beperkingen.


De via de losse importer gereconcilieerde MTM-stand krijgt `bronbeheer.signaalgeverTotaal.importerBewaren`. Deze stand en haar manifest blijven ook in de lokale dashboardopslag behouden, zodat herladen de ingevoerde VC's niet verwijdert. De bestaande compacte opslag blijft voor reguliere MTM-map-/totaalbronnen zonder dit kenmerk gelden. Na samenvoegen bewaart de uitzondering de gezamenlijke MTM-stand, inclusief eerder geladen andere VC's. De gesplitste opslag uit 2.58 blijft de grote records afhandelen.

### Signaalgevers uit een map lezen

Naast het gecombineerde JSON-bestand leest **Signaalgevers uit map (MTM)** de ruwe storinglijsten onder `mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>`. De bestaande mapkiezer beperkt de traversal tot de gekozen VC’s en periode. Vanaf 2.53 / DVM 133 is de huidige werkruimte automatisch de updatebasis. `sbSignaalgeverStand()` selecteert MTM/MSI/LUS-rijen en houdt overige bronrijen met hun bronidentiteit apart. Een optioneel basisbestand mag zowel `datasets.mtm` als een DVM-totaal bevatten. `sbSignaalgeverCombineerStand()` kiest per VC de nieuwste open stand en voegt historie samen. De huidige stand wint bij een gelijke peildatum.

`sbSignaalgeverSynchroniseer()` verwerkt uitsluitend VC’s met daadwerkelijk gelezen, herkenbare momentopnamen. De laatst bekende complete momentopname van die VC vormt het aansluitpunt voor nieuwe bestanden. Het exacte watermerk, inclusief tijd, wordt ook bewaard als die VC nul open alarmen heeft. Een oudere mapsnede vult historie aan zonder de actuele open stand of het watermerk terug te zetten. Een leesfout, onvolledige alarmregel of tegenstrijdige dubbele momentopname breekt vóór bronmutatie af. Alleen een herkenbare lege MTM-lijst met een gedateerde header geldt als nul open alarmen; een leeg of onleesbaar bestand is geen herstelbewijs.

Nieuwe incidenten worden samengevoegd op canonieke VC, type, locatie inclusief zijbaan, begintijd, rijstrook/eenheid, foutcode en herkenbaar lamp-/detectornummer. Een opnieuw gegenereerd incident-ID telt niet als nieuw incident. De sleutel reist met de rij mee als `_mtmSleutel`. Herhaald of overlappend inlezen ververst dezelfde open of historische rij. Een bestaande historische open episode wordt bij verdwijnen bijgewerkt; ook een korte verdwenen MSI- of LUS-melding komt eenmaal in de historie. De laatste bewezen aanwezigheid blijft de historische eindkolom. `_mtmEindeBovengrens` bevat uitsluitend bij voldoende korte snapshotafstand het volgende afwezige meetmoment. Een datagat krijgt `einde_onzeker_datagat`, geen bewezen herstel. Deze afgeleide duren zijn niet betrouwbaar voor herstelduurkalibratie.

Oude light-historie met alleen locatie en start bevat onvoldoende kenmerken om rijstroken of foutcodes terug te vinden. Die regels blijven in hun oorspronkelijke aantallen behouden. Identieke oude basisbestanden worden multisetgewijs samengevoegd; de app verzint geen ontbrekende incidentidentiteit. Overlap van zo’n verliesarme oude regel met een rijkere nieuwe alarmregel kan daarom niet betrouwbaar worden vastgesteld.

`pasSignaalgeverBundelToe(...,{bijwerken:true})` activeert het gereconcilieerde bronbeeld en behoudt andere historische en actuele bronnen, waaronder camera en de onafhankelijke DRIP-selectie. De algemene landelijke live-snapshotpatch sluit deze MTM-rijen niet nogmaals af. De bestaande live doorrekening en uitgestelde prognose blijven eigenaar van de uitkomsten. De mapdialoog en eindmelding tonen per VC het verwerkte tijdstip. **Download bijgewerkte JSON** levert een selectieve DVM-totaalexport met storingsrijen, bronidentiteit en `bronbeheer.signaalgeverTotaal.laatstePerVc`; die download kan via Data & export, Signaalgevers totaal of als volgende mapbasis worden geladen. De zware signaalgeverrijen blijven zoals voorheen buiten de compacte automatische opslag. Maak voor herstel na herladen een handmatige export.

### MTM-BSS-gebeurtenissen vanaf 2.60 / DVM 140

`site/engines/dvm-mtm-bss.js` is de gedeelde invoerroute voor Signaalgevers uit map en de losse importer. Een bestand met `Registreer BSS` en `Hef op BSS` wordt als gebeurtenislog gelezen, met BSS_ID, foutcode/omschrijving, locatie en brontijd. Een bestaande verticale tabel blijft via `sbSignaalgeverSnapshot` werken. De oude lezer herkende alleen die tabelregels en las een BSS-log daardoor niet. Verschillende bestandsnamen zijn op zichzelf geen bewijs van een andere indeling; de inhoud bepaalt de route.

Registraties openen een incident. Een passende Hef op BSS sluit expliciet met `HERSTELD_BEVESTIGD`. De koppeling onderscheidt VC, BSS_ID, foutcode, locatie, eenheid en bronstart. Twee IDs op dezelfde locatie en in dezelfde minuut worden afzonderlijk bewaard. Een niet genoemde storing wordt nooit gesloten door afwezigheid in een log. Een herstel zonder bekende registratie blijft als afgesloten melding met `start_onbekend` en onbekende duur bewaard. Bij tijdstempels zonder seconden staat `tijdprecisie` op minuut; gelijke minuten mogen duur nul opleveren, maar zijn geen bewijs van werkelijk nul seconden uitval. De duur blijft daarom als onzeker gemarkeerd.

Een tabel en log volgen één chronologische verwerkingsroute. Dezelfde ID en bronstart verbinden een tabelmelding aan de BSS-episode. Expliciet herstel vervangt afgeleid herstel van hetzelfde incident. Herhaald lezen en JSON-herstel maken geen extra incidenten. Onbekende of onvolledige gebeurtenisregels blokkeren toepassing en noemen de bestandsnaam en het regelnummer. Er worden geen ongekende regels overgeslagen.

`bronbeheer.signaalgeverTotaal.bssBronnen` bewaart per VC en bestand de gelezen en verantwoorde regels, registraties en herstelmeldingen. De bronbalans is administratief; zij bewijst niet dat alle bronbestanden zijn aangeleverd. Een log zonder een volledige actuele tabel als basis bewijst geen volledige openstand. `snapshotDekking` onderscheidt daarom de gecontroleerde logstructuur van volledige actuele dekking. Voor reeds vóór de leesperiode open storingen is een openstaande-storingenlijst of basisbestand nodig, tenzij een registratie alsnog in de aangeleverde logs voorkomt. Een latere bevestiging in een tabel vernieuwt de waarneming; gebeurtenissen over andere assets doen dat niet.

De standalone gebruikt de kalenderjaargrens al tijdens het verwerken van oude gesloten gebeurtenissen, zodat zulke rijen niet eerst volledig worden opgebouwd. Open meldingen blijven behouden. Ook de BSS-route in Bronbeheer gebruikt bij logs deze jaargrens; de bestaande tabelroute houdt haar bestaande historiegedrag. De geselecteerde JSON-overdracht en de gewone handmatige back-up bewaren bronmanifest, expliciet herstel, onbekende start, bronprecisie en bewaarde incidenten. Het lokale opslaggedrag van de losse importer blijft gelden.

Controles staan in `tests/mtm-bss.test.js` en `tests/mtm-bss-browser.cjs`. De browsercontrole gebruikt exact dezelfde synthetische bronbestanden via beide schermen en vergelijkt de resulterende incidenten, daarna Signaalgevers totaal en de totaalherimport. Het aangeleverde BSS-bestand is aanvullend lokaal gecontroleerd tegen een onafhankelijke reconstructie en via de echte standalonepagina, inclusief bewaartermijn en herladen. Dat bestand en operationele tellingen staan niet in Git. De volledige meerjarige netwerkmap is niet getest; RAM en totale browserquota blijven grenzen. Een technisch volledige parse is geen onafhankelijke bewijsvoering over volledige bronlevering.

### Storingslevenscyclus vanaf 2.56 / DVM 136

`site/core/incident-lifecycle.js` is het gedeelde toestandscontract voor engine, adapters en schermen. `eerste_gezien` is de eerste werkelijke waarneming, `laatste_gezien` de laatste aanwezigheid, `bron_peildatum` de laatst verwerkte bronstand en `hersteld_op` uitsluitend een expliciete herstelmelding. De door de bron gemelde start blijft afzonderlijk als `van`/`bron_start` staan. Een oude start maakt een recent opnieuw waargenomen storing niet verouderd. Importtijd en bestandswijzigingsdatum bewijzen geen waarneming. `tot` bij open MTM-regels is een waarnemingsgrens; `tot_betekenis` maakt dat expliciet. Ontbrekende oude bewijsvelden worden niet verzonnen.

| Toestand | Bewijs en verwerking |
| --- | --- |
| `OPEN_BEVESTIGD` | Aanwezig in de bronsnapshot; geen garantie buiten dat meetmoment |
| `OPEN_VEROUDERD` | Laatste bevestiging ouder dan standaard 48 uur |
| `VERDWENEN_UIT_SNAPSHOT` | Eenmaal afwezig in een structureel volledige MTM-snapshot; blijft zichtbaar |
| `ONBEKEND_DOOR_BRONGAT` | Onvolledige bron, tijdgat, verdachte volumedaling of los verdwenen record; blijft zichtbaar |
| `HERSTELD_AFGELEID` | Minimaal twee opeenvolgende volledige MTM-snapshots zonder melding; alleen herstelvenster, geen exact `hersteld_op` |
| `HERSTELD_BEVESTIGD` | Expliciete passende herstelmelding met tijdstip, bijvoorbeeld CDMS OK/AAN |

MTM bewaakt per VC bronbestand, peildatum, vorige peildatum, regelaantal, unieke incidenten, dubbele bronrijen, volledigheid en reden. Een headerdatum en herkenbare complete alarmregels zijn vereist voor structurele volledigheid. Een opgegeven regelaantal moet kloppen. Een expliciete gedeeltelijk-markering, een tijdgat groter dan standaard zes uur of een daling van minimaal 70 procent bij minimaal twintig vorige meldingen blokkeert afgeleid sluiten en zet de afwezigheidsteller terug. Daarna zijn opnieuw twee volledige opeenvolgende snapshots nodig. De 48- en zesuursgrenzen zijn instelbaar bij Bronbewaking; `RULES.cfg.storingsBewaking` reist mee met Parameters. Dit is controle van de aangeleverde structuur en samenhang, geen onafhankelijk bewijs dat de bronsystemen alles hebben geleverd.

De MTM-identiteit gebruikt canonieke VC, type, weg, zijde/hectoletter, HMP, individuele eenheid, bronstart, exacte code en detailnummer. Zij blijft stabiel bij opnieuw genummerde bronevents. Codes worden niet zonder inhoudelijk beheerde codetabel samengevoegd tot een familie. Ontbrekende locatievelden worden als onvolledige identiteit gemarkeerd en behouden. Oude light-historie kan niet achteraf betrouwbaar van incident-ID worden voorzien.

`bronbeheer.signaalgeverTotaal.snapshotDekking` bewaart de laatste dekking per VC; `levenscyclusAudit` controleert de bronrijbalans (unieke plus dubbele rijen), actuele incidenten zonder historie en een toestand per historisch incident. Een sluitende administratieve balans bewijst geen volledige bronlevering. Legacyregels zonder betrouwbare sleutel houden de audit expliciet niet sluitend. De historie bevat de laatste toestand van ieder bekend incident, inclusief nog open incidenten; historie en actuele selectie mogen dus niet worden opgeteld als twee onafhankelijke populaties. De schema-uitleg reist mee in `bronbeheer.levenscyclus`.

CDMS bewaart afzonderlijke status-/powercondities en expliciete herstelmeldingen, ook als een scan uitsluitend OK/AAN bevat. Een volgende mapsnede kan een eerder open incident herstellen bij dezelfde canonieke VC, DRIP, conditie en compatibele locatie. Zij sluit geen andere conditie, andere VC of later begonnen incident. Korte gesloten episodes blijven behouden. `dripHistorie.sources` bewaart incidenten en herstelbewijs per bron; `dripHistorie.incidenten` is de effectieve ontdubbelde selectie. Beide worden geëxporteerd; bij herstel wordt de effectieve selectie uit de bronnen opgebouwd. Een onleesbaar mapbestand breekt de import af vóór toepassing.

De gezamenlijke lijst toont toestand, laatste waarneming en bronpeildatum met filters per toestand en type. Tellingen onderscheiden technische meldingen, unieke gekoppelde assets of complete fysieke posities en meldingen zonder unieke assetidentiteit. Systeem- en onbekende meldingen worden niet als fysieke MSI geteld. Onzekere meldingen geven een onbekende assettoestand en blokkeren een bewezen exact landelijk percentage voor hun type. Detailwaarden blijven een bronmomentopname. In het standaard actuele cap-model wordt de zwaarste gelijktijdige bijdrage per fysiek asset gebruikt; meerdere foutcodes blijven afzonderlijke meldingen, maar vermenigvuldigen fysieke uitval niet. Het expliciete stapelmodel en historische rekenmodel blijven bestaan.

Deze wijziging vult ontbrekende bronbestanden of oude herstelmeldingen niet aan. Voor een volledige inhoudelijke reconstructie blijven de oorspronkelijke opeenvolgende bronnen nodig. Het genoemde exportbestand van 14 oktober is niet zelfstandig gecontroleerd. `tests/incident-lifecycle.test.js` en de browserregressies toetsen synthetische gebeurtenissen, behoud, herimport, bronfouten en de schermweergave.

### DRIP-storingshistorie: totaal-JSON en CDMS-map

De DRIP-storingshistorie werkt sinds DVM 98 op precies dezelfde manier als de signaalgevers, met twee eigen bronkaarten in plaats van de vroegere losse XLSX/CSV DRIP-historie-upload (die is verwijderd). **DRIP totaal (JSON)** leest één bestand met `datasets.drip` (DRIP-`episodes` en geclassificeerde `storingen`); **DRIP uit map (CDMS)** leest de ruwe DRIP-logs onder `cdms/<vc>/log/<jaar>/<maand>/<dag>` rechtstreeks. Beide leiden tot dezelfde `DRIP_HIST_STATE`-incidenten en dus dezelfde koppeling, prognose en open-DRIP-afleiding.

`dripDatasetNaarBron()` in `dvm-3.js` zet de `datasets.drip`-records om naar de incidentvorm die `normaliseerDripHistorieRij()` al oplevert (asset/code, vc, weg/richting/hm, start/einde, duur, classificatie). De geclassificeerde `storingen` voeden de rate en duurverdeling; open episodes (`kwaliteitsstatus: "open"` of zonder eindtijd) gaan als open incidenten mee zodat `deriveOpenDripRows()` ze als actuele DRIP-melding oppikt. `pasDripBundelToe()` kent twee expliciete modi. De gewone knop **Bron vervangen** bouwt `DRIP_HIST_STATE` opnieuw op uit één bron. De extra knop **Voeg JSON toe** gebruikt modus `toevoegen`: bestaande `DRIP_HIST_STATE.sources` blijven staan, het nieuwe JSON-bestand krijgt een eigen bronkey en exact overlappende incidenten worden met `dripIncidentSleutel()` ontdubbeld. Daarna wordt `herbouwDripHistorie()` één keer over het samengestelde bronbeeld uitgevoerd; die functie legt via `koppelDripHistorieAanAreaal()` opnieuw de koppeling aan het DRIP-areaal (eerst op CDMS-code, anders op weg/richting/hm) en de afleiding van open DRIP's uit historie loopt daar ongewijzigd achteraan. De map-poort in `dvm-storingsbundelaar.js` (`sbDripEventsUitTekst()`, `sbBouwDripBundel()`) is een BiDash-poort van dezelfde lokale bundelaar: tab-gescheiden CDMS-logregels (status URGENT/OK en power UIT/AAN) worden per DRIP tot episodes gereconstrueerd en met dezelfde `sbClassificeer()` als MTM langdurig/intermitterend gemaakt. De maptraversal (`sgVolgendeCtxDrip()`) snoeit net als bij MTM alles buiten `cdms/<gekozen vc>/log/<gekozen periode>`; een basisbestand werkt alleen de gekozen regio's bij (`sbCombineerMetDripBasis()`). Omdat het totale aantal mappen tijdens deze traversal nog niet bekend is, toont de UI daar een onbepaalde voortgang met aantallen mappen, gevonden bestanden en verstreken tijd. `sbMetWerkers()` begrenst zowel de directorylezingen per boomniveau als de latere logbestandslezingen tot maximaal zes gelijktijdige acties. Zodra de bestandslijst bekend is, toont de UI bovendien de bestandenteller, herkende gebeurtenissen, leesfouten, verstreken tijd en een resterende-tijdschatting. De bronnen dragen een `_dripTotaal`-vlag en tonen zich in Datasetbeheer onder de eigen kaart "DRIP totaal (JSON)"; het onderliggende `DRIP_HIST_STATE` en de DRIP Monte Carlo blijven ongewijzigd. De losse Windwaarschuwing- en RIA4-selectielijsten en het uit het assetregister afgeleide DRIP-areaal (`DRIP_STATE`) blijven bestaan.

**DRIP uit map (CDMS)** gebruikt vanaf DVM 109 altijd de toevoegmodus van `pasDripBundelToe()`. De zojuist gelezen mapsnede wordt als afzonderlijke DRIP-bron aan `DRIP_HIST_STATE.sources` toegevoegd; een reeds geladen DRIP totaal blijft staan. De bronnaam bevat regio en, indien gekozen, periode zodat opeenvolgende perioden naast elkaar kunnen bestaan. Vanaf 2.56 behoudt ook een herhaling met dezelfde bronnaam eerdere incidenten en expliciete herstelmeldingen; een nieuwe mapsnede mag dat bewijs niet verwijderen. Een optioneel basisbestand in de mapdialoog is alleen voor de knop `Download bijgewerkte JSON` en bepaalt niet meer de staat in de huidige werkruimte.

Datasetbeheer toont op de kaarten **Signaalgevers totaal** en **DRIP totaal** geen doorlopende lijst met alle ingelezen bestanden meer. De inhoudelijke tellingen blijven staan. `regioUpdatesHtml()` maakt per verkeerscentrale één regel met de nieuwste bekende brondatum, zet de regiocode vet en toont daarnaast `Laatste update <datum>`. `laatstePerVc` wordt bij het opbouwen van de bronstatus met de hoogste datum per regio gevuld. De bijbehorende CSS staat in `dvm.html` onder `dataset-meta-section`, `dataset-region-list` en `dataset-region-row`. De bestandsnamen en bronhistorie blijven in de bronstatus en exports beschikbaar; alleen de kaartweergave is compacter. Dit verandert geen brondata of rekenlogica.

De hoofdapp activeert `site/core/load-progress.js` voordat `app.js` de bestandkeuze verwerkt. Voor de gewone Data & export-route wordt `File.text()` alleen tijdens een actieve importsessie vervangen door een `FileReader`-lezing met dezelfde tekstuitkomst en echte bytevoortgang. Na het leesmoment laat de module eerst een browserpaint plaatsvinden voordat de bestaande JSON- of XML-verwerking verdergaat. Dit voorkomt geen zware synchrone parse, maar zorgt dat de gebruiker vóór zo'n parse ziet welk bestand en welke fase actief is.

Onder **Data & export** kan de gebruiker met **Laad laatste stand** een lokaal met
OneDrive gesynchroniseerde SharePoint-map koppelen. De moderne mapkiezer bewaart
de `FileSystemDirectoryHandle` onder een aparte sleutel in dezelfde IndexedDB; de
inhoud van de map wordt niet gekopieerd naar de werkruimte. Bij iedere klik leest
`latest-snapshot.js` alleen de JSON-bestanden direct in die map, negeert ongeldige
of andersoortige JSON en kiest de nieuwste ondersteunde `BiDash-integraal`- of
`DVM-dienstimpact-totaal`-momentopname. De datum in `opgeslagen` heeft voorrang,
daarna de ISO-datum in de bestandsnaam en ten slotte de wijzigingsdatum van het
bestand. De gekozen JSON gaat door dezelfde importvoorvertoning, validatie,
deelimport en transactionele opslag als een handmatig gekozen bestand. Er wordt
dus niets stilzwijgend toegepast. In browsers zonder blijvende mapkoppeling geldt
een mapupload als terugval en moet de map per keer opnieuw worden gekozen.

De integrale, DVM-, BI- en planningexports uit **Data & export** blijven via de
gewone browserdownload beschikbaar. Als dezelfde map is gekoppeld, vraagt BiDash
zo nodig schrijfrechten en schrijft het exportbestand daarnaast met datum in de
bestandsnaam naar die map. `createWritable()` vervangt een bestand met dezelfde
naam pas bij het sluiten van de schrijfactie. Mislukt de mapschrijfactie, dan blijft
de al gestarte browserdownload beschikbaar en meldt BiDash het verschil zichtbaar.
Andere exports, zoals één expertduiding of een auditrapport, vallen buiten deze
automatische mapschrijfactie.

Deze functie gebruikt geen Microsoft Graph en doet geen netwerkverzoek. OneDrive
verzorgt de synchronisatie buiten BiDash; de Content Security Policy blijft
`connect-src 'none'`. Een directe SharePoint-koppeling zou afzonderlijke RWS
Entra-appregistratie, toestemming en een gewijzigd beveiligingscontract vereisen.

DVM had al eigen fasen en percentages via `zetImportVoortgang()`. `site/core/import-progress-bridge.js` geeft die status via `hub:import-progress` door aan de hoofdapp. De bronimport zelf blijft eigenaar van zijn percentages; de hub verzint geen schijnnauwkeurigheid wanneer alleen bekend is dat een parse of moduleherstel bezig is. In dat geval wordt een onbepaalde geanimeerde balk getoond.

De hub maakt eerst een importvoorstel. Bij uitvoeren herstelt `restore()` eerst BI,
dan planning, dan DVM. Planning gebruikt de oorspronkelijke XML-importer voor
mapping en afgeleide datums. DVM heeft een assetregister nodig voor herberekening.
Een aanvullende DVM-selectie kan het al aanwezige register gebruiken.

Pas na geslaagd herstel en `capture()` wordt de nieuwe werkruimte opgeslagen.
Bij een mislukte import blijft de vorige opgeslagen werkruimte behouden;
`failedImport` blokkeert verdere opslag/export van de deels gewijzigde runtime.
Herlaad dan om de opgeslagen toestand terug te zetten. Dit is geen volledige
rollback van ieder al gewijzigd moduleobject in het geheugen.

### NDW-verkeersbronnen

Een locatiebevestiging mag het geopende verkeersformulier niet opnieuw opbouwen. `ndw69Confirm()` ververst de bevestigingsstatus en overige overzichten, maar houdt nog niet opgeslagen hinderuren, extra minuten en onderbouwing intact. `sc67Bewaar()` rekent daarna met de opgeslagen invoer. Het kostenvenster benoemt met `sc67OntbrekendeInvoer()` welke waarden of onderbouwing ontbreken. Alleen bevestigen verandert geen verkeerswaarde en levert geen nieuw kostenbedrag op. De numerieke regressie controleert dat gewijzigde hinderuren na bevestigen en opslaan werkelijk doorwerken.

De telling van beschikbare of gebruikte intensiteiten staat los van de locatiebevestiging. `ndw69Coverage()` telt gekoppeld, bevestigd, nog te controleren, NDW-gebruik uitgezet en ontbrekende metingen uit de actuele wegdelen. De bronkaart en het NDW-overzicht delen deze telling; de DVM-adapter levert dezelfde bevestigingsstatus per wegdeel aan de schil. Verkeerskosten toont bevestigd en nog te controleren naast berekenbare wegdelen. Een bevestiging verandert geen intensiteit of kostenformule. Een andere meetlocatie of verkeersbron maakt een eerdere bevestiging ongeldig. `ndw69Write()` ververst de zichtbare bronkaart en kostenoverzichten en meldt de wijziging expliciet aan de bestaande opslagqueue. De schil ververst de zichtbare Verkeerskosten direct bij dat bericht. De bestaande herstelbeperking voor NDW in grote werkruimten blijft gelden: deze wijziging herstelt niet het verlies van verkeerscontext bij uitgesteld herstel. `tests/ndw-confirmation.test.js` controleert bevestigen, opslaan, opnieuw kiezen, parameters exporteren, bronkaart, adapter en directe schilverversing met synthetische gegevens.

DVM blijft eigenaar van de NDW-verkeerssnapshot in `RULES.kosten.ndw69Snapshot`. Bronbeheer toont een kaart voor meetlocaties en een voor trafficspeed/verkeerskosten. De twee expliciete uploads controleren de bronsoort op XML-inhoud. De configuratie wordt direct streaming verwerkt en in de sessiecache bewaard. Verkeersmetingen worden gekoppeld op meetlocatie-ID en meetindex; categorieën worden niet nogmaals bij anyVehicle-rijstrooktotalen geteld. Volgende trafficspeeduploads hergebruiken de verwerkte configuratie. Een mislukte parse laat de configuratie en vorige geldige snapshot beschikbaar. Onvolledige meetblokken geven een fout; parallelle NDW-uploads worden geweigerd zolang een upload loopt.

De voortgang loopt via `zetImportVoortgang` en de bestaande brug naar de hoofdschil. Na ieder blok van 250 locaties geeft de parser de browser gelegenheid de status te tekenen. Losse bronbestanden en de configuratiecache blijven uitsluitend in de huidige runtime; alleen de gecombineerde snapshot wordt met de kostenparameters opgeslagen en geëxporteerd. Na refresh wordt die oude snapshot niet automatisch actief. Bestaande meervoudige XML-, gecombineerde DATEX II v3- en JSON/HTML-exportuploads blijven beschikbaar.

`tests/ndw-import.cjs` verifieert beide laadvolgordes, de twee echte broninputs, hergebruik, herstel na een afgebroken verkeersbestand, behoud van de vorige geldige meting, rijstrooktotalen en de bestaande meervoudige upload met synthetische bronnen. Het script hoort bij `npm run test:browser`; `npm test` controleert de overige bestaande contracten.

Vanaf 2.47 biedt Bronbeheer op beide NDW-kaarten **Haal laatste NDW op**. Dezelfde knop staat in het verkeerskostenoverzicht. De Pages-workflow haalt de vaste publieke NDW-feed `snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz` op bij een publicatie en volgens een vijfminutenschema. NDW levert bij de onderzochte bron geen CORS-toestemming voor rechtstreeks lezen vanuit de dashboardorigin. Er wordt geen derdepartijproxy of accounttoken in de browser toegevoegd. `scripts/fetch-ndw.py` leest uitsluitend deze openbare feed en zo nodig de vorige openbare kopie. Alleen het Pages-artifact krijgt de gzip en `ndw/latest.json`; geen NDW-feed in Git en geen gebruikersdata naar de workflow. Het artifact gebruikt een inhoudsafhankelijke bestandsnaam en SHA-256. Downloadlimiet 25 MiB, XML-limiet 256 MiB; documenttypes en entiteiten worden geweigerd.

De workflow valideert gzip, volledige XML, configuratie, meetgegevens en publicatietijd. Bij een fout wordt een vorige openbare kopie alleen behouden met geldige hash en een publicatietijd van maximaal dertig minuten geleden; anders krijgt het manifest status niet beschikbaar. Site-publicatie blijft mogelijk bij een NDW-storing. De knop leest het manifest en de bijbehorende gzip met cache uit, GET, zonder cookies of referrer. Ze controleert vaste bron, bestandsnaam, omvang, hash, meettijd en ouderdom vóór het toepassen. De knop weigert een kopie ouder dan dertig minuten en vervangt geen nieuwere automatisch geladen meting door een oudere. Dubbele NDW-acties worden geblokkeerd. Een download- of parsefout behoudt de vorige geladen snapshot.

Bij automatisch ophalen wordt de gecombineerde DATEX II v3-feed streaming verwerkt, met overgenomen XML-namespaces en korte browserpauzes tussen blokken. Locaties en metingen blijven gekoppeld via de bestaande NDW-rekenketen. `online` in de verkeerssnapshot bewaart oorspronkelijke NDW-URL, openbare ophaaltijd, lokale laadtijd, geplande verversing en de markering dat een vorige kopie is behouden. Bronkaarten tonen meettijd en ouderdom. Deze metadata gaat mee met de bestaande parameter-/totaalexport. Een snapshot bevat meetlocaties, maar is geen sessiecache voor een latere losse trafficspeedupload; daarvoor blijft de losse configuratie-upload bestaan.

Vijf minuten is een geplande verversing, geen maximale gegarandeerde vertraging. GitHub Actions kan geplande runs vertragen of overslaan en schakelt in een publieke repository schema's uit na zestig dagen zonder repositoryactiviteit. De website toont de werkelijke tijd en weigert te oude kopieën. Een beheerder kan dezelfde Pages-workflow handmatig starten. De eerste openbare kopie is pas na merge en geslaagde Pages-publicatie beschikbaar. De publicatieketen op GitHub is vóór merge nog niet als live NDW-verversing getest. De browser zelf start geen achtergrondpolling. Het NDW-meetmoment blijft apart van de storingspeildatum; bestaande waarschuwingen voor een andere meetdag en de scenarioaannames blijven gelden.

De NDW-index en de zoekroute voor wegdelen gebruiken dezelfde normalisatie van weg en richting. `A015`, `A15` en een kaal `15` worden `A15`; `N15` blijft een afzonderlijke weg. Rechts/R/RE en links/L/LI volgen de bestaande assetnormalisatie. Alle actuele wegdelen blijven in de NDW- en kostenoverzichten. Kandidaten blijven beperkt tot dezelfde weg en rijrichting, zonder vaste afstandsgrens. De dichtstbijzijnde geldige intensiteit bij de representatieve zwaarste storing wordt voorgesteld; een afstand boven één kilometer is zichtbaar als ruimere koppeling, inclusief afstand en controle van lokale op- en afritten. Er wordt geen nieuw verkeersvolume afgeleid of bij elkaar opgeteld. Een opgeslagen keuze die ontbreekt of geen geldige intensiteit meer heeft, valt terug op het dichtstbijzijnde geldige voorstel. Zonder passende meetlocatie of hectometer blijft de intensiteit onbekend en wordt de reden getoond. De bronkaart berekent de dekking opnieuw uit de huidige wegdelen, inclusief aantallen ruimere en ontbrekende koppelingen. De afstand en ruimere-koppelingsstatus reizen mee in de bestaande kostenherkomst. MONIBAS-codes leveren weg en hectometer; alleen expliciete hoofdbaancodes `hrr` en `hrl` leveren de richting. Voor aansluitingscodes wordt geen richting uit het cijfer 0/1 verzonnen. Complete bronlocaties worden niet overschreven door een nabijgelegen asset op de andere rijbaan. `tests/ndw-road-matching.test.js` en de uitgebreide browsertest controleren dat de gekoppelde intensiteit daadwerkelijk in het wegdeelscenario terechtkomt.

### Selectiecontract

Integrale export: `formaat: BiDash-integraal`, `versie: 1`, met `delen`, `selectie`,
`regelsEigenaar`, `opgeslagen` en afhankelijkheidsmeldingen.

| Selectie | Inhoud |
| --- | --- |
| DVM-onderdelen | `assetregister`, `eol`, `storingshistorie`, `liveStoringen`, `dripHistorie`, `uRoutes`, `werkzaamheden`, `parameters`, `dripSelectie` |
| `parameters` | DVM-regels, diensten, subprocessen, assetconfiguratie, live-overzichtsfilter (`RULES.cfg.liveOverviewFilter`), kosteninstellingen en daarin opgeslagen verkeersmodel/simulaties/NDW-export |
| `biRules` | Alleen de actuele `BI_RULE_KEYS`: `config`, `configBron`, `richtlijnen`, `amRegels`, `impact`, `capgrens` |
| `biData` | Alle overige BI-velden; momenteel óók `vwmFte`, `cap`, `vwmRolCap`, `civFormatie` |
| `planning` | Originele XML, bestandsnaam en `app_collectState()`-instellingen |
| `links` | Expliciete dienst-functiekoppelingen en eigenaar |
| `expertReviews` | Expertduiding per dienstverlening, inclusief context, ontbrekende relaties, regel- en signaalvoorstellen, bewijs en akkoordstatus |

Belangrijk: de naam “BI-rekenregels” dekt momenteel niet alle formatievelden.
Voor volledige overdracht van de BI-instellingen beide BI-selecties meenemen.
Een toekomstige herindeling vereist compatibiliteits- en deelimporttests.

Niet aangeleverde onderdelen blijven behouden. Expliciet aangeleverde lege lijsten
vervangen de bestaande inhoud. DVM `exportSelectie[k] === false` slaat dat onderdeel
over. BI-deelimport vervangt aangeleverde velden op het bovenste niveau; dit is
geen algemene diepe merge. Identiteiten mogen niet op alleen de zichtbare naam
worden samengevoegd.

DVM-export gebruikt intern formaatversie 54; dat is niet de UI-versie 2.3.
Oude DVM-totaalbestanden blijven via de bestaande importer ondersteund.
De oorspronkelijke planning-XML-export levert de onbewerkte bron. **Exporteer Primavera P6 XML** staat zowel bij de tijdlijn als onder Data & export. Beide gebruiken `ipl_createPrimaveraExport()` en `site/core/primavera-export.js`. De geladen P6-XML is het sjabloon: de oorspronkelijke P6-versienamespace, schemaLocation, ProjectList, projectvelden, WBS, kalender, OBS, codes, relaties, kosten, resourcegegevens en elementvolgorde blijven behouden. Er wordt geen nieuwe of ingesloten operationele template gebruikt. MS Project wordt niet als P6-bestand aangeboden; daarvoor blijft de oorspronkelijke XML-export bestaan.

Vóór export wordt een hangende sleepbeweging verwerkt en de bestaande volledige cascade opnieuw berekend. De export gebruikt alle modelactiviteiten, los van filters en ingeklapte groepen. Scenarioverschuivingen blijven hele kalendermaanden, met maandultimo-klemming en behoud van tijd, fractieseconden en tijdzone. Gevulde geplande, effectieve, vroege, late, resterende en verwachte datumvelden van verschoven activiteiten schuiven mee, evenals de bestaande geplande datumvelden van hun resourcetoewijzingen. Actuals, constraintdatums, DataDate, baselines, WBS-budgetten, duur, uren en kosten blijven bronwaarden. Lege en xsi:nil-datums worden niet ingevuld; ontbrekende velden worden niet toegevoegd. Veldnamen in vreemde namespaces worden niet bewerkt. De tijdlijn blijft een benadering in fractiejaren en vormt geen vervanging van de P6-kalenderberekening.

Een bestand met meerdere projecten bewaart alle projecten; alleen het laatste project met activiteiten, hetzelfde project dat de importer selecteert, volgt het actieve scenario. Ongeldige XML, dubbele of ontbrekende activiteit-ID’s, afwijkende model-ID’s en ongeldige verschoven datums stoppen de export. Een nulscenario behoudt de brontekst, afgezien van een noodzakelijke UTF-8-declaratie. Bij wijzigingen kan de XML-serialisatie schrijfdetails zoals de notatie van lege elementen wijzigen, maar de objectstructuur en attributen blijven staan. De bron en opgeslagen scenariostaat worden niet overschreven.

De export onder Data & export gebruikt de bestaande gekoppelde-maproute. Zowel deze knop als de tijdlijnknop bereiden via `site/core/file-download.js` een echte downloadlink voor en doen één automatische klikpoging. Een browser kan die poging weigeren zonder een JavaScript-fout te geven; de melding zegt daarom dat het bestand klaarstaat, niet dat het is opgeslagen. De link staat direct naast de knop en kan met een gewone gebruikersklik opnieuw worden gebruikt. De object-URL blijft beschikbaar tot de volgende voorbereiding, een nieuwe planningimport of het verlaten van de pagina. Voorbereiden gebeurt telkens opnieuw vanuit de originele XML en actuele cascade; klikken op de link herhaalt de laatst voorbereide export.

Voortgang, gereedmelding en fouten staan in afzonderlijke zichtbare statusvakken, buiten het uploadvak dat na import wordt verborgen. Bij een fout wordt de vorige downloadlink gewist. De algemene mapmelding gebruikt voor deze export eveneens “staat klaar” in plaats van een onbewezen downloadbevestiging. De bron en opgeslagen scenariostaat blijven behouden. Het bestand krijgt de bronnaam met `-scenario-<datum>.xml`. Herimport in BiDash wordt getest; import en herberekening in een echte Primavera-omgeving zijn nog niet uitgevoerd. De melding vraagt daarom om controle en herberekening in P6.

`history` bestaat in het integrale model en wordt programmatisch ondersteund,
maar staat niet in de huidige hub-selectievakken. DVM-kostendagstanden zijn een
aparte opslagroute binnen de DVM-kostenconfiguratie. Presenteer die niet als dezelfde historie.

## 6. DVM: van storing naar dienstverlening

Actueel en prognose zijn gescheiden:

- Live resultaten beginnen met de volledige open storingsmomentopname op de bronpeildatum van de laatst geladen actuele lijst.
- Een nieuw open-storingenbestand vervangt de vorige actuele momentopname volledig, ook als de bestandsnaam anders is.
- De invoer Open storingen accepteert XLSX, XLS en CSV wanneer de inhoud herkenbare DVM-storingsregels bevat. De expliciete open-storingenroute vereist niet meer dat de oude snapshot-heuristiek op basis van status of peildatum slaagt.
- Bij vervanging vergelijkt `site/core/live-snapshot.js` de volledige oude en nieuwe momentopname. Een event-ID wordt gescopeerd op VC, type, locatie, strook, code en begintijd. Zonder event-ID worden ook asset, melding en gevolg gebruikt.
- Iedere verdwenen melding blijft als `ONBEKEND_DOOR_BRONGAT` zichtbaar in een virtuele actuele bron en eenmaal in `STORINGSBRONNEN`. Verdere imports mogen die onzekerheid niet wissen. Terugkerende waarneming werkt dezelfde historische rij bij.
- `closeHistoryRow()` bewaart de laatste waarneming en laat `hersteld_op` leeg. De oude velden `_afgeslotenDoorNieuweMomentopname` en `_afsluitPeildatum` zijn alleen compatibiliteitsmetadata, geen herstelbewijs. Eventuele duur is een onbetrouwbare bovengrens en telt niet als gemeten MTTR.
- Wanneer één bestand uit een losse live bestandenset niet kan worden gelezen, wordt geen bestand uit die set geactiveerd; de vorige stand blijft intact.
- `site/core/live-overview-filter.js` past daarna uitsluitend op de actuele `doorrekenen(...,{actueel:true})`-route een gebruikersfilter toe. De bronmomentopname zelf blijft ongewijzigd.
- Het filter kan waarden uitsluiten op storingstype/foutregel, gevolg, noodmaatregel, assettype, oorzaak, prioriteit/ernst, VC, RD, district en weg. Lege waarden zijn expliciet filterbaar.
- De filterconfiguratie bewaart alleen uitsluitingen. Onbekende waarden uit een latere momentopname tellen daardoor standaard mee. Standaard zijn er geen uitsluitingen.
- De A↔B-vergelijking, automatische historisering, historische storingsanalyse en prognosekalibratie gebruiken altijd de volledige relevante bronstroom en worden nooit door het live-overzichtsfilter beïnvloed.
- Het actuele overzicht toont bronregels, meegetelde en uitgesloten regels zodat een actieve analysekeuze zichtbaar blijft.
- Storingshistorie dient voor prognose/kalibratie en wordt niet bij live meldingen opgeteld.
- De historie-doorrekening (`HISTORIE_STATE` en `MC_HISTORIE_LIVE`, de kalibratiebasis voor de Monte Carlo) is de zwaarste stap bij grote signaalgeverbronnen en wordt daarom uitgesteld. `probeerAnalyseActiveren()` zet alleen de vlag `HISTORIE_UITGESTELD` wanneer er bruikbare historie klaarstaat; `zorgHistorieState()` bouwt haar pas af zodra het prognosetabblad wordt geopend of een simulatie start. De live doorrekening (`STATE`) en de Open storingen blijven direct bij een bronwijziging berekend; alleen het moment van de historieberekening verschuift, de uitkomst is identiek.
- DRIP is de expliciete uitzondering op die algemene scheiding wanneer één incident aantoonbaar aan het einde van het bronvenster nog open staat. Een oude gecensureerde episode telt niet automatisch als actueel. Alleen een expliciete open toestand, een regel zonder eindtijd en afgeronde duur, of een gecensureerde episode die het einde van dezelfde bron raakt, wordt als actuele DRIP-melding afgeleid.
- De afgeleide actuele DRIP-selectie wordt opnieuw door de gewone live broninspectie en DVM-doorrekening geleid. In de landelijke brondekking blijft zichtbaar dat de actuele selectie uit DRIP-historie komt en moet de gebruiker de volledigheid voor het bedoelde areaal bevestigen.
- De brondekkingstabel telt open meldingen uit de actuele bronnen, niet uit de doorgerekende meldingen. `doorrekenen()` laat een melding vallen zonder locatie of zonder passende foutregel; zulke meldingen staan wel in Open storingen. Het verschil wordt benoemd in de tabel. Een assettype waarvan een deel is doorgerekend, voedt de dienstverlening met de (optimistische) waarde uit die meldingen. Alleen een assettype dat wel open meldingen heeft maar waarvan er géén enkele is doorgerekend (`blindeMeldingen`), geldt als onbekend en gaat als band mee — anders zou een bevestigde bron met open storingen stil als nul verlies tellen.
- Een uit de DRIP-historie afgeleide actuele melding krijgt weg, richting, hectometer en verkeerscentrale uit het assetregister voordat ze de doorrekening in gaat. Zonder locatie viel ze eerder uit de berekening terwijl ze in de lijst stond.
- De beherende regiodienst in de storingslijst volgt `rapportRdWaarde()`: alleen een herkende regiodienst telt, anders wordt hij uit de verkeerscentrale afgeleid. Een onbekende bronwaarde wordt niet als beheerder getoond.
- Verkeerscentralecodes worden vóór groepering genormaliseerd door `normAssetVc()`: hoofdletters, spaties en een optioneel `VC`-voorvoegsel maken geen verschil. De historische aliassen `WNN` en `WNZ` worden respectievelijk `NWN` en `ZWN`. Het Overzicht, de uitvoeringstabel per VC en het VC-filter bij Wegdelen gebruiken dezelfde canonieke code.
- RIA4 en Windwaarschuwing zijn onafhankelijke DRIP-classificaties. Een gecombineerd bronbestand wordt per gemarkeerde regel gesplitst. De koppeling gebruikt een identifier met locatiecontrole en anders VC, weg, richting en hectometer. Een hergebruikte DRIP-code in een ander gebied mag daardoor geen classificatie overnemen.
- Een classificatie draagt haar eigen herkomst. `classifiedRows()` levert `herkomst` (`markering` of `aanname`), `markerKolommen` en `rijenBron`. Naast de vaste kopteksten gelden samenstellingen als `RIA-4 DRIP` en `Windwaarschuwing DRIP` als markering; windmeetkolommen (`richting`, `snelheid`, `kracht`, `meting`, `sensor`, `graden`) nadrukkelijk niet, want die beschrijven het weer en niet de soort DRIP. Wordt geen markerkolom herkend, dan is de soort een aanname van de gebruiker over het hele bestand. Die aanname moet zichtbaar zijn in de laadmelding en op de bronkaart, en gaat mee in de totaalexport zodat een herstelde bundel haar niet stilzwijgend tot vaststelling maakt.
- De brondag is niet automatisch vandaag. NDW-meetmoment, exportdatum en prognoseperiode zijn afzonderlijke datums en moeten herkenbaar blijven.
- All Assets bepaalt populatie, kenmerken, installatie-/ingebruiknamedatum en expliciete EOL/levensduurgegevens. Een aparte EOL-referentie bestaat niet meer.
- U-routes en werkzaamheden zijn context voor bestaande analyses, geen automatische vermenigvuldigers voor alle kosten.

Rekenketen: volledige open momentopname → gebruikersfilter voor actuele doorrekening → asset-/objectimpact → subprocessen → dienstverlening.
`subprocesWaarde`, `dienstWaardeUitSubprocessen` en `dienstAssetAfhankelijkheid`
beheren de gewogen afleiding. Beschikbaarheid en prestatie zijn verschillende velden.

Per dienstverlening vormen de subprocesaandelen samen 100%. Bij aanpassen van één
aandeel blijft dat aandeel staan en wordt de rest naar verhouding verdeeld over
de overige subprocessen. Oude relatieve gewichten worden genormaliseerd; bij nul
som geldt een gelijke verdeling. Pas dit gesloten-verdelingsgedrag niet toe op
andere percentagevelden, zoals assetafhankelijkheden of impactwaarden.

De normalisatie loopt bij het laden van de regels en bij het importeren van
parameters, dus vóór iedere doorrekening. Zij mag niet afhankelijk zijn van het
openen van een scherm: `v68Dienst()` weegt met deze aandelen, en een nog niet
genormaliseerd aandeel telt daarom als 1, gelijk aan
`dienstWaardeUitSubprocessen()`. De twee dienstpaden moeten bij dezelfde invoer
dezelfde uitkomst geven.

Het landelijke `v68LandelijkModel()` gebruikt volledigheid per assettype.
`v68Subproces()` en `v68Dienst()` leveren bij onvolledige dekking een bereik en
`besch: null`, in plaats van een schijnbaar exact percentage. Een ontbrekende
storingsbron is geen bewijs voor 100% beschikbaarheid. Andere oudere detailroutes
kunnen andere dekkinglogica hebben: maak ze bij wijzigingen niet stilzwijgend gelijk.

Wegdelen kunnen verschillende identiteiten hebben op basis van weg, richting en
verkeerscentrale. Behoud de domeinsleutels. Los schijnbare dubbelen op bij de
gegevensgroepering, niet door uitsluitend identieke schermteksten te verwijderen.

## 7. Verkeerskosten en eenheden

Assetverliesuren beschrijven assetuitval. Voertuigverliesuren (VVU) beschrijven
extra reistijd van verkeer. Er bestaat geen vaste omzettingsfactor tussen beide.
De actuele berekening staat in `kostenDagResultaat()` en het `sc67*`-verkeersmodel.

```text
VVU = getroffen voertuigen/uur × hinderuren × extra minuten per voertuig / 60
Autotarief = bestuurderstarief + extra passagiers × passagierstarief
Gewogen tarief = (1 − vrachtaandeel) × autotarief + vrachtaandeel × vrachttarief
Kosten = VVU × gewogen tarief
```

Hinderuren zijn de uren binnen de brondag waarin het verkeer extra reistijd
ondervindt, bijvoorbeeld spitsvensters. Ze zijn niet vanzelf de volledige
storings- of herstelduur; geldig bereik is 0–24 uur.

Twee invoermethoden:

1. Rechtstreekse extra minuten: het ingevoerde effect geldt voor de huidige uitval. Vermenigvuldig de storingsimpact niet nogmaals.
2. Trajectmodel: basisreistijd = km / basissnelheid × 60. De snelheidsreductie wordt gewogen met de hoogste beschikbaarheidsimpact van de open meldingen binnen het representatieve wegdeel. Reistijd met storing = basisreistijd / (1 − reductie × impact). Het verschil vormt de extra minuten.

Een passende optionele OSM-route kan de trajecttijden leveren. Weggeometrie is
niet vooraf geladen in deze browserversie; zonder route geldt de ingevoerde lengte.
Dit is geen volledig verkeersmodel: geen wachtrijopbouw, terugslag of automatisch
rijstrookverlies. Meerdere storingen worden in dit actuele trajectmodel niet opgeteld.

Bestaande standaardtarieven (`kostenBasis()`): bestuurder 10,42; passagier 8,34;
extra passagiers 0,25; vracht 63,10; vrachtpercentage 10; prijspeil 2022.
Daaruit volgt intern 17,5645 euro per VVU. Rond pas de weergave af.
Dit zijn bestaande instelbare uitgangspunten, geen opnieuw geverifieerde actuele tarieven.
Behoud de bronuitleg uit `kostenBronHtml()`; wijzig tarieven alleen met expliciet
prijspeil en onderbouwing, niet stilzwijgend naar een ander jaar.

NDW-voertuigintensiteit helpt bij q, maar een minuutmeting is geen gemeten
spitsgemiddelde. Meetpunt, weg, richting, toepasbaarheid en tijd blijven zichtbaar.
Tel voertuigklassen niet nogmaals bij een rijstrooktotaal. Gemeten snelheid is
niet automatisch de snelheid zonder assetstoring. Animatie-aantallen zijn geen telling.

`v68KostenStatus()` onderscheidt niet berekenbaar, scenario en onderbouwd.
Ongeldige verkeersinvoer of ontbrekende bron geeft niet berekenbaar; gebruik van
NDW-minuutdata blijft scenario. Onbekende kosten zijn `null`, geen nul.
Toon dekking, bekend subtotaal en overlapstatus. Dezelfde verkeersstroom kan
meerdere wegdelen raken; een som van wegdeelscenario’s is niet automatisch landelijke schade.

Opgeslagen kostenscenario’s horen bij de bronpeildatum. Dag/week/maandweergaven
middelen beschikbare dagstanden in de betreffende groep; ontbrekende dagen
worden niet als nul ingevuld. Vergelijkbaarheid vraagt dezelfde aannames en dekking.

## 8. Monte Carlo en memo’s

| Model | Doel en grenzen |
| --- | --- |
| `tmc70*` | Onzekerheid rond verkeerskosten van de huidige brondag; geen toekomstige assetuitval |
| `f71*` | Toekomstige locatie-episodes en verkeerskosten van operationele MSI-signaalgevers |
| DRIP Monte Carlo | Eigen selectie, leeftijd/levensduur en storingshistorie; eigen beschikbaarheids- en dienstresultaten |
| BI-scenario’s | Formatie/contracten; niet automatisch een verkeerskostenprognose |

Huidige kosten: minimum/modus/maximum voor q, hinderuren en extra minuten;
driehoeksverdelingen, seed, aantal runs en keuze voor onafhankelijke of samen
oplopende trekkingen. Gelijke grenzen geven terecht geen spreiding. Voorgestelde
marges zijn aannames. Tarieven blijven vast. Bron/configuratie-wijzigingen maken
oude resultaten niet opnieuw geldig; behoud fingerprint- en herberekeningscontroles.

MSI-toekomst (`f71Help`, `f71Build`, `f71Simulate`): historie wordt ruimtelijk aan
registerlocaties gekoppeld; dubbele locatie/start-episodes tellen eenmaal.
Het model combineert leeftijdsafhankelijke blootstelling met Gamma-Poisson-kalibratie
en een gedeelde prior. Levensduur is een modelschaal, geen harde uitvaldatum.
Ontbrekend bouwjaar geeft een stationair aandeel. Zonder voldoende herstelduren
wordt MTTR met spreiding gebruikt. Herstel verjongt de asset niet. De starttoestand
is operationeel; het model veronderstelt geen geplande vervanging. Dit zijn
locatie-episodes, geen bewezen individuele lampdefecten.

Verkeerskosten ontstaan bij overlap van uitval met ingestelde spitsvensters.
Overlap binnen één wegdeel telt eenmaal; overlap tussen wegdelen blijft een risico.
Beperkte brondekking, gebruik van het huidige register voor het verleden en
modelaannames moeten in de uitleg blijven staan.

Percentielen gelden voor de benoemde grootheid: kosten-P95 betekent hoge kosten;
beschikbaarheids-P95 betekent hoge beschikbaarheid. P5–P95 omvat de middelste 90%
van simulatie-uitkomsten. P50 is de mediaan, niet noodzakelijk het gemiddelde.
Tel eerst binnen iedere run op en bereken daarna percentielen van het totaal.
Tel nooit losse P50/P95-regels op als totaalpercentiel.

Memo’s moeten dezelfde scope, peildatum, selectie en run gebruiken als de analyse.
Maak geselecteerde en daadwerkelijk gesimuleerde operationele assets onderscheidbaar.
Niet-operationele uitsluitingen verklaren een verschil in aantallen. Lieke-memo’s
houden managementduiding, individuele DRIP-namen en jaarblokken. Kosten gaan alleen
mee wanneer gekozen en toepasselijk. Een DRIP-beschikbaarheidsrun levert niet
zonder verkeersmodel een kostenprognose. Grafieken moeten ook in print/PDF zichtbaar zijn.

### Uitvoerbare memobesluiten vanaf 2.57 / DVM 137

De gewone memo, de Lieke-memo en de begeleidende MSI-/DRIP-Monte Carlo-brief gebruiken dezelfde beslispuntopbouw. Elk beslispunt bevat een opdracht, verantwoordelijke eigenaar, uiterste opleverdatum, toetsbaar resultaat en een datum plus besluitvormer voor vaststelling en het vervolg. De directie is alleen de ontvanger als de gebruiker die invult; uit een berekening volgen geen mandaat, eigenaar of afgesproken termijn.

In de memo-instellingen kan de gebruiker elk automatisch voorgesteld beslispunt afzonderlijk aanpassen. Ontbrekende afspraken blijven als concept zichtbaar, ook bij kopiëren, Word en afdrukken/PDF. Ongeldige datums en een vervolgbesluit vóór de opleverdatum worden gemarkeerd. Een ingevuld veld bewijst niet dat capaciteit of mandaat is toegezegd. De app verzint geen termijn van drie maanden of garantie op herstel.

`dvm-memo-besluit.js` beheert uitsluitend tekst, datumcontrole en veilige HTML-weergave. De oorspronkelijke analyse, scope, bronstand, grafieken en formules blijven leidend. De invoer staat onder `RULES.cfg.memoBesluiten`, gescheiden per memotype, scope en bronstand, met een koppeling aan het oorspronkelijke advies. Wisselen van memovorm, ontvangerniveau of kostenoptie behoudt dezelfde afspraken. Een extra bedrijfswaardenadvies krijgt eigen lege afspraken. Een andere bronstand of scope neemt geen eerdere afspraken over. Parameters bewaart de invoer in totaalexport en lokale opslag. Losse Word/PDF-documenten bevatten de ingevulde tekst; zij zijn geen bronbestand voor herimport.

## 9. Planning en formatie: regressiegevoelige werking

Planning bewaart originele XML en afgeleid `IPL_MODEL`, inclusief WBS, activiteiten,
relaties en verschuivingen. Behoud de bestaande MS Project/P6-parser en identifiers.
Planning en BI zijn naast elkaar geladen frames; `parent.DB` is geen geldige
algemene route naar de BI-configuratie.

`ensurePlanning()` koppelt het frame aan BI. `HUB.syncPlanningRules()` geeft
`DB.vwmFte`, `DB.cap`, `DB.vwmRolCap` en `DB.civFormatie` expliciet door aan
`ipl_applyVwm()` en `ipl_applyCivFormatie()`. Dit gebeurt bij koppelen, import,
herstel en BI-opslag. `hub:planning-loaded` dekt ook de oorspronkelijke laadroute.
De vergelijking van modelidentiteit en regelinhoud voorkomt onnodige herhaling.

VWM: `vwmIndividueleTaken()` kiest geldige individuele taken met herkenbare fase
in het WBS-pad en passende niet-CIV-hoofdgroep. Mijlpalen dragen niet als duurtaak bij.
`roleAt()` telt de FTE per fase/rol op voor alle op dat moment actieve taken,
met effectieve datums na verschuiving. `totalAt()` telt de rollen op.
Dit is gelijktijdige wekelijkse inzet, geen cumulatieve som van alle voorgaande weken.
Bij 36 uur per week betekent 0,5 FTE 18 uur per week. Onbekende fasen kunnen buiten
het model vallen; een nulcurve bewijst daarom niet dat er geen werk is.

CIV gebruikt het eigen formatiemodel. Maak VWM niet gelijk aan CIV om alleen
het beeld te repareren. P6-resourcetoewijzingen vormen daarnaast hun eigen invoerroute.

De canvasrenderer tekent uitsluitend het zichtbare gebied. Een spacer bewaart de
volledige logische scrollruimte. Het fysieke canvas is begrensd rond 4 miljoen
pixels en 4096 per dimensie; device-pixelratio wordt begrensd. Scrollen en pointer-
coördinaten moeten dezelfde transformatie gebruiken. Verwijder nooit activiteiten
uit het model om een tekenprobleem op te lossen.

### Berekening en tekenen gescheiden

`planning-analysis.js` berekent de weekwaarden zonder DOM of canvas. Voor iedere taak wordt met een binaire zoekactie alleen het geraakte bereik van meetmomenten gekozen. Generieke FTE-toewijzingen behouden de bestaande 0,001-jaargrens; VWM-formatie behoudt de bestaande 0,0001-jaargrens, fasematching en rolregels. De optelvolgorde per meetmoment en rol blijft gelijk. VWM vervangt nog steeds de generieke VWM-waarde; CIV blijft haar eigen model gebruiken. Ook de bestaande kwartaalconflicten beperken hun scans tot actieve meetmomenten, met dezelfde bijdragen en volgorde.

Eén geplande `requestAnimationFrame` bundelt de verzoeken voor formatie. `ipl_renderFteNow()` berekent één actuele reeks en deelt die met de gecombineerde grafiek, dienstgrafieken en geopende VWM-rollen. Er is geen langlevende FTE-cache die bron- of regelwijzigingen kan missen. Onzichtbare formatievakken voeren geen berekening uit en plannen geen herhaalde tekenpogingen. Openen of een werkelijke maatwijziging ververst de weergave. De resize-observer vergelijkt afmetingen en wordt eenmaal geïnstalleerd. Het dashboard krijgt geen tweede hertekening na een vaste timer.

De activiteitenindex gebruikt de modelidentiteit en bewaart het eerste activiteit-ID, net als de oude zoekfunctie. De gesorteerde tijdlijnvolgorde wordt hergebruikt tot de modelidentiteit of inklapstatus verandert. Scenario’s wijzigen de effectieve datums maar niet de bronvolgorde. Scrollen blijft een aparte viewport-render en start geen formatieberekening. Nieuwe XML-imports vervangen het model en daarmee deze indices. De bronactiviteiten blijven alleen via import wijzigbaar; deze cache is geen API voor wijziging van bronactiviteiten in hetzelfde modelobject.

De bestaande BI-intervalcontrole vergelijkt eerst een lichte invoersleutel met modelidentiteit, bestandsnaam, planninginstellingen, VWM-/CIV-regels, capaciteitsnormen en P6-capaciteitsbron. Alleen veranderde invoer vraagt om nieuwe model- en capaciteitsberekeningen. De aparte opslagmeldingen en leescontracten blijven beschikbaar. Er wordt geen XML of berekende kwartaalmatrix in die controlesleutel geserialiseerd.

Dit is een snellere lokale berekening en weergave op de bestaande browserthread. Er is geen Web Worker of server toegevoegd. Grote eerste XML-imports, exports en het opbouwen van uitgebreide dashboards kunnen nog werk op die thread vragen. Performance moet daarom met de gebruikte bron en browser worden beoordeeld; een lokale synthetische meting is geen universele snelheidsgrens.

Standaardschaal is Hele periode. Volledig scherm houdt tijdlijn én formatiepaneel
beschikbaar; op smalle schermen onder elkaar. Sluiten, Escape, scrollen, resizen,
uit-/inklappen en slepen moeten blijven werken. Fullscreen verandert geen taken.

## 10. Signalen en samenhang

`combine()` neemt BI-signalen over, maakt DVM-dienstnormsignalen en gebruikt
expliciete `links` tussen dienst-ID en functie-ID voor het gecombineerde signaal.
Voor die combinatie moeten beide voorwaarden gelden: bekende dienstbeschikbaarheid
onder norm én actuele FTE onder benodigde FTE. Normen komen uit hun eigen module.

Iedere signalering heeft een stabiele identiteit, eigenaar en toegepaste regel.
Dubbele IDs worden binnen de samenstelling verwijderd. Geen automatische kosten-
vermenigvuldiging, extra formatie, contractboete of bewezen causaliteit op basis
van alleen een gecombineerd signaal. Onbekende beschikbaarheid is geen bewezen normoverschrijding.

### Expertduiding per dienstverlening

`site/core/service-expert-input.js` definieert één generiek contract voor alle
dienstverleningen. De dienst-ID is de scheiding; het formulier en de validatie zijn
niet voor Incidentmanagement hard gecodeerd. De schil haalt beschikbare diensten
uit de DVM-samenvatting en gebruikt vier neutrale VWM-diensten als terugval wanneer
nog geen DVM-bron is geladen.

Een expertduiding bevat de expert, rol, status en formeel akkoord, begeleide keuzes over doel en bereik, procesverloop, uitval, herstel, norm, meetwijze, bron en onzekerheid, en optionele uitleg per keuze. Aanvullende relaties, regelvoorstellen, signaalvoorstellen, bewijs, aannames en open vragen blijven beschikbaar als optionele verdieping.

De begeleide vragen gebruiken vaste antwoordopties. Iedere vraag en sectie heeft een toegankelijke tooltip die uitlegt waarom het antwoord nodig is en of het antwoord de berekening beïnvloedt. Vrije tekst is alleen een optionele toelichting. Oudere vrije antwoorden blijven bij normalisatie behouden en worden in het keuzescherm als bestaand antwoord getoond.

Concepten mogen onvolledig worden opgeslagen. `ter_beoordeling` vereist de begeleide kernkeuzes, een geldige dienstnorm, minimaal één subproces, minimaal één DVM-afhankelijkheid per subproces en een gesloten subprocessenverdeling. Een regel- of signaalvoorstel is niet verplicht. `vastgesteld` vereist daarnaast akkoordgever en datum. De statussen activeren op zichzelf geen regel.

De expert kan de actuele dienstnorm en subprocessen als modelvoorstel overnemen, subprocessen toevoegen of verwijderen en per subproces het dienstaandeel aanpassen. Alleen die aandelen moeten samen 100% vormen. Bij het wijzigen van één aandeel blijft die invoer staan en wordt het resterende aandeel naar verhouding over de overige subprocessen verdeeld. Technische DVM-afhankelijkheden worden per assettype gekozen en krijgen ieder een zichtbaar percentage tussen 0 en 100. Deze assetpercentages zijn relatieve gewichten en hoeven samen geen tweede 100%-verdeling te vormen. `expertModelProposal()` zet de invoer om van procenten naar decimalen. DVM normaliseert daarna de positieve technische gewichten in `expertModelZet()` voordat het model wordt proefberekend of toegepast. Bestaande gewichten worden bij het laden van het actieve model weer als percentages in het formulier getoond.

Een proefberekening past het voorstel tijdelijk toe op de geladen DVM-data, leest de uitkomst en herstelt direct het actieve model. Toepassen kan alleen bij een volledig `vastgesteld` dossier. DVM bewaart dan de vorige dienstconfiguratie als rollback-snapshot. De knop **Vorige model terugzetten** herstelt die configuratie en rekent opnieuw. Nieuwe subprocessen reizen mee in `parameters.subprocessen` van de DVM-totaalexport en worden bij import als volledige procesketen hersteld.

De gegevens staan in `state.expertReviews`, zijn selectief exporteerbaar en blijven
behouden wanneer een oudere of gedeeltelijke import dit veld niet bevat. De
read-only Context API publiceert genormaliseerde `expertReviews` en een afgeplatte
lijst `expertRelations`. Dit maakt ontbrekende procesrelaties bevraagbaar zonder
een tweede berekening of automatische causaliteit te introduceren.

## 11. Verplichte werkwijze bij AI-wijzigingen

1. Lees dit document en de relevante actuele code. Controleer remote `main`, lokale wijzigingen en open PR’s; een andere AI kan intussen wijzigingen hebben gedaan.
2. Benoem welk domein eigenaar is en welke invoer/uitvoer geraakt wordt. Houd de wijziging gericht. Verander geen formules, defaults of schema’s als bijeffect van styling.
3. Reproduceer de fout waar mogelijk. Voeg een synthetische regressietest toe voor een functionele fout; een screenshot of syntaxiscontrole alleen is onvoldoende.
4. Behoud oude imports en selectieve exports. Bij een schemawijziging: expliciete versie/migratie en tests met ontbrekende én lege velden; geen stille dataverwijdering.
5. Controleer brondata, herkomst, scope, eenheden, null/0 en actualiteit van resultaten.
6. Voer de relevante controles uit. Rapporteer wat niet is getest en waarom.
7. Werk `GEBRUIKERSHULP.md`, `processflow.md`, relevante SVG’s en deze beschrijving bij wanneer de gebruikerswerking of gegevensstroom verandert. `site/help.html` is alleen de viewer; `docs/` is de inhoudelijke bron voor Help.
8. Verhoog het versienummer bij elke functionele wijziging. De schilversie staat in `site/core/versie.js`; een engine houdt haar eigen nummer bij, zoals `DVM_VERSION` in `dvm-source-manager.js`. Raakt de wijziging alleen een engine, verhoog dan die engineversie; raakt zij de schil of het geheel, verhoog dan ook de schilversie. Zet hetzelfde nummer in de release notes en werk de tests bij die het nummer vastleggen. Een reeks wijzigingen die als één geheel wordt samengevoegd, mag één verhoging delen; dat wordt dan in de release notes benoemd.
9. Publiceer via een gerichte branch en reviewbare PR. Controleer vóór samenvoegen opnieuw de basisbranch. Behoud wijzigingen van andere auteurs; niet force-pushen.
10. Voor functionele releases: controleer de Pages-run en claim pas daarna dat de nieuwe versie live is. Commit nooit lokale brondata om tests eenvoudiger te maken.

Een AI mag deze voorwaarden niet schrappen of afzwakken om zijn eigen wijziging
als geslaagd te laten gelden. Een bewust gewijzigde producteis moet herkenbaar
worden vastgelegd met de consequenties voor data, uitkomsten en validatie.

## 12. Testmatrix en oplevercriterium

| Wijziging | Vereiste gerichte controle |
| --- | --- |
| Model/merge/export/signalen | `npm test` (`tests/model.test.js`) |
| Expertduiding dienstverlening | `tests/service-expert-input.test.js`: generiek schema, begeleide keuzes, optionele uitleg, tooltips, gesloten subprocessaandelen, technische vinkjes, statusovergangen, akkoord, geïsoleerde opslag per dienst en zichtbare route; `tests/model.test.js` en `tests/context-api.test.js` bewaken export/import en read-only context |
| Navigatie/import/opslag | `tests/browser.cjs`: MS Project, P6, zichtbare tijdlijn, export/herstel, mobiel |
| Datalaadvoortgang | `tests/data-load-progress.test.js`: byteaggregatie, begrenzing, FileReader-pad, paint-yield en DVM-voortgangsbrug |
| Primavera-terugexport | `tests/primavera-export.test.js` en `npm run test:primavera`: datumranden, behoud van objectstructuur, namespaces, actuals, nil, resourcegegevens, cascade, nulscenario, downloads, zichtbare fouten, onderdrukte automatische download met een echte gebruikersklik, smalle schermen, originele bron en herstel; `tests/file-download.test.js` bewaakt behoud en intrekken van de lokale download-URL; echte P6-import blijft een aparte controle |
| Planningsprestaties | `tests/planning-analysis.test.js` vergelijkt alle weekwaarden exact met de vorige volledige scan en bewaakt toleranties en invoerwijzigingen; `npm run test:planning-performance` controleert één gedeelde reeks, geen FTE bij scrollen/verbergen, indices, positieve VWM-vraag, rollen en rustige BI-intervalticks |
| Canvas/tijdschaal/drag | `tests/planning-large.cjs`: grote synthetische planning, scrollen, slepen, resizen |
| Formatie/BI-brug/fullscreen | `tests/planning-formation.cjs`: overlappende taken, regelwijziging, reload, grafieken |
| MTM-updates per VC | `tests/signaalgever-map-sync.test.js`: behoud van andere VC’s en bronstromen, idempotentie, overlap, kortdurige MSI/LUS, datagaten, oude mapsneden, identiteiten, lege VC-watermerken, oude light-historie, volledige engine-import en export/herimport. `tests/signaalgever-map-sync-browser.cjs` controleert aanvullend de echte browserroute; uitvoering vereist Playwright en Chromium |
| Assetkoppeling en HMP met streepjes | `tests/asset-fault-identity.test.js`: gedeelde parser, matrixkoppeling, rijstrook uit tekst, oude conflicterende aliassen, onbesliste eenheden, VC-/zijde-/rijstrookcontrole, stabiele sleutels, locatiecorrectie, Detectielus, exacte doublures, meerdere foutcodes en export/herstel. `tests/assetlocaties-browser.cjs` bevat dezelfde koppelcontrole via de echte browseradapter; vereist Chromium |
| Live storingsmomentopname | `tests/live-snapshot.test.js`: identiteit, dubbelen, onzeker behoud en herstelbewijs |
| Afgeleide hersteltijd | `tests/afgeleide-hersteltijd.test.js`: herkomst vastgelegd, markering in `normRij`, duurverdeling stabiel bij een verder weg liggende peildatum |
| Dienstaandelen en dienstwaarde | `tests/dienst-aandelen.test.js`: gesloten aandelen na laden, ontbrekend aandeel als 1, expliciete aandelen, onvolledige dekking blijft een band |
| Herkomst DRIP-classificatie | `tests/drip-markerherkomst.test.js`: samengestelde kopteksten als markering, windmeting niet, aanname vastgelegd met regelaantal, herkomst door export en herstel, zichtbaar in de bronkaart |
| Runtime-patches installeren | `tests/runtime-patches.test.js`: elke patch zet zijn vlag in een eigen scope, de koppeling in `signal-forecast.js` klopt met de registratie, geparkeerde patches blijven een vastgelegde keuze, geen patch zonder registratie |
| Brondekking open meldingen | `tests/brondekking-open-meldingen.test.js`: bronaantal per type, niet-doorgerekende meldingen benoemd, blind type wordt onbekend, gedeeltelijk doorgerekend type houdt een waarde en voedt het subproces, locatie uit het register voor afgeleide DRIP-regels |
| Beheerder in de storingslijst | `tests/storingslijst-beheerder.test.js`: nooit een getal als beheerder, afleiding uit de verkeerscentrale, herkende bronwaarde blijft staan |
| Planning zonder projectdata | `tests/planning-geen-projectdata.test.js`: geen objectnamen in de code, lege P6-, portfolio- en modelstructuren, tellers op nul, werkende triggerlaadroute met overgeslagen onvolledige regels |
| Versiebalk | `tests/versiebalk.test.js`: schilversie zichtbaar zonder geladen module, gemelde engineversies erachter, lege melding blijft weg, versienummer op precies één plek |
| Kwaliteitsaudit | `tests/quality-audit.test.js`: lege werkruimte, gezonde keten, bron-dashboardbreuk, onbekende impact naast exact dienstpercentage, veilig geblokkeerd conflict als waarschuwing, gelekt conflict als blokker, lege BI-werkruimte, asset- en bronregelverschil, duplicaat op event-ID en bronbestand, en zichtbare bediening/export |
| Queryfilters | `tests/query-filter.test.js`: EN, OF, tekstnormalisatie, numerieke vergelijking en foutcodes op hetzelfde asset |
| Foutcodebeheer | `tests/fault-rule-manager.test.js`: code maken, expliciet toewijzen, typecontrole, locatieconflict niet omzeilen en adaptervolgorde |
| Live overzichtsfilter | `tests/live-overview-filter.test.js`: defaults, uitsluitingen, lege waarden, nieuwe waarden, bronbehoud en DVM-parameteropslag |
| VC-normalisatie in Overzicht en Wegdelen | `tests/vc-normalisatie-overzicht.test.js`: `ZWN`, `zwn`, `VC ZWN` en `WNZ` vormen één groep en de overzichtsgrafiek en het wegdelenfilter gebruiken de canonieke VC-code |
| Help/documentatie | Controleer `site/help.html`, Help-link in `site/index.html` en overeenstemming met `docs/GEBRUIKERSHULP.md` en `docs/processflow.md` |
| DVM-regels/kosten/prognose | Aanvullende gerichte numerieke tests en scopes; bestaande tests dekken niet alle formules |
| DRIP actueel/classificatie | `tests/drip-open-from-history.test.js`, `tests/drip-special-lists.test.js` en een lokale controle met een volledige DRIP-export zonder die brondata in Git op te nemen |
| DRIP-foutregels en toestand | `tests/drip-foutregel.test.js`: de verzonden DRIP-foutcodes met de afgesproken percentages, alarmtekst matcht (display verloren, kritische LED, deur, reset), de functionele toestand (GESTOPT/IN-BEDRIJF, LANGDURIG/INTERMITTEREND) is leidend, een ongedefinieerde fout blijft onbekend, MSI/CAM ongewijzigd |
| Signaalgevers totaal (JSON) | `tests/signaalgever-totaal.test.js`: `signaalgeverTotaalBronnen()` filtert open alarmen op eindstatus en `meenemen`, zet storingen om naar historie, de rijen worden door `normRij()` begrepen (open alarm als MSI met passende foutregel, historische storing zonder omschrijving via signaalgever als MSI herkend), en de bron is in `dvm-source-manager.js` geregistreerd met een eigen JSON-knop, handler en of/of-vervangmodus |
| Signaalgevers uit map | `tests/storingsbundelaar.test.js`: `sbMtmRijenUitTekst()` parseert een storinglijst (locatie, code, unit, categorie/meenemen), `sbBouwBundel()` sluit een verdwenen alarm en houdt een blijvend alarm open_aan_einde, `sbClassificeer()` maakt langdurig/intermitterend, `sbPadInfoMtm()` weigert paden buiten mtm/<vc>/storinglijst, `sbFilterBestanden()` beperkt op regio en periode, `sbCombineerMetBasis()` vervangt alleen de gekozen regio, `sgVolgendeCtx()`/`sgBuitenPeriode()` snoeien de maptraversal buiten mtm en buiten de regio/periode, en de bundeluitvoer (v2.5-velden) wordt door de schema-tolerante mapping als MSI herkend |
| DRIP totaal (JSON) en uit map | `tests/drip-totaal.test.js`: `sbDripEventsUitTekst()` parseert tab-gescheiden CDMS-logregels (status URGENT/OK), `sbBouwDripBundel()` sluit episodes en houdt een blijvend alarm open, `sbPadInfoDrip()`/`sbFilterDripBestanden()` accepteren alleen cdms/<vc>/log en filteren op regio/periode, `sgVolgendeCtxDrip()` snoeit de maptraversal, `sbMetWerkers()` begrenst parallel lezen en meldt echte voortgang, `dripDatasetNaarBron()` zet `datasets.drip` om naar incidenten en een open episode wordt door `drip-open-from-history.js` als openstaand herkend, en `sbCombineerMetDripBasis()` vervangt alleen de gekozen regio. `tests/dvm-source-manager.test.js` legt vast dat de losse DRIP-historie-upload is vervangen door de bronnen DRIP totaal en DRIP uit map |
| Signaalgevers totaal (JSON) | `tests/signaalgever-totaal.test.js`: `signaalgeverTotaalBronnen()` filtert open alarmen op eindstatus en `meenemen`, zet storingen om naar historie, de rijen worden door `normRij()` begrepen (MSI blijft MSI, detector/lus wordt LUS en bekende regels krijgen de passende foutregel), en de bron is in `dvm-source-manager.js` geregistreerd met een eigen JSON-knop, handler en of/of-vervangmodus |
| Signaalgevers uit map | `tests/storingsbundelaar.test.js`: `sbMtmRijenUitTekst()` parseert een storinglijst (locatie, code, unit, categorie/meenemen), detectorregels blijven in de bron, `sbBouwBundel()` sluit een verdwenen alarm en houdt een blijvend alarm open_aan_einde, `sbClassificeer()` maakt langdurig/intermitterend, `sbPadInfoMtm()` weigert paden buiten mtm/<vc>/storinglijst, `sbFilterBestanden()` beperkt op regio en periode, `sbCombineerMetBasis()` vervangt alleen de gekozen regio, `sgVolgendeCtx()`/`sgBuitenPeriode()` snoeien de maptraversal buiten mtm en buiten de regio/periode, en de bundeluitvoer bewaart MSI en Detectielus apart en verzint geen impact voor een onbekende detectorcode |
| Detectielusketen | `tests/detectielus-keten.test.js`: bronvarianten lus, detectie, detector, detectielus, meetlus en inductielus worden `LUS`; All Assets herkent Inductielus; `LUS` voedt de schakel detectie en wordt zichtbaar als Detectielus |
| Memo/print | Controleer selectie, bron/run, optionele kosten en grafieken in printweergave |
| Privacy | Gebruikersdata blijft lokaal; vaste NDW-GET op eigen origin na klikken; uitsluitend openbare NDW-feed in artifact, geen gebruikersdata in Git/artifact |
| Alleen documentatie | Controleer beweringen, bestands-/functienamen, links en diff; geen volledige simulatie nodig |

`npm run test:browser` voert de drie browserscripts uit en vereist Playwright en
Chromium. `PLAYWRIGHT_MODULE` en `CHROMIUM_PATH` kunnen naar een bestaande installatie
wijzen. `npm run serve` serveert `site/` lokaal op poort 8080.


## Kwaliteitsaudit en score

`site/core/quality-audit.js` is een pure, lokaal uitgevoerde controlelaag. De module
ontvangt de opgeslagen werkruimte en de publieke HUB-uitkomsten. Zij inspecteert
geen frame-interne variabelen en past geen bron, filter of rekenregel aan.

De audit gebruikt vijf categorieën. Bronnen en Datakwaliteit wegen ieder 25%,
Koppelingen en Doorrekening ieder 20% en Beheerbaarheid 10%. Een blokkerende
bevinding kost 35 punten binnen haar categorie, een waarschuwing 12 punten. Bij een
blokkerende bevinding wordt de totaalscore begrensd en is het oordeel Niet op koers.
De methode en haar inhoudelijke grens staan in ieder geëxporteerd rapport.

De severity volgt of een beveiliging heeft gewerkt of gefaald, niet of ze is
aangesproken. Een veilig geblokkeerd locatieconflict — identiteit en locatie wijzen
naar verschillende assets, dus BiDash weigert de koppeling en rekent geen impact — is
een waarschuwing, geen blokker; de beveiliging doet juist haar werk. Blokkerend is
pas een conflict dat tóch een koppeling of impact kreeg, of een dienst die een exact
percentage toont terwijl meldingen niet zijn doorgerekend. Een bevestigde bron met
open storingen die stil als nul verlies zou tellen, is eveneens blokkerend. Een
geladen maar lege BI-werkruimte (nul assets, nul functies) is een waarschuwing, niet
een geslaagde beoordeling. Duplicaten worden pas geteld bij gelijk event-ID en
bronbestand naast dezelfde asset, tijd, foutcode en locatie, zodat dezelfde plek uit
twee bronbestanden geen vals duplicaat oplevert. Het verschil tussen bronregels en
verwerkte assets, en tussen bronregels en getoonde meldingen, wordt uitgesplitst
zodra de engine die telling meelevert. De storingsketen is geen filter maar een
samenvoeging: naast de actuele bronregels komen afgeleide open meldingen mee, dus de
uitvoer kan groter zijn dan de ruwe bronregels. Een dekkingspercentage verschijnt
daarom alleen zolang de meldingen een deelverzameling van de bronregels zijn;
daarboven worden de aantallen zonder misleidend percentage boven 100% getoond. Bij de
niet-doorgerekende bronregels is "zichtbaar maar niet doorgerekend" het totaal;
"zonder passende foutregel" en "zonder locatie" zijn deelredenen daarvan (getoond als
"waarvan") en het resterende deel, zoals een locatieconflict met wél een foutregel,
wordt expliciet benoemd zodat de getallen optellen.

De laatste volledige audit staat in `qualityAudit`. `qualityHistory` bewaart maximaal
twaalf kleine trendsnapshots met tijd, score, oordeel en aantallen. Beide velden
blijven lokaal en gaan alleen mee wanneer de exportselectie `quality` bevat. Het
rapport bevat geen volledige bronregels. Een afwijkende controle mag maximaal
honderd minimale herstelidentifiers bevatten, zoals melding-ID, assetnaam, type,
foutcode, locatie, bron en rekenstatus.

`site/core/query-filter.js` voert de queryfilters van Assetregister en Open storingen
uit. Iedere regel kan een andere kolom gebruiken en wordt vanaf de tweede regel met
EN of OF verbonden. EN krijgt volgens SQL-logica voorrang. Het afgeleide veld `assetFaultCodes` groepeert
alle actuele foutcodes per `assetKey`, zodat een EN-query op code 1001 en 1003 een
combinatie op hetzelfde asset betekent en niet een onmogelijke combinatie op één melding.

`site/engines/dvm-fault-rule-manager.js` bewaart expliciete melding-codekoppelingen in
`RULES.cfg.foutToewijzingen`. De toewijzing krijgt voorrang op patroonherkenning,
maar pas nadat de gewone asset- en locatiecontrole is uitgevoerd. Een locatieconflict
blijft daardoor niet-doorgerekend.

## DRIP meldingen en ontbrekende doorrekening

Sinds BiDash 2.11 gebruikt Open storingen dezelfde verwerkte bronselectie als de
landelijke telling. Een melding zonder passende foutregel of met een locatieconflict
blijft bewaard in `STATE.nietDoorgerekend` en zichtbaar met reden. Zij telt mee als
open melding, maar krijgt geen verzonnen impact. Het betrokken assettype heeft dan
geen exact beschikbaarheidspercentage, ook niet bij bevestigde bronvolledigheid.
Het rekenverslag toont de niet doorgerekende bronregels apart. Oudere detailgrafieken
bevatten uitsluitend het doorgerekende deel; de waarschuwing benoemt die beperking.

De oorspronkelijke starttijd, bronduur en onzekerheidsmarkering blijven behouden.
Een onbekende duur verschijnt als Onbekend; nul uur blijft nul. Onzekere duren
worden niet gebruikt voor het gemiddelde in de open-storingenmemo. Bronpeildatum
betekent niet dat de storing vandaag nog openstaat.

DRIP-koppelingen controleren weg, richting en hectometer, ook bij een opgeslagen
alias. Een DRIP-code (DBD/BD/D…) is geen unieke, hoofdletterongevoelige identiteit:
dezelfde code komt in meerdere verkeerscentralegebieden voor. Een alias op enkel de
code wordt daarom niet blind gevolgd. Past de alias qua locatie bij de bronregel,
dan wordt hij gebruikt; wijkt hij af, dan negeert BiDash de alias en koppelt het
primair op locatie. Lukt die locatiekoppeling — er staat een passend DRIP-asset op
de bronlocatie — dan koppelt BiDash daarop. Pas wanneer ook locatiekoppeling niet
lukt, blijft het een veilig geblokkeerd locatieconflict. Een conflicterende alias
blijft opgeslagen voor controle maar wordt niet gebruikt om de bronlocatie te
vervangen. Bij classificatie wordt de oorspronkelijke Dynac-locatie uit oudere
exports herkend, inclusief underscores en hectometer met koppelteken. RIA4 en
windwaarschuwing blijven afzonderlijke kenmerken.

Eén nog openstaande DRIP-storing is één doorlopende toestand. Melden meerdere bronnen
(bijvoorbeeld een DRIP-totaalbestand en een CDMS-mapscan) dezelfde open storing met
een andere waargenomen starttijd, dan ontdubbelt de afleiding van open DRIP-meldingen
op code, gebied en locatie — met behoud van de vroegste start — zodat de storing niet
dubbel in de open-storingenlijst telt. Een hergebruikte code in een ander gebied of
op een andere plek blijft een eigen storing. De historische prognosebron behoudt de
episodes per tijdvenster.

### DRIP-foutregels en de leidende toestand

Sinds BiDash 2.13 / DVM 83 kennen DRIP-storingen wél een passende foutregel. Eerder
had `RULES.foutcodes` geen enkele regel met assetType `DRIP`, dus gaf `foutregel()`
altijd `null` en bleef elke DRIP-melding staan met "Passende foutregel ontbreekt".
`doorrekenen()` liet die meldingen dan vallen, waardoor de dienstverlening te gunstig
uitkwam. Er zijn nu twee lagen die samen de impact bepalen.

De eerste laag matcht de alarmtekst op de bekende DRIP-alarmen, net als bij MSI. Een
verloren displaycontact geldt als volledige uitval (100/100), een kritische
LED-storing weegt zwaar (80/95), een temperatuuroverschrijding matig (25/40), een
minor LED-status licht (10/30), een reset zeer licht (5/10) en een open kastdeur is
een bekende storing zonder dienstimpact (0/0). De regels gebruiken max-wint, dus de
zwaarste passende regel bepaalt de score binnen een samengestelde melding.

De tweede laag is leidend: de functionele toestand uit de bron (`technische_toestand`
GESTOPT/IN-BEDRIJF en `classificatie` LANGDURIG/INTERMITTEREND) gaat vóór de
alarmtekst. Een volledig gestopt paneel telt als volledige uitval, ongeacht welk
alarm gemeld is. Een paneel dat gestopt is geweest en weer in bedrijf is, legt een
ondergrens: langdurig 60/70, intermitterend 25/40. Een paneel dat in bedrijf is met
alleen een gemeld alarm houdt de alarmwaarde laag. Zonder toestand valt de melding
terug op de classificatie, en zonder toestand én zonder classificatie én zonder
passende alarmregel blijft de melding bewust onbekend: zij telt als open melding maar
krijgt geen verzonnen impact.

De percentages zijn een instelbaar model, geen vastgesteld RWS-getal. Zij maken de
DRIP-dienstverlening bespreekbaar en toetsbaar; validatie met RWS kan de waarden
bijstellen zonder de structuur te wijzigen. `tests/drip-foutregel.test.js` legt zowel
de percentages als de leidende toestand vast en voert daarvoor de verzonden
implementatie uit `dvm-1.js` en `dvm-2.js` uit.


## Vraag BiDash: lokale chat boven bestaande data

BiDash 2.17 bevat in de hoofdschil een popup met een deterministische queryassistent. De assistent gebruikt geen AI en maakt geen externe verbinding. Vragen worden lokaal vertaald naar vaste filters en aggregaties op reeds door de adapters aangeboden data. De assistent rekent geen nieuwe dienstimpact of verkeerskosten uit: impact, beschikbaarheid en kosten komen uit de bestaande DVM-uitkomsten.

De gebruiker kan kiezen tussen **Dit scherm en de huidige filters** en **Alle beschikbare data**. Een vervolgvraag erft de context van de vorige vraag, zodat bijvoorbeeld na “Hoeveel MSI-storingen zijn er op de A15 in ZWN?” kan worden gevraagd “Welke foutcodes komen het meest voor?”. De eerste versie ondersteunt actuele storingen, assets, foutcodes, bestaande dienstverleningsuitkomsten en bestaande wegdeelkosten/VVU.

De actie **Gebruik als filter** zet ondersteunde storings- en assetcontext terug in de bestaande native filters/querybouwer. **Open bijbehorende data** navigeert naar de bestaande BiDash-weergave. De chat creëert daarmee geen tweede datamodel of tweede rekenketen.


## Integrale Context API en Vraag BiDash 2.18

`site/core/context-api.js` vormt een read-only contextlaag boven de bestaande adapters. De contextlaag rekent geen dienstimpact, beschikbaarheid, verkeerskosten of FTE opnieuw uit. DVM blijft eigenaar van open storingen, assetimpact, subprocessen, dienstverlening, werkzaamheden, U-routes en EOL-context; BI blijft eigenaar van bedrijfsfuncties, formatie, planning en planningscapaciteit.

De DVM-adapter levert voor de contextlaag de bestaande tracebijdrage per storing, de landelijke dienstuitkomst en per dienst de reeds geconfigureerde subprocess- en assettype-afhankelijkheden. De BI-adapter levert het effectieve planningmodel, afhankelijkheidsrelaties en de bestaande capaciteitsvraag per kwartaal en planningsdienst. De hoofdschil combineert deze read-only contracten met expliciete dienst-functiekoppelingen uit `state.links`.

De lokale queryassistent kan daardoor onder meer de volgende paden tonen:

```text
open storing
  -> assettype
  -> geconfigureerde bronafhankelijkheid van een subproces
  -> aandeel van dat subproces in de dienst
  -> bestaande dienstuitkomst
```

en:

```text
dienst
  -> dienstgekoppelde open storingen
  -> weg/corridor of gekoppeld asset
  -> planningactiviteit / werkzaamheid / U-route
```

Voor planning gebruikt de assistent de effectieve datums uit het live planningmodel, inclusief actieve shifts. Capaciteitsvragen gebruiken uitsluitend `bridgeCapaciteit()` en de ingestelde capaciteitsgrenzen. Een samenloop van planning en storing op dezelfde corridor is een raakvlak, geen bewijs dat de planning de storing veroorzaakt. De chat benoemt dit onderscheid expliciet.

Een gewogen verliesbijdrage in de chat is uitsluitend bedoeld om storingen binnen een dienst te rangschikken. Zij wordt afgeleid uit de bestaande tracebijdrage en de reeds ingestelde subprocess-/assettypeweging. Deze waarde mag niet als zelfstandig optelbaar dienstpercentage worden gepresenteerd.

Historische storingen blijven in de huidige versie primair prognosebron. De Context API meldt welke historische bronstromen zijn geladen en hoeveel records zij bevatten; zij materialiseert niet bij elke chatvraag alle ruwe historische regels in het geheugen. Dit voorkomt dat de queryinterface de performancewinst van gescheiden historische data ongedaan maakt.

De queryassistent blijft volledig lokaal. Er is geen AI-call of netwerkendpoint toegevoegd; de Content Security Policy `connect-src 'none'` blijft leidend.


### Planning als dynamisch vocabulaire

Vanaf BiDash 2.19 heeft de queryassistent geen statische lijst nodig met planningafkortingen. De Context API bewaart per planningregel naast naam en code ook WBS, WBS-pad, blok, dienst en activiteitstype. De queryassistent gebruikt deze velden als lokaal zoekvocabulaire.

Wanneer een vraag geen bekend domeinwoord bevat maar wel een term die in de geladen planning voorkomt, wordt die term als planningreferentie gebruikt. Dit is een expliciete domeinherkenning en verbreekt daarom een eerdere niet-planningcontext. Voor `wanneer`-, `eerstvolgende`- en `meest recente`-vragen worden matches op de effectieve planningdatums gerangschikt.

De terminologie blijft daarmee data-gedreven: een nieuwe afkorting, projectnaam, mijlpaalcode of WBS-term wordt bevraagbaar zodra deze in het planningmodel is geladen, zonder wijziging van de queryparser.


## All Assets als bron voor assetleeftijd en EOL

Vanaf BiDash 2.20 / DVM 103 bestaat geen afzonderlijke EOL-referentiebron meer. De assetparser normaliseert installatie-/ingebruiknamedatum, bouwjaar, EOL-jaar en expliciete levensduur rechtstreeks uit All Assets. De universele importer mag een EOL-kolom daarom wel als onderdeel van een assetregister herkennen, maar maakt nooit meer een zelfstandige EOL-dataset.

De levensduurketen gebruikt per asset achtereenvolgens een bewuste individuele configuratie, een handmatige fabrikant×type-override, expliciete levensduur/EOL uit All Assets en daarna de generieke assettypewaarde. Een EOL-jaar uit All Assets kan samen met het installatiejaar een levensduur opleveren. De vroegere fabrikant-factsheet/EOL-referentie en de bijbehorende upload-, import-, export- en contextstate zijn verwijderd.

De Context API levert installatie-/ingebruiknamedatum, bouwjaar en EOL-jaar uit het assetregister aan Vraag BiDash. Vragen als `Wat is het oudste asset?` en `Wat is het nieuwste asset?` rangschikken uitsluitend assets met een bruikbare installatiedatum of bouwjaar. Ontbrekende datums worden niet geïnterpreteerd als nul of als het oudste jaar.
