# BiDash — systeemwerking en kwaliteitscontract

Status: beschrijving van Integratie 2.13, bijgewerkt op 14 september 2026 voor de actuele storingslijstsynchronisatie, het configureerbare live-overzichtsfilter, de geïntegreerde Help-pagina en zichtbare voortgang bij gegevensimport.
Dit document bevat geen operationele brongegevens. Bij een functionele wijziging moeten code, tests, `docs/GEBRUIKERSHULP.md`, `docs/processflow.md`, de gepubliceerde Help-pagina en deze beschrijving samen worden beoordeeld en waar nodig bijgewerkt.

## 1. Doel en grenzen

BiDash brengt dienstverlening, buitenassets, verkeerskosten, personele capaciteit,
contracten en planning samen voor besluitvorming. De gebruiker laadt eigen lokale
bestanden. GitHub Pages host uitsluitend de applicatie; gegevensverwerking en
opslag vinden in de browser plaats.

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
| Gegevenscontract | `site/core/model.js` | Deelimport, selectie-export, validatie, gecombineerde signalen |
| Live storingssync | `site/core/live-snapshot.js` | Vervangen actuele momentopname, vergelijken met vorige lijst en historiseren verdwenen MSI-storingen |
| Live overzichtsfilter | `site/core/live-overview-filter.js` | Gebruikersselectie van open meldingen die in de actuele DVM-doorrekening meetellen, zonder de bronmomentopname te veranderen |
| Opslag | `site/core/storage.js` | IndexedDB, transactioneel schrijven |
| DVM | `site/engines/dvm.html`, `dvm-1.js` t/m `dvm-3.js` | Buitenassets, storingen, dienstimpact, verkeerskosten, prognoses, memo’s |
| BI | `site/engines/bi.html`, `bi-1.js` t/m `bi-3.js` | Formatie, capaciteit, contracten, interne bedienketens |
| Planning | `site/engines/planning.html` | XML-model, WBS, afhankelijkheden, verschuivingen, planninggrafieken; begint leeg, alle projectgegevens komen uit geladen bestanden |
| Bruggen | `*-adapter.js` | Expliciete gegevensuitwisseling via `window.HUB` |
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
| Regels & signalen | Signalering, dienst-functiekoppelingen, domeinregels |
| Scenario’s | Huidige verkeerskosten, MSI-toekomst, BI-scenario’s; DRIP via DVM |
| Data & export | Lokale import met zichtbare voortgang, datasetbeheer inclusief live storingsfilter, lokale kwaliteitsaudit, selectieve back-up, oorspronkelijke broninvoer |
| Help | Gebruikersuitleg, aanbevolen laadvolgorde, actuele storingslijst en procesflow |

Rechtsboven in de hoofdwerkruimte staat een Help-knop naar `site/help.html`. Die pagina is onderdeel van de gepubliceerde `site/`-map en werkt dus ook wanneer de repository later niet publiek toegankelijk is. De inhoud volgt de documentatie in `docs/`.

Behoud verdiepende doorklikken, filters, bronvermelding, scope en terugnavigatie.
Een nieuwe navigatie mag oorspronkelijke analyses niet onbereikbaar maken.

## 4. Lokale gegevens en beveiliging

De hoofdwerkruimte heeft `schema: 1` en bevat `dvm`, `bi`, `planning`, `links`,
`history`, `qualityAudit` en `qualityHistory`. IndexedDB gebruikt database
`bidash-integraal`, objectstore `workspace`,
sleutel `current`. Modules gebruiken daarnaast lokale browseropslag. Een back-up
is een gedownloade export; browseropslag is geen garantie tegen gegevensverlies.
Gebruik één werkruimte-tab tegelijk; er is geen uitgewerkte meergebruikerssynchronisatie.

- Geen uploads van gebruikersbestanden naar GitHub, telemetrie of externe AI-diensten.
- Geen operationele XML/JSON, uitsneden, screenshots of afgeleide operationele tellingen in de repository of publiek
- Dat geldt ook voor gegevens die als voorbeeld of demonstratie in de broncode staan. Een ingesloten projectplanning, portfolio- of triggerlijst is een publicatie van die gegevens, ook als geen enkel scherm haar toont. Een module begint leeg en toont wat de gebruiker laadt. `tests/planning-geen-projectdata.test.js` bewaakt dit voor de planningmodulee CI-logs. Gebruik synthetische testgegevens.
- Behoud het bestaande Content Security Policy en `connect-src 'none'`. Externe bronlinks kunnen de browser verlaten; dat is geen toestemming om datasets te verzenden.
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

