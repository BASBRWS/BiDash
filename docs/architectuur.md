# Logische architectuur

Deze tekening beschrijft de denkwijze van BiDash, niet de technische map- of iframe-indeling. De centrale vraag is: kunnen we de VWM-dienstverlening nu en in de toekomst uitvoeren, en welke interne, technische en externe factoren beïnvloeden dat?

![Logische architectuur: VWM-dienstverlening bovenaan, daaronder de rule engine en trigger engine, gevoed door bedrijfsvoering BI, technische DVM-assets en planning/externe invloeden](afbeeldingen/architectuur-dienstverlening.svg)

## De bovenste laag is dienstverlening

De hoogste laag is bewust niet DVM, BI of Planning maar de dienstverlening zelf. Incidentmanagement, Verkeersmanagement, Reis- en route-informatie en Werk in Uitvoering zijn de uitkomsten waarop BiDash stuurt.

Het systeem moet uiteindelijk antwoord geven op vragen als:

- kunnen we de dienst leveren;
- met welke beschikbaarheid en prestatie;
- is er voldoende personele en contractuele capaciteit;
- welke technische middelen beperken de dienst;
- welke geplande of externe veranderingen beïnvloeden de uitvoerbaarheid;
- wat zijn de kosten, risico's en toekomstige knelpunten.

## Drie informatiedomeinen onder de dienstverlening

### 1. Bedrijfsvoering, nu aangeduid als BI

BI gaat logisch over hoe de organisatie de dienstverlening kan uitvoeren. Daar horen formatie, beschikbare capaciteit, contracten, budget, leveranciers, functies en interne bedienketens bij.

De naam Business Intelligence is breder dan de huidige inhoud. In de architectuur betekent BI daarom vooral de bedrijfsvoerings- en uitvoeringsvermogensblik. BI is geen eigenaar van technische assetregels of planningslogica.

### 2. Technische middelen, nu aangeduid als DVM

DVM is als naam historisch gegroeid en dekt het domein niet volledig. Logisch gaat deze laag over de technische middelen die nodig zijn om de diensten te kunnen leveren.

Daaronder vallen onder andere:

- assetregister en areaal;
- EOL en levensduur;
- actuele open storingen;
- storingshistorie;
- technische beschikbaarheid en prestatie;
- technische prognoses;
- verkeerskundige gevolgen en verkeerskosten die uit assetverlies volgen.

Een toekomstige naam als `Technische middelen` of `Assets & techniek` zou de inhoud beter beschrijven dan alleen DVM. De code hoeft daarvoor niet direct te worden hernoemd.

### 3. Planning en externe invloeden

Planning beschrijft wat rondom de dienstverlening verandert en wanneer. Het is daarmee geen zelfstandig dienstmodel, maar een bron van tijdgebonden invloed en uitvoerbaarheidscontext.

Daaronder vallen P6- en MS Project-activiteiten, afhankelijkheden, werkzaamheden, tijdvensters, U-routes, afsluitingen en vergelijkbare externe context.

## Rule engine: van bronfeit naar invloed

De rule engine vertaalt gegevens uit de drie domeinen naar betekenis voor de dienstverlening. Hier horen regels thuis die bepalen:

- welke bronregel meetelt;
- welke asset, functie, processtap of dienst wordt geraakt;
- welk gewicht of impactniveau geldt;
- welke afhankelijkheden en expliciete koppelingen gelden;
- hoe meerdere feiten worden gecombineerd zonder dezelfde regel dubbel te modelleren.

De nieuwe telregels voor actuele storingen zijn onderdeel van deze laag. De geladen open-storingslijst blijft volledig als bron bewaard. De gebruiker kan voor het actuele overzicht bepalen welke waarden meetellen voor assettype, type storing/omschrijving, gevolg, noodmaatregel en foutcode. Alleen de geselecteerde regels gaan door naar de actuele impactberekening. Het filter sluit geen storing af en verandert de A/B-vergelijking met de volgende momentopname niet.

## Trigger engine: wanneer vraagt een uitkomst aandacht

De trigger engine gebruikt de berekende toestand om te bepalen wanneer een signaal, waarschuwing of besluitmoment ontstaat. Voorbeelden zijn:

- dienstverlening onder norm;
- capaciteitstekort;
- combinatie van technische impact en personele krapte;
- overschrijding van kosten- of risicodrempels;
- prognose die binnen een ingestelde termijn een grens passeert;
- samenloop met geplande werkzaamheden.

Rule engine en trigger engine zijn dus niet hetzelfde. De rule engine bepaalt de betekenis en doorwerking. De trigger engine bepaalt wanneer de uitkomst belangrijk genoeg is om als signaal naar voren te komen.

## Waarom BI niet letterlijk de ouder van DVM en Planning is

De gedachte dat BI boven DVM en Planning hoort is inhoudelijk begrijpelijk: de bedrijfsvoering bepaalt hoe de dienstverlening kan worden uitgevoerd. In een causale gegevensarchitectuur is het echter zuiverder om Bedrijfsvoering, Technische middelen en Planning naast elkaar als drie bron- of invloeddomeinen te tekenen.

De echte bovenliggende laag is de dienstverlening. Daarmee voorkom je dat het lijkt alsof BI eigenaar is van technische assetlogica of externe planningsfeiten. Alle drie leveren zelfstandig feiten aan de centrale vertaling naar dienstverlening.

## Technische implementatie blijft gescheiden van dit logische model

De huidige applicatie bestaat technisch nog uit een gezamenlijke schil met bestaande DVM-, BI- en planningmodules en adapters via `window.HUB`. Dat is een implementatiekeuze en hoeft niet één-op-één gelijk te zijn aan de logische architectuur.

De technische architectuur blijft apart vastgelegd in `SYSTEEMWERKING.md` en `afbeeldingen/architectuur.svg`. De norm blijft: één eigenaar per bronregel en geen tweede rekenmodel in de schil. Deze pagina beschrijft hoe de informatie inhoudelijk hoort te stromen.
