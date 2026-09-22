# BiDash gebruikershulp

Deze uitleg hoort bij de Help-knop rechtsboven in BiDash. Help bevat geen tweede, handmatig bijgehouden kopie van deze tekst. Tijdens testen en publicatie wordt de map `docs/` gebundeld en toont `site/help.html` de echte Markdown-bestanden rechtstreeks, inclusief tabellen, links en SVG-afbeeldingen uit `docs/afbeeldingen/`.

De standaardweergave is de processflow. Via de documentnavigatie zijn onder andere deze gebruikershulp, de logische architectuur, het rekenvoorbeeld, de systeemwerking en release notes bereikbaar. Daardoor wordt een wijziging in de Markdown-documentatie bij de eerstvolgende publicatie ook de inhoud van Help.

## Welke versie je voor je hebt

Rechtsboven in de balk staat de versie, naast de Help-knop. Direct na het openen
staat daar de versie van BiDash zelf, bijvoorbeeld `BiDash 2.13`. Zodra je een
module opent die een eigen versie bijhoudt, komt die erachter: `BiDash 2.13 · DVM 82`.
Onderin de navigatie staat hetzelfde nummer als `Integratie 2.13`. Noem dat nummer
bij een melding over een verschil in uitkomsten; zonder versie is een uitkomst niet
terug te vinden.

## Planning en triggers laden

De planningmodule bevatte eerder een vaste, in de code opgenomen planning met
werkelijke projecten, tunnels en openstellingsdata. Die is verwijderd. De module
begint nu leeg en toont wat je zelf laadt:

1. **Planning-XML** — een Primavera P6-export, via **Planning importeren**. Dit vult
   de tijdlijn, de WBS-structuur, relaties en de formatiegrafieken.
2. **Triggerbestand** — optioneel, JSON, op hetzelfde scherm. Dit vult het
   triggerpaneel en de tellers Rode en Oranje triggers in de balk bovenaan.

Zonder triggerbestand staan die tellers op nul en zegt het triggerpaneel dat er
niets geladen is. Dat is geen storing: er is dan geen bron.

Een sjabloon staat in [`voorbeeld-triggers.json`](voorbeeld-triggers.json). Per
trigger:

| Veld | Verplicht | Wat erin hoort |
|---|---|---|
| `naam` | ja | Korte omschrijving |
| `klasse` | ja | `rood` of `oranje`; een andere waarde wordt overgeslagen |
| `oorzaak` | ja | Wat er is gebeurd en waarom dat een besluit vraagt |
| `urgentie` | nee | Label in de badge; standaard afgeleid uit `klasse` |
| `oorzaakcat` | nee | Categorie, getoond onder de naam |
| `impact` | nee | Per dienst wat het betekent |
| `besluitopties` | nee | De keuzes die voorliggen |
| `deadline` | nee | Datum waarvoor het besluit moet vallen |
| `diensten` | nee | Betrokken diensten |

Een regel zonder `naam`, `oorzaak` of een geldige `klasse` wordt overgeslagen; de
melding na het laden noemt hoeveel regels zijn geladen en hoeveel zijn
overgeslagen. Een bestand zonder bruikbare regels geeft een foutmelding in plaats
van een leeg paneel.

Het triggerbestand blijft in het geheugen van deze sessie. Herlaad je de pagina,
dan laad je het opnieuw.

## Aanbevolen laadvolgorde

1. Laad All Assets als technisch stamregister. Installatie-/ingebruiknamedatum, EOL en eventuele expliciete levensduur komen uit ditzelfde bestand.
2. Laad historische storingsbestanden voor historie en prognosekalibratie.
3. Laad U-routes en geplande werkzaamheden als operationele context.
4. Laad als laatste de actuele open storingslijst voor het live dashboard.
5. Stel desgewenst in Datasetbeheer het filter in voor de open storingen die in het actuele overzicht mogen meetellen.
6. Laad BI-gegevens en planning voor formatie, contracten en uitvoerbaarheid.