De aanbevolen DVM-volgorde is All Assets, EOL, historische storingen, U-routes, werkzaamheden en als laatste de actuele open storingslijst. De actuele storingslijst is de volledige momentopname voor het live dashboard. Daarna kan de gebruiker in Datasetbeheer instellen welke open meldingen in de actuele doorrekening meetellen. Historische storingen zijn een aparte gegevensstroom voor historie en prognose en worden door dat live filter niet gewijzigd.

Naast de losse Open storingen- en Storingshistorie-uploads is er een gecombineerde bron **Signaalgevers totaal (JSON)**. Dat is één exportbestand (`datasets.mtm`) met zowel de open alarmen als de historische storingen. `signaalgeverTotaalBronnen()` in `dvm-3.js` zet de records om naar rijen die `normRij()` al kent: `alarm_episodes` met `eindstatus: "open_aan_einde"` (en `meenemen !== false`) worden de open-storingenstroom, `storingen` worden de historie. Elke open alarmregel draagt haar omschrijving als `melding`, aangevuld met `categorie` en signaalgever (`unit`), zodat de bestaande MSI-foutregels blijven matchen én `classificeer()` de rij als MSI herkent ook als de omschrijving zelf geen type-trefwoord bevat; een historische storing zonder omschrijving krijgt `signaalgever + impactklasse` als melding met hetzelfde doel. Die herkenning is nodig omdat de actuele doorrekening pas start bij minstens één herkende open melding — anders blijft het dashboard op "geen bron geladen" staan. Foutcodes zonder passende MSI-regel blijven — net als voorheen — zichtbaar maar niet-doorgerekend; er worden geen nieuwe impactregels verzonnen. De bron is bewust een óf/óf-keuze: bij het laden vervangt ze de losse Open storingen- en Storingshistorie-bronnen (vervang-modus), zodat oud bestandsformaat nooit met de JSON mengt. De oude uploadknoppen blijven bestaan voor de bestaande werkwijze. De bronnen dragen een `_signaalgeverTotaal`-vlag zodat Datasetbeheer ze onder de eigen kaart "Signaalgevers totaal" toont in plaats van onder Open storingen en Storingshistorie (die dan leeg blijven); de doorrekening gebruikt onverminderd `STORINGSBRONNEN` en `LIVE_STORINGSBRONNEN`. Verwijderen op die kaart wist beide stores in één keer.

De `storingen`-tabel bestaat in twee schema's. `signaalgeverHistorieRij()` en `signaalgeverOpenRij()` lezen beide: v2.0 (`signaalgever`, `foutcodes`, `impactklassen`, `incident_venster_uur`, `laatste_bewezen_aanwezig`) én v2.5 (`asset`, `foutcode`, `impactklasse`, `duur_min_uur`, `einde_bewezen`, met een `omschrijving`). De omschrijving gaat mee als `melding`, aangevuld met signaalgever/impactklasse, zodat `classificeer()` de rij als MSI herkent. Zonder die herkenning startte de actuele doorrekening niet.

### Signaalgevers uit een map lezen

