# BiDash gebruikershulp

Deze uitleg hoort bij de Help-knop rechtsboven in BiDash. Help bevat geen tweede, handmatig bijgehouden kopie van deze tekst. Tijdens testen en publicatie wordt de map `docs/` gebundeld en toont `site/help.html` de echte Markdown-bestanden rechtstreeks, inclusief tabellen, links en SVG-afbeeldingen uit `docs/afbeeldingen/`.

De standaardweergave is de processflow. Via de documentnavigatie zijn onder andere deze gebruikershulp, de logische architectuur, het rekenvoorbeeld, de systeemwerking en release notes bereikbaar. Daardoor wordt een wijziging in de Markdown-documentatie bij de eerstvolgende publicatie ook de inhoud van Help.

## Aanbevolen laadvolgorde

1. Laad All Assets als technisch stamregister.
2. Laad de EOL-referentie als die beschikbaar is.
3. Laad historische storingsbestanden voor historie en prognosekalibratie.
4. Laad U-routes en geplande werkzaamheden als operationele context.
5. Laad als laatste de actuele open storingslijst voor het live dashboard.
6. Stel desgewenst in Datasetbeheer het filter in voor de open storingen die in het actuele overzicht mogen meetellen.
7. Laad BI-gegevens en planning voor formatie, contracten en uitvoerbaarheid.

Historische storingen en actuele open storingen zijn twee verschillende gegevensstromen. Historische meldingen mogen het live dashboard niet beïnvloeden.

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

Na het laden van een open-storingenmomentopname kun je in DVM onder Datasetbeheer bepalen welke regels uit die lijst werkelijk meetellen in de actuele doorrekening. Bovenaan het actuele overzicht blijft zichtbaar hoeveel bronregels er zijn en hoeveel daarvan na jouw filter meetellen.

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

Het filter bewaart uitsluitingen in plaats van een vaste lijst met toegestane waarden. Daardoor telt een nieuwe, nog niet eerder geziene waarde in een volgende storingslijst standaard wél mee. Het filter blijft staan als je een nieuwe momentopname laadt en reist mee wanneer je de DVM-parameters in een totaalexport opneemt.

![De volledige actuele momentopname gaat zowel naar de snapshot- en historielogica als naar het gebruikersfilter. Alleen de tweede route wordt gefilterd; de A-B-vergelijking en automatische MSI-historisering blijven altijd op de volledige bron werken.](afbeeldingen/storingsfilter-flow.svg)

Belangrijk: het filter verwijdert niets uit de geladen bronlijst. De vergelijking tussen oude lijst A en nieuwe lijst B gebruikt altijd de volledige momentopnamen. Een MSI-storing die uit B verdwijnt kan dus nog steeds correct worden afgesloten en aan de historie worden toegevoegd, ook wanneer die storing in het actuele overzicht was uitgefilterd. Historische analyses en prognosekalibratie worden eveneens niet door dit live-overzichtsfilter gewijzigd.

## Hoofdproces

Na het laden van een actuele open-storingslijst verschijnt het blok `Storingsfilter / telregels`. Daar bepaal je welke meldingen daadwerkelijk door de actuele impactberekening gaan.

Je kunt afzonderlijk filteren op:

- type storing / assettype;
- gevolg;
- noodmaatregel;
- foutcode / rekenregel.

Per categorie kun je alles, niets of afzonderlijke waarden selecteren. Bovenin het blok staan steeds vier aantallen: geladen open meldingen, meldingen die meetellen, meldingen die door de telregels zijn uitgesloten en meetellende meldingen die aan een asset gekoppeld zijn.

Belangrijk: de filterlaag verandert het bronbestand niet. Een uitgesloten melding blijft onderdeel van de actuele momentopname. Daardoor blijft de vergelijking met de volgende storingslijst correct en wordt een uitgesloten storing niet ten onrechte als opgelost beschouwd. De telregels beïnvloeden alleen de actuele doorrekening naar assetimpact, dienstverlening en kosten.

De instellingen worden onderdeel van de DVM-parameters en gaan daarmee mee in een parameter- of totaalexport.

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