Historische storingen en actuele open storingen zijn twee verschillende gegevensstromen. Historische meldingen mogen het live dashboard niet beïnvloeden. Bij DRIP-historie leidt BiDash alleen incidenten af die aantoonbaar aan het actuele einde van hun eigen bron nog open staan. Oude gecensureerde incidenten worden niet als huidige storing meegenomen.

### Signaalgevers totaal (JSON)

Wil je open storingen én historie in één keer laden, gebruik dan de knop **Signaalgevers totaal (JSON)** in Datasetbeheer. Dat is één gecombineerd exportbestand waarin de open alarmen en de historische storingen al bij elkaar staan. BiDash haalt de open storingen en de historie er zelf uit en koppelt ze aan All Assets, net als bij de losse bestanden.

Deze bron is een óf/óf-keuze en bestaat naast de losse uploads: laad je de JSON, dan vervangt die de eerder geladen Open storingen en Storingshistorie, zodat een oud losbestand nooit met de JSON vermengt. Wil je terug naar de oude werkwijze, laad dan gewoon weer de losse bestanden. Zo kun je de nieuwe bron uitproberen en de oude later uitfaseren zonder dat de cijfers door elkaar lopen. Een gemelde storing waarvoor geen passende foutregel bestaat, blijft — zoals altijd — wel zichtbaar maar telt niet mee in de doorrekening; er wordt geen impact verzonnen.

Naast een kant-en-klaar JSON-bestand kun je de ruwe storinglijsten rechtstreeks laten inlezen met de eigen kaart **Signaalgevers uit map (MTM)** in Datasetbeheer. Er verschijnt eerst een klein venster waarin je kiest voor welke **verkeerscentrale(s)** je leest, optioneel een **periode** (vanaf/tot) en optioneel een eerder **totaal-JSON als basis**. Zo lees je niet in één keer alles, maar bijvoorbeeld één regio of maand tegelijk. Kies daarna de map. In **Edge of Chrome** mag je gewoon de **X-schijf** kiezen: BiDash daalt zelf alleen af in `mtm/<vc>/storinglijst/<jaar>/<maand>/<dag>` voor de gekozen regio en periode en slaat de rest van de schijf over; tijdens het zoeken zie je een voortgangsvenster. Lukt die moderne mapkiezer niet in jouw omgeving, kies dan **`X:\mtm`** (niet heel X:), anders probeert de browser de hele schijf in te lezen. BiDash reconstrueert de open storingen en de historie en bewaart alleen wat het nodig heeft — zo blijft de werkruimte klein genoeg om lokaal op te slaan. Geef je een basisbestand mee, dan worden alleen de gekozen regio's bijgewerkt en blijven de andere regio's staan.

De MTM-bron bevat zowel MSI- als detectoralarmen. De bronwoorden `lus`, `lussen`, `detectie`, `detector`, `detectielus`, `meetlus` en `inductielus` worden allemaal als **Detectielus** verwerkt. Intern gebruikt BiDash hiervoor de technische sleutel `LUS`. Deze sleutel voedt de schakel **detectie** binnen de subprocessen en dienstverlening. De bekende codes 1006, 1007 en 5004 gebruiken de ingestelde detectielusimpact. Een onbekende detectorcode blijft zichtbaar met de melding dat een passende foutregel ontbreekt. Leg daarvoor eerst een inhoudelijk onderbouwde LUS-regel vast; BiDash verzint geen impact.

Verdwijnt een MSI-storing uit de nieuwe momentopname, dan sluit BiDash die af op de peildatum van die lijst. De hersteltijd die daaruit volgt is een bovengrens: het herstel lag ergens tussen de vorige en de nieuwe lijst. Zo'n duur telt daarom niet mee in de herstelduurstatistiek en in de prognose, en wordt in memo's gemarkeerd als afgeleid. Laad je vaker een actuele lijst, dan worden die bovengrenzen scherper.

### DRIP-storingshistorie: totaal-JSON of CDMS-map