Naast het gecombineerde JSON-bestand kan BiDash de ruwe MTM-storinglijsten rechtstreeks lezen via een eigen bronkaart "Signaalgevers uit map (MTM)". Een configuratiedialoog vraagt eerst om regio('s), een optionele periode en een optioneel basisbestand; daarna volgt de mapkeuze. In Edge/Chrome gebruikt BiDash `showDirectoryPicker` en loopt `sgVerzamelViaHandle()` alleen `mtm/<gekozen vc>/storinglijst/<gekozen periode>` af — de overige mappen van de X-schijf worden tijdens het aflopen gesnoeid (`sgVolgendeCtx()`/`sgBuitenPeriode()`), zodat de hele schijf niet wordt ingelezen. Waar die picker niet beschikbaar is, geldt een `webkitdirectory`-terugval die de hele gekozen map inleest. `sbFilterBestanden()` beperkt de te lezen bestanden op regio en periode zodat een grote map niet in één keer wordt verwerkt, en `sbCombineerMetBasis()` werkt in een meegegeven basis alleen de gekozen regio's bij. `dvm-storingsbundelaar.js` is een BiDash-poort van de lokale bundelaar en verwerkt bestanden onder `mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>`. Per bestand leest `sbMtmRijenUitTekst()` de alarmregels (`|id|code|omschrijving|locatie|start|`), `sbBouwBundel()` reconstrueert per verkeerscentrale de alarmruns over de opeenvolgende momentopnamen — met een betrouwbare snapshot-afstand zodat een datagat een run splitst — en `sbClassificeer()` maakt de langdurige en intermitterende storingen. Alleen wat BiDash gebruikt wordt bewaard: de open alarmen (`eindstatus: "open_aan_einde"`) en de geclassificeerde storingen. De ruwe alarmruns en episodes blijven in het geheugen en gaan niet de opslag in, zodat de werkruimte klein blijft. Het resultaat loopt door dezelfde koppeling en doorrekening als de JSON-bron (`pasSignaalgeverBundelToe()`). De mapkeuze werkt in Chromium/Edge; parsing zelf is browseronafhankelijk.

De hoofdapp activeert `site/core/load-progress.js` voordat `app.js` de bestandkeuze verwerkt. Voor de gewone Data & export-route wordt `File.text()` alleen tijdens een actieve importsessie vervangen door een `FileReader`-lezing met dezelfde tekstuitkomst en echte bytevoortgang. Na het leesmoment laat de module eerst een browserpaint plaatsvinden voordat de bestaande JSON- of XML-verwerking verdergaat. Dit voorkomt geen zware synchrone parse, maar zorgt dat de gebruiker vóór zo'n parse ziet welk bestand en welke fase actief is.

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
Native hub-XML-export levert de originele XML. De planningknop voor terugexport
van een scenario past de datums toe in een kopie. Verwar deze twee exports niet.

`history` bestaat in het integrale model en wordt programmatisch ondersteund,
maar staat niet in de huidige hub-selectievakken. DVM-kostendagstanden zijn een
aparte opslagroute binnen de DVM-kostenconfiguratie. Presenteer die niet als dezelfde historie.

## 6. DVM: van storing naar dienstverlening

Actueel en prognose zijn gescheiden:

- Live resultaten beginnen met de volledige open storingsmomentopname op de bronpeildatum van de laatst geladen actuele lijst.
- Een nieuw open-storingenbestand vervangt de vorige actuele momentopname volledig, ook als de bestandsnaam anders is.
- De invoer Open storingen accepteert XLSX, XLS en CSV wanneer de inhoud herkenbare DVM-storingsregels bevat. De expliciete open-storingenroute vereist niet meer dat de oude snapshot-heuristiek op basis van status of peildatum slaagt.
- Bij vervanging vergelijkt `site/core/live-snapshot.js` de oude en nieuwe momentopname. Event-id heeft voorrang als storingidentiteit. Zonder event-id wordt een stabiele combinatie gebruikt van asset, starttijd, weg, richting, hectometer, strook, foutcode, melding en gevolg.
- Een MSI-storing die in de vorige actuele lijst stond en in de nieuwe lijst ontbreekt wordt afgesloten op de peildatum van de nieuwe lijst en toegevoegd aan `STORINGSBRONNEN` als automatische historische bron.
- Automatisch afgesloten storingen worden ontdubbeld tegen de bestaande historie. Dezelfde verdwenen storing mag dus niet bij iedere volgende import opnieuw worden toegevoegd.
- De duur die uit zo'n automatische afsluiting volgt is een bovengrens, geen meting: het herstel lag ergens tussen de vorige en de nieuwe momentopname. `closeHistoryRow()` legt dat vast in `_afgeslotenDoorNieuweMomentopname` en `_afsluitPeildatum`; `normRij()` zet dat om in `duurAfgeleid` en `duurBetrouwbaar`. Alleen een gemeten duur telt mee in de duurdekking en in de herstelduurverdeling. Een afgeleide duur valt in de simulatiepool terug op de ingestelde MTTR, net als een melding zonder duur, zodat de herstelduur niet meegroeit met de afstand tussen twee momentopnamen. De duur zelf blijft beschikbaar voor de assetverliesuren binnen de rapportageperiode en wordt in memo's gemarkeerd als afgeleid.
- Alleen MSI-storingen worden door deze overgang automatisch naar de signaalgever-storingshistorie verplaatst. Andere assettypen blijven buiten deze specifieke automatische historisering totdat daarvoor een expliciete productregel bestaat.
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
- RIA4 en Windwaarschuwing zijn onafhankelijke DRIP-classificaties. Een gecombineerd bronbestand wordt per gemarkeerde regel gesplitst. De koppeling gebruikt een identifier met locatiecontrole en anders VC, weg, richting en hectometer. Een hergebruikte DRIP-code in een ander gebied mag daardoor geen classificatie overnemen.
- Een classificatie draagt haar eigen herkomst. `classifiedRows()` levert `herkomst` (`markering` of `aanname`), `markerKolommen` en `rijenBron`. Naast de vaste kopteksten gelden samenstellingen als `RIA-4 DRIP` en `Windwaarschuwing DRIP` als markering; windmeetkolommen (`richting`, `snelheid`, `kracht`, `meting`, `sensor`, `graden`) nadrukkelijk niet, want die beschrijven het weer en niet de soort DRIP. Wordt geen markerkolom herkend, dan is de soort een aanname van de gebruiker over het hele bestand. Die aanname moet zichtbaar zijn in de laadmelding en op de bronkaart, en gaat mee in de totaalexport zodat een herstelde bundel haar niet stilzwijgend tot vaststelling maakt.
- De brondag is niet automatisch vandaag. NDW-meetmoment, exportdatum en prognoseperiode zijn afzonderlijke datums en moeten herkenbaar blijven.
- Assetregister en EOL bepalen populatie, kenmerken en levensduurgegevens.
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
| Navigatie/import/opslag | `tests/browser.cjs`: MS Project, P6, zichtbare tijdlijn, export/herstel, mobiel |
| Datalaadvoortgang | `tests/data-load-progress.test.js`: byteaggregatie, begrenzing, FileReader-pad, paint-yield en DVM-voortgangsbrug |
| Canvas/tijdschaal/drag | `tests/planning-large.cjs`: grote synthetische planning, scrollen, slepen, resizen |
| Formatie/BI-brug/fullscreen | `tests/planning-formation.cjs`: overlappende taken, regelwijziging, reload, grafieken |
| Live storingsmomentopname | `tests/live-snapshot.test.js`: identiteit, dubbelen, verdwijnen en afsluiten |
| Afgeleide hersteltijd | `tests/afgeleide-hersteltijd.test.js`: herkomst vastgelegd, markering in `normRij`, duurverdeling stabiel bij een verder weg liggende peildatum |
| Dienstaandelen en dienstwaarde | `tests/dienst-aandelen.test.js`: gesloten aandelen na laden, ontbrekend aandeel als 1, expliciete aandelen, onvolledige dekking blijft een band |
| Herkomst DRIP-classificatie | `tests/drip-markerherkomst.test.js`: samengestelde kopteksten als markering, windmeting niet, aanname vastgelegd met regelaantal, herkomst door export en herstel, zichtbaar in de bronkaart |
| Runtime-patches installeren | `tests/runtime-patches.test.js`: elke patch zet zijn vlag in een eigen scope, de koppeling in `signal-forecast.js` klopt met de registratie, geparkeerde patches blijven een vastgelegde keuze, geen patch zonder registratie |
| Brondekking open meldingen | `tests/brondekking-open-meldingen.test.js`: bronaantal per type, niet-doorgerekende meldingen benoemd, blind type wordt onbekend, gedeeltelijk doorgerekend type houdt een waarde en voedt het subproces, locatie uit het register voor afgeleide DRIP-regels |
| Beheerder in de storingslijst | `tests/storingslijst-beheerder.test.js`: nooit een getal als beheerder, afleiding uit de verkeerscentrale, herkende bronwaarde blijft staan |
| Planning zonder projectdata | `tests/planning-geen-projectdata.test.js`: geen objectnamen in de code, lege P6-, portfolio- en modelstructuren, tellers op nul, werkende triggerlaadroute met overgeslagen onvolledige regels |
| Versiebalk | `tests/versiebalk.test.js`: schilversie zichtbaar zonder geladen module, gemelde engineversies erachter, lege melding blijft weg, versienummer op precies één plek |
| Kwaliteitsaudit | `tests/quality-audit.test.js`: lege werkruimte, gezonde keten, bron-dashboardbreuk, onbekende impact naast exact dienstpercentage, veilig geblokkeerd conflict als waarschuwing, gelekt conflict als blokker, lege BI-werkruimte, asset- en bronregelverschil, duplicaat op event-ID en bronbestand, en zichtbare bediening/export |
| Live overzichtsfilter | `tests/live-overview-filter.test.js`: defaults, uitsluitingen, lege waarden, nieuwe waarden, bronbehoud en DVM-parameteropslag |
| Help/documentatie | Controleer `site/help.html`, Help-link in `site/index.html` en overeenstemming met `docs/GEBRUIKERSHULP.md` en `docs/processflow.md` |
| DVM-regels/kosten/prognose | Aanvullende gerichte numerieke tests en scopes; bestaande tests dekken niet alle formules |
| DRIP actueel/classificatie | `tests/drip-open-from-history.test.js`, `tests/drip-special-lists.test.js` en een lokale controle met een volledige DRIP-export zonder die brondata in Git op te nemen |
| DRIP-foutregels en toestand | `tests/drip-foutregel.test.js`: de verzonden DRIP-foutcodes met de afgesproken percentages, alarmtekst matcht (display verloren, kritische LED, deur, reset), de functionele toestand (GESTOPT/IN-BEDRIJF, LANGDURIG/INTERMITTEREND) is leidend, een ongedefinieerde fout blijft onbekend, MSI/CAM ongewijzigd |
| Signaalgevers totaal (JSON) | `tests/signaalgever-totaal.test.js`: `signaalgeverTotaalBronnen()` filtert open alarmen op eindstatus en `meenemen`, zet storingen om naar historie, de rijen worden door `normRij()` begrepen (open alarm als MSI met passende foutregel, historische storing zonder omschrijving via signaalgever als MSI herkend), en de bron is in `dvm-source-manager.js` geregistreerd met een eigen JSON-knop, handler en of/of-vervangmodus |
| Signaalgevers uit map | `tests/storingsbundelaar.test.js`: `sbMtmRijenUitTekst()` parseert een storinglijst (locatie, code, unit, categorie/meenemen), `sbBouwBundel()` sluit een verdwenen alarm en houdt een blijvend alarm open_aan_einde, `sbClassificeer()` maakt langdurig/intermitterend, `sbPadInfoMtm()` weigert paden buiten mtm/<vc>/storinglijst, `sbFilterBestanden()` beperkt op regio en periode, `sbCombineerMetBasis()` vervangt alleen de gekozen regio, `sgVolgendeCtx()`/`sgBuitenPeriode()` snoeien de maptraversal buiten mtm en buiten de regio/periode, en de bundeluitvoer (v2.5-velden) wordt door de schema-tolerante mapping als MSI herkend |
| Memo/print | Controleer selectie, bron/run, optionele kosten en grafieken in printweergave |
| Privacy | Geen externe gegevensverzoeken in browserroutes; geen operationele data in diff/artifact |
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
zodra de engine die telling meelevert.

De laatste volledige audit staat in `qualityAudit`. `qualityHistory` bewaart maximaal
twaalf kleine trendsnapshots met tijd, score, oordeel en aantallen. Beide velden
blijven lokaal en gaan alleen mee wanneer de exportselectie `quality` bevat. Het
rapport bevat geen bronregels of assetnamen.

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
alias. Een conflicterende alias blijft opgeslagen voor controle maar wordt niet
gebruikt om de bronlocatie te vervangen. Bij classificatie wordt de oorspronkelijke
Dynac-locatie uit oudere exports herkend, inclusief underscores en hectometer met
koppelteken. RIA4 en windwaarschuwing blijven afzonderlijke kenmerken.

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
