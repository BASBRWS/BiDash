# BiDash gebruikershulp

Deze uitleg hoort bij de Help-knop rechtsboven in BiDash. Help bevat geen tweede, handmatig bijgehouden kopie van deze tekst. Tijdens testen en publicatie wordt de map `docs/` gebundeld en toont `site/help.html` de echte Markdown-bestanden rechtstreeks, inclusief tabellen, links en SVG-afbeeldingen uit `docs/afbeeldingen/`.

De standaardweergave is de processflow. Via de documentnavigatie zijn onder andere deze gebruikershulp, de logische architectuur, het rekenvoorbeeld, de systeemwerking en release notes bereikbaar. Daardoor wordt een wijziging in de Markdown-documentatie bij de eerstvolgende publicatie ook de inhoud van Help.

## Welke versie je voor je hebt

Rechtsboven in de balk staat de versie, naast de Help-knop. Direct na het openen
staat daar de versie van BiDash zelf, bijvoorbeeld `BiDash 2.10`. Zodra je een
module opent die een eigen versie bijhoudt, komt die erachter: `BiDash 2.10 · DVM 79`.
Onderin de navigatie staat hetzelfde nummer als `Integratie 2.10`. Noem dat nummer
bij een melding over een verschil in uitkomsten; zonder versie is een uitkomst niet
terug te vinden.

## Aanbevolen laadvolgorde

1. Laad All Assets als technisch stamregister.
2. Laad de EOL-referentie als die beschikbaar is.
3. Laad historische storingsbestanden voor historie en prognosekalibratie.
4. Laad U-routes en geplande werkzaamheden als operationele context.
5. Laad als laatste de actuele open storingslijst voor het live dashboard.
6. Stel desgewenst in Datasetbeheer het filter in voor de open storingen die in het actuele overzicht mogen meetellen.
7. Laad BI-gegevens en planning voor formatie, contracten en uitvoerbaarheid.

Historische storingen en actuele open storingen zijn twee verschillende gegevensstromen. Historische meldingen mogen het live dashboard niet beïnvloeden. Bij DRIP-historie leidt BiDash alleen incidenten af die aantoonbaar aan het actuele einde van hun eigen bron nog open staan. Oude gecensureerde incidenten worden niet als huidige storing meegenomen.

Verdwijnt een MSI-storing uit de nieuwe momentopname, dan sluit BiDash die af op de peildatum van die lijst. De hersteltijd die daaruit volgt is een bovengrens: het herstel lag ergens tussen de vorige en de nieuwe lijst. Zo'n duur telt daarom niet mee in de herstelduurstatistiek en in de prognose, en wordt in memo's gemarkeerd als afgeleid. Laad je vaker een actuele lijst, dan worden die bovengrenzen scherper.

RIA4 en Windwaarschuwing blijven twee losse kenmerken. Heeft één DRIP-bestand beide kolommen, dan splitst BiDash de regels automatisch op de markeringen in die kolommen. Naast de vaste kopteksten herkent BiDash ook samenstellingen als `RIA-4 DRIP` of `Windwaarschuwing DRIP`. Windmetingen zoals `Windrichting` of `Windsnelheid` tellen niet mee: die zeggen iets over het weer en niets over de soort DRIP. Bij dubbele DRIP-codes controleert de koppeling ook VC, weg, richting en hectometer. In de tabel Brondekking bekijken en bevestigen staat bij DRIP welke historische bron voor de actuele selectie is gebruikt. Bevestig die bron alleen als het bestand voor het bedoelde areaal volledig is.

Herkent BiDash in een referentielijst géén markerkolom, dan krijgt elke regel de soort die je met de knop koos. Dat is een aanname over het hele bestand. De melding na het laden en de bronkaart in Datasetbeheer benoemen die aanname met het aantal regels waarop hij is toegepast; is er wel gemarkeerd, dan staat er uit welke kolom de soort komt. Klopt de aanname niet, wis de bron dan en laad een bestand met een expliciete kolom.

## Voortgang tijdens data laden

Bij het kiezen van bestanden verschijnt onder de statusregel van BiDash een voortgangsbalk. Voor bestanden die via **Data & export** worden gelezen toont de balk de leesvoortgang op basis van werkelijk gelezen bytes. Zodra het bestand volledig is gelezen verandert de fase naar inhoud controleren; tijdens JSON- of XML-verwerking kan het percentage daardoor kort stilstaan terwijl de browser de inhoud parseert.

Ook specialistische DVM-bronnen, zoals All Assets, EOL, open storingen, storingshistorie, U-routes en werkzaamheden, sturen hun bestaande importfasen naar dezelfde voortgangsbalk in de hoofdapp. Daardoor blijft zichtbaar welk bestand en welke verwerkingsstap bezig is, ook wanneer een grote bron tijdelijk veel rekentijd vraagt.

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

## Documentatie in Help

De publicatiestap voert `scripts/stage-docs.mjs` uit. Die maakt voor de browser een Help-bundel van alle Markdown-bestanden in `docs/` en kopieert de overige documentatiebestanden naar `site/docs/` in het publicatie-artifact. De gegenereerde bundel en kopie worden niet in Git opgeslagen.

Afbeeldingen in Markdown blijven relatieve bronverwijzingen gebruiken, bijvoorbeeld `afbeeldingen/bidash-processflow.svg`. In Help worden die paden vanuit het bijbehorende Markdown-bestand opgelost, zodat dezelfde SVG zowel op GitHub als in de applicatie zichtbaar is.