De DRIP-storingshistorie werkt op dezelfde manier. De losse XLSX/CSV DRIP-historie-upload is vervangen door twee bronkaarten in Datasetbeheer:

- **DRIP totaal (JSON)**: één bestand met `datasets.drip` (DRIP-episodes en geclassificeerde storingen). Is al een DRIP-bron geladen, dan zie je daarnaast **Voeg JSON toe**. Daarmee voeg je een extra DRIP-totaalbestand complementair toe zonder de bestaande DRIP-bronnen te wissen. Exact overlappende incidenten worden niet dubbel opgenomen. **Bron vervangen** blijft beschikbaar wanneer je de bestaande DRIP-historie bewust volledig wilt vervangen.
- **DRIP uit map (CDMS)**: BiDash leest de ruwe DRIP-logs rechtstreeks en schrijft de gevonden incidenten incrementeel bij op het reeds geladen DRIP totaal. Een maplezing vervangt dus niet meer de bestaande DRIP-historie. Draai je dezelfde regio en periode opnieuw, dan wordt die mapbron ververst; exacte overlap met andere DRIP-bronnen wordt niet dubbel opgenomen. Net als bij de signaalgevers verschijnt eerst een klein venster waarin je **verkeerscentrale(s)**, optioneel een **periode** en optioneel een eerder **DRIP-totaal-JSON als basis** kiest. In **Edge of Chrome** mag je gewoon de **X-schijf** kiezen; BiDash daalt zelf alleen af in `cdms/<vc>/log/<jaar>/<maand>/<dag>` voor de gekozen regio en periode. Tijdens het zoeken beweegt de balk zonder een verzonnen percentage en zie je hoeveel mappen en bestanden al zijn gevonden. Zodra het totaal bekend is, toont BiDash per gelezen bestand de herkende gebeurtenissen, verstreken tijd en een schatting van de resterende tijd. Het zoeken en lezen gebeurt begrensd parallel, met maximaal zes gelijktijdige acties. Lukt de moderne mapkiezer niet, kies dan **`X:\cdms`** (niet heel X:). Na afloop kun je het resultaat als bijgewerkt DRIP-totaal-JSON downloaden om de volgende keer als basis te gebruiken.

In **DVM-bronbeheer** zijn de bronkaarten voor Signaalgevers totaal en DRIP totaal leesbaar in vaste blokken opgebouwd. Bestanden en aantallen staan apart. De laatste bronupdate wordt per verkeerscentrale onder elkaar getoond met de regiocode vet, bijvoorbeeld **ZWN** met daaronder `Laatste update 21-09-2026`. Daardoor staan meerdere regio's niet meer als één lange kommaregel in de kaart.

Beide bronnen koppelen de DRIP-incidenten op dezelfde manier aan het DRIP-areaal (eerst op CDMS-code, anders op weg, richting en hectometer) en voeden dezelfde DRIP Monte Carlo en dezelfde afleiding van open DRIP's uit historie. De aparte Windwaarschuwing- en RIA4-selectielijsten blijven bestaan.

In de tabel **Brondekking bekijken en bevestigen** staat per assettype hoeveel open meldingen er in de actuele bron zitten. Staat er achter dat aantal een lager aantal *doorgerekend*, dan konden niet alle meldingen worden meegerekend: meestal omdat de melding geen locatie draagt of omdat er geen passende foutregel is. Die meldingen zie je wel op Open storingen.

Zolang er nog een deel is doorgerekend, rekent BiDash met die meldingen door en voedt het type de dienstverlening; het beschikbaarheidspercentage is dan optimistisch (het verlies van de niet-doorgerekende meldingen zit er niet in), en het gat blijft zichtbaar in de tabel. Is er van een assettype géén enkele melding doorgerekend terwijl er wel open meldingen zijn, dan is de beschikbaarheid onbekend: BiDash laat dat type als band meetellen in plaats van het als volledig beschikbaar te presenteren. Zo telt een bevestigde bron met open storingen nooit stil als nul verlies mee.

RIA4 en Windwaarschuwing blijven twee losse kenmerken. Heeft één DRIP-bestand beide kolommen, dan splitst BiDash de regels automatisch op de markeringen in die kolommen. Naast de vaste kopteksten herkent BiDash ook samenstellingen als `RIA-4 DRIP` of `Windwaarschuwing DRIP`. Windmetingen zoals `Windrichting` of `Windsnelheid` tellen niet mee: die zeggen iets over het weer en niets over de soort DRIP. Bij dubbele DRIP-codes controleert de koppeling ook VC, weg, richting en hectometer. In de tabel Brondekking bekijken en bevestigen staat bij DRIP welke historische bron voor de actuele selectie is gebruikt. Bevestig die bron alleen als het bestand voor het bedoelde areaal volledig is.

In Overzicht en Wegdelen worden verkeerscentralecodes hoofdletterongevoelig verwerkt. `zwn`, `ZWN`, `VC ZWN` en de historische code `WNZ` verschijnen daardoor samen als `ZWN`.

Herkent BiDash in een referentielijst géén markerkolom, dan krijgt elke regel de soort die je met de knop koos. Dat is een aanname over het hele bestand. De melding na het laden en de bronkaart in Datasetbeheer benoemen die aanname met het aantal regels waarop hij is toegepast; is er wel gemarkeerd, dan staat er uit welke kolom de soort komt. Klopt de aanname niet, wis de bron dan en laad een bestand met een expliciete kolom.

## Voortgang tijdens data laden

Bij het kiezen van bestanden verschijnt onder de statusregel van BiDash een voortgangsbalk. Voor bestanden die via **Data & export** worden gelezen toont de balk de leesvoortgang op basis van werkelijk gelezen bytes. Zodra het bestand volledig is gelezen verandert de fase naar inhoud controleren; tijdens JSON- of XML-verwerking kan het percentage daardoor kort stilstaan terwijl de browser de inhoud parseert.

Ook specialistische DVM-bronnen, zoals All Assets, open storingen, storingshistorie, U-routes en werkzaamheden, sturen hun bestaande importfasen naar dezelfde voortgangsbalk in de hoofdapp. Daardoor blijft zichtbaar welk bestand en welke verwerkingsstap bezig is, ook wanneer een grote bron tijdelijk veel rekentijd vraagt.

De balk onderscheidt lezen, controleren/verwerken, toepassen in de rekenmodules en afronden/opslag. Bij een fout blijft de laatste fase met een waarschuwingsmarkering zichtbaar. Bij een geslaagde import wordt 100% getoond en verdwijnt de melding na enkele seconden.

Belangrijk: een voortgangsbalk voorkomt niet dat een zeer grote XML- of spreadsheetparse de JavaScript-hoofdthread kort belast. BiDash laat vóór zo'n zware parse bewust eerst de voortgangsstatus schilderen, zodat een tijdelijke pauze niet als een onverklaarde vastloper wordt ervaren.

## Nieuwe actuele storingslijst

De invoer Open storingen accepteert XLSX, XLS en CSV met herkenbare DVM-storingsregels. De gekozen lijst is een volledige nieuwe momentopname en vervangt de vorige actuele lijst, ook als de bestandsnaam anders is.

BiDash vergelijkt de vorige en nieuwe momentopname. Een event-id heeft voorrang als identiteit. Zonder event-id gebruikt BiDash een stabiele combinatie van asset, starttijd, weg, richting, hectometer, strook, foutcode, melding en gevolg.

| Situatie | Actie |
| --- | --- |
| Storing staat in oude en nieuwe lijst | Blijft actueel open |
| Storing staat alleen in nieuwe lijst | Wordt een nieuwe actuele open storing |
| MSI-storing stond in oude lijst en ontbreekt in nieuwe lijst | Wordt afgesloten op de peildatum van de nieuwe lijst en toegevoegd aan storingshistorie |
| Afgesloten storing staat al in historie | Niet opnieuw toevoegen |

Automatisch afgesloten MSI-storingen gaan alleen naar de historische stroom. De actuele dashboards gebruiken alleen de nieuwe open momentopname.

## Filter wat meetelt in het actuele overzicht

Na het laden van een open-storingenmomentopname kun je in DVM onder Datasetbeheer bepalen welke regels uit die lijst werkelijk meetellen in de actuele doorrekening.

Je kunt filteren op de waarden die daadwerkelijk in jouw bestand voorkomen. BiDash biedt daarbij de volgende groepen aan:

- storingstype of afgeleide foutregel;
- gevolg;
- noodmaatregel;
- assettype;
- oorzaak;
- prioriteit of ernst;
- verkeerscentrale;
- regionale dienst;
- district;
- weg.

Binnen één groep kun je meerdere waarden tegelijk laten meetellen. Verschillende groepen werken samen: een melding moet aan alle ingestelde groepen voldoen. Lege bronvelden verschijnen als `(geen waarde)` en kunnen dus ook bewust worden uitgesloten. Met **Alles meetellen** zet je alle uitsluitingen terug.

Wijzigingen aan vinkjes worden automatisch toegepast. Je hoeft de selectie niet apart op te slaan of eerst een knop onderaan de filterkaart te gebruiken. De knop **Dienstimpact bekijken** is alleen nog navigatie naar het actuele dienstoverzicht.

De teller boven de filterkaart onderscheidt vier stappen:

1. **open bronregels**: alle regels uit de geladen actuele momentopname;
2. **geselecteerd voor DVM**: bronregels die door jouw filter komen;
3. **uitgesloten door filter**: bronregels die jij bewust buiten de actuele doorrekening houdt;
4. **doorgerekende meldingen**: regels die na DVM-validatie, locatiecontrole, foutregelcontrole en ontdubbeling daadwerkelijk in het actuele dashboard terechtkomen.

Daarom hoeven bijvoorbeeld 657 open bronregels niet gelijk te zijn aan 657 doorgerekende open meldingen. Als 657 bronregels door het filter komen en de DVM-doorrekening daarna 435 unieke geldige meldingen overhoudt, dan is dat geen verdwenen brondata. Het is het verschil tussen de bronlaag en de doorgerekende analyselaag.

Het filter bewaart uitsluitingen in plaats van een vaste lijst met toegestane waarden. Daardoor telt een nieuwe, nog niet eerder geziene waarde in een volgende storingslijst standaard wél mee. Het filter blijft staan als je een nieuwe momentopname laadt en reist mee wanneer je de DVM-parameters in een totaalexport opneemt.

![De volledige actuele momentopname gaat zowel naar de snapshot- en historielogica als naar het gebruikersfilter. Alleen de tweede route wordt gefilterd; de A-B-vergelijking en automatische MSI-historisering blijven altijd op de volledige bron werken.](afbeeldingen/storingsfilter-flow.svg)

Belangrijk: het filter verwijdert niets uit de geladen bronlijst. De vergelijking tussen oude lijst A en nieuwe lijst B gebruikt altijd de volledige momentopnamen. Een MSI-storing die uit B verdwijnt kan dus nog steeds correct worden afgesloten en aan de historie worden toegevoegd, ook wanneer die storing in het actuele overzicht was uitgefilterd. Historische analyses en prognosekalibratie worden eveneens niet door dit live-overzichtsfilter gewijzigd.

## Hoofdproces en logische architectuur

BiDash redeneert vanuit de dienstverlening. De vier VWM-diensten vormen de bovenste doellaag. Daaronder leveren drie domeinen feiten aan:

1. Bedrijfsvoering / BI: formatie, capaciteit, contracten, budget, leveranciers en interne bedienketens.
2. Technische middelen / DVM-assets: areaal, EOL, storingen, technische beschikbaarheid, prestatie en assetgerelateerde kosten.
3. Planning en externe invloeden: activiteiten, afhankelijkheden, werkzaamheden, tijdvensters, U-routes en afsluitingen.

De rule engine bepaalt wat meetelt en hoe die feiten doorwerken naar de dienstverlening. De trigger engine bepaalt wanneer een berekende toestand een waarschuwing, signaal of besluitmoment oplevert. De logische tekening en uitgebreide toelichting staan in `architectuur.md`.

De bronbestanden blijven lokaal in de browser. De werkruimte wordt in IndexedDB opgeslagen. Voor overdracht of back-up gebruik je een integrale export.

## Queryfilters voor assets en storingen

Onder **Assetmanagement** hebben **Assetregister** en **Open storingen** een
uitklapbare querybouwer. Voeg per regel een veld, operator en waarde toe. Vanaf de
tweede regel kies je zelf **EN** of **OF**. Net als bij SQL wordt EN vóór OF uitgevoerd.
Je kunt voorwaarden over verschillende kolommen combineren.

Gebruik voor een combinatie van foutcodes het veld **Asset heeft foutcode**. Voorbeeld:

1. Asset heeft foutcode is gelijk aan `1001`;
2. Asset heeft foutcode is gelijk aan `1003`;
3. verbind de tweede regel met EN.

Deze query toont assets waarop beide codes openstaan. In Open storingen toont zij de
meldingen die bij zulke assets horen. Twee voorwaarden op **Foutcode van deze melding**
kunnen niet beide waar zijn, omdat één melding maar één foutcode heeft.

## Documentatie in Help

De publicatiestap voert `scripts/stage-docs.mjs` uit. Die maakt voor de browser een Help-bundel van alle Markdown-bestanden in `docs/` en kopieert de overige documentatiebestanden naar `site/docs/` in het publicatie-artifact. De gegenereerde bundel en kopie worden niet in Git opgeslagen.

Afbeeldingen in Markdown blijven relatieve bronverwijzingen gebruiken, bijvoorbeeld `afbeeldingen/bidash-processflow.svg`. In Help worden die paden vanuit het bijbehorende Markdown-bestand opgelost, zodat dezelfde SVG zowel op GitHub als in de applicatie zichtbaar is.


## Kwaliteitsaudit uitvoeren

Ga onder **Data & export** naar **Kwaliteit** en klik op **Audit uitvoeren**. BiDash
controleert de werkruimte die op dat moment in deze browser staat. Een uitgestelde
DVM-werkruimte wordt voor deze bewuste controle eerst verwerkt.

Het dashboard toont:

- een totaalscore en het oordeel **Op koers**, **Aandacht nodig** of **Niet op koers**;
- deelscores voor Bronnen, Datakwaliteit, Koppelingen, Doorrekening en Beheerbaarheid;
- blokkerende fouten en waarschuwingen met een concrete herstelactie;
- maximaal twaalf eerdere scores als ontwikkeling;
- alle geslaagde, informatieve en afwijkende controles in een uitklapbare tabel.

Een blokkerende fout begrenst de totaalscore. Voorbeelden zijn een ontbrekend
assetregister, een actuele bron die geen melding in het dashboard oplevert, een
doorgerekend locatieconflict of een exact beschikbaarheidspercentage terwijl meldingen niet zijn
doorgerekend. Waarschuwingen benoemen onder andere een oude peildatum, lage
koppeldekking, veilig geblokkeerde locatieconflicten, dubbele sleutels en ontbrekende duur.

De audit verandert geen brondata, filters of rekenregels. De controle blijft lokaal.
Via **Auditrapport exporteren** download je de samenvatting en minimale identifiers
van probleemgevallen. Bij **Export
samenstellen** kun je de laatste audit en scorehistorie ook in de integrale back-up
opnemen.

Bij **Open meldingen niet doorgerekend** opent **Foutcodes beheren** de derde tab van
Impactregels. Daar maak je een foutcode met patroon, assettype, ernst, twee
impactpercentages en onderbouwing. Selecteer daarna alleen meldingen waarvoor een
passende foutregel ontbreekt. Locatieconflicten moet je via Assetconfiguratie oplossen.

De score is een technische kwaliteitsindicator. Zij controleert geen externe
waarheid van verkeerskundige, statistische of beleidsmatige aannames.

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

### DRIP-storingen worden nu doorgerekend

Vroeger bleven DRIP-storingen staan met de melding *Passende foutregel ontbreekt*,
omdat er geen DRIP-foutregels bestonden. Sinds BiDash 2.13 (DVM-versie 83) hebben
DRIP-storingen wel een impact, op twee manieren die samenwerken.

BiDash leest eerst de alarmtekst: een verloren displaycontact geldt als volledige
uitval, een kritische LED-storing weegt zwaar, een temperatuuroverschrijding matig,
een minor LED-status licht, een reset zeer licht en een open kastdeur is een bekende
storing zonder dienstimpact.

Belangrijker is de functionele toestand van het paneel uit de bron. Staat een DRIP
op **GESTOPT**, dan telt hij als volledig uit, ongeacht het gemelde alarm. Is hij
gestopt geweest en weer **in bedrijf**, dan legt BiDash een ondergrens: een
**langdurige** onderbreking weegt zwaarder dan een **intermitterende**. Een paneel
dat gewoon in bedrijf is met alleen een gemeld alarm houdt de impact laag. Een
storing zonder toestand, zonder classificatie en zonder bekende alarmregel blijft
bewust onbekend en krijgt geen verzonnen impact.

De gebruikte percentages zijn een instelbaar model, geen door RWS vastgesteld getal.
Ze maken de DRIP-dienstverlening bespreekbaar; na toetsing met RWS kunnen de waarden
worden bijgesteld zonder dat de werkwijze verandert.


## Vragen stellen aan BiDash zonder AI

Rechtsboven staat vanaf BiDash 2.17 de knop **Vraag BiDash**. Daarmee open je een gesprek bovenop de gegevens die al in jouw lokale werkruimte zijn geladen. Er wordt geen AI gebruikt en er gaat voor deze functie geen vraag of brondata naar een externe dienst.

Kies **Dit scherm en de huidige filters** wanneer je wilt vragen over wat je op dat moment bekijkt. Kies **Alle beschikbare data** wanneer de vraag niet beperkt moet zijn tot de huidige selectie. Je kunt doorvragen: BiDash onthoudt binnen het gesprek de laatst gebruikte selectie, zoals VC, weg, assettype en foutcode.

Voorbeelden zijn “Hoeveel open MSI-storingen zijn er op de A15 in ZWN?”, “Welke foutcodes komen het meest voor?”, “Welke storingen hebben de hoogste berekende impact?”, “Wat is de huidige dienstverlening?” en “Wat zijn de verkeerskosten op A15?”. De assistent toont alleen waarden die al uit de bestaande BiDash-query- en rekenketen komen. Een onbekende impact wordt niet zelf ingevuld.

Met **Gebruik als filter** kun je een ondersteunde selectie terugzetten op het assetregister of de open-storingenweergave. Met **Open bijbehorende data** ga je naar de normale BiDash-weergave achter het antwoord. De chat is daarmee een snellere bediening van dezelfde data, geen aparte analyse-engine.


### Integrale vragen vanaf BiDash 2.18

Vanaf BiDash 2.18 kan **Vraag BiDash** ook verbanden over meerdere domeinen volgen. De chat gebruikt daarvoor dezelfde relaties die de gewone schermen gebruiken. Voorbeelden:

- `Waarom is Incidentmanagement onder de norm?` toont welke open meldingen via welk subprocess en assettype aan die dienst gekoppeld zijn.
- `Welke planning raakt Incidentmanagement?` volgt eerst de dienst naar de relevante open storingen en zoekt daarna planningactiviteiten op dezelfde corridors.
- `Welke werkzaamheden raken de storingen op de A15?` gebruikt de bestaande assetkoppelingen en wegcontext van de werkzaamheden.
- `Wat staat er gepland op de A15 in Q4 2026?` gebruikt de effectieve planningdatums.
- `Waar wordt de capaciteit overschreden?` gebruikt de bestaande FTE-vraag en capaciteitsgrenzen uit de planning/BI-keten.
- `Welke afhankelijkheden zijn er in de planning?` toont de relaties uit het geladen planningmodel.
- Vragen over U-routes, EOL en welke historische bronstromen zijn geladen zijn eveneens mogelijk.

Een antwoord over samenloop is niet automatisch een oorzaakanalyse. Als een storing en planningactiviteit dezelfde corridor raken, meldt BiDash een raakvlak. De chat zegt niet dat de activiteit de storing heeft veroorzaakt.

Historische storingsregels worden niet allemaal voor iedere chatvraag in het geheugen geladen. De chat kan in deze versie wel de geladen historiebronnen en aantallen tonen. Detailvragen over individuele historische incidenten worden later via dezelfde Context API uitgebreid wanneer de nieuwe gescheiden datalaag beschikbaar is.


#### Periodes in gewone taal

Periodevragen hoeven niet exact als één datum of kwartaal te worden geformuleerd. Vraag BiDash herkent onder meer:

- `Q3 en Q4 2027`, `eerste kwartaal 2028`;
- `eerste halfjaar 2027`, `tweede helft 2027`, `H1` en `H2`;
- `voorjaar 2027`, `zomer 2027`, `najaar 2027` en `winter 2027`;
- `april 2027` en `van april tot oktober 2027`;
- `begin 2027`, `midden 2027` en `eind 2027`;
- `dit kwartaal`, `volgend kwartaal`, `dit jaar` en `volgend jaar`;
- `komende 6 maanden`, `komende 2 kwartalen` en `komende 2 jaar`;
- `2027 en 2028` en `tot eind 2027`.

Brede termen hebben een vaste betekenis: voorjaar = maart-mei, zomer = juni-augustus, najaar/herfst = september-november en winter = december-februari. **Komende N kwartalen** betekent de eerstvolgende N volledige kwartalen. De geïnterpreteerde periode wordt als contextlabel bij het antwoord getoond.


#### Terminologie uit de planning zelf

Vraag BiDash gebruikt de geladen planning ook als dynamische woordenlijst. Een term hoeft dus niet vooraf in de chatcode te zijn opgenomen.

BiDash doorzoekt hiervoor de planningactiviteitnaam, activiteitcode, WBS/blok, volledig WBS-pad, dienst en het type activiteit/mijlpaal. Daardoor kunnen vragen werken als:

- `Wanneer is de eerstvolgende IFAT?`
- `Wanneer is VAL-77?`
- `Wanneer is WBS-900?`
- `Wanneer is Gate-Z?`

Als een term daadwerkelijk in de geladen planning voorkomt, wordt de vraag als planningvraag behandeld en niet als vervolg op een eerder gespreksonderwerp. Bij `wanneer`, `eerstvolgende` en `meest recente` sorteert BiDash de gevonden matches op de effectieve planningdatum.

De planning blijft daarmee zelf de bron van de terminologie. Nieuwe projectnamen, testfasen, afkortingen, codes of WBS-termen hoeven niet apart aan een vaste woordenlijst te worden toegevoegd.


### Assetleeftijd en EOL

**All Assets is de enige expliciete bron voor assetleeftijd en EOL.** Een aparte EOL-referentie wordt niet meer geladen of opgeslagen.

Vraag BiDash gebruikt bij vragen als `Wat is het oudste asset?`, `Welke assets zijn het oudst?` en `Wat is het nieuwste asset?` de installatie-/ingebruiknamedatum uit All Assets. Als alleen een bruikbaar jaar beschikbaar is, gebruikt de chat dat jaar. Assets zonder bruikbare installatiedatum worden bij zo'n rangschikking niet stilzwijgend als oud of nieuw behandeld, maar buiten de rangschikking gehouden.

Voor levensduur/prognose geldt de bronvolgorde: bewuste individuele of fabrikant×type-override, expliciete levensduur/EOL uit All Assets, daarna de zichtbare generieke assettypewaarde. Het EOL-jaar uit All Assets kan samen met het installatiejaar worden gebruikt om een levensduur af te leiden.
