# Logische architectuur

Deze pagina tekent de vorm van BiDash: welke lagen er zijn, wie welke rekenregel
bezit, en welke grenzen echt grenzen zijn. Het is een leeswijzer bij
[SYSTEEMWERKING.md, hoofdstuk 2](SYSTEEMWERKING.md#2-architectuur-en-eigenaarschap).
Die beschrijving is normatief; deze tekening vervangt haar niet en bevat geen
tweede set regels. Wijkt de tekening af van de code, dan heeft de code gelijk en
moeten beide worden bijgewerkt.

![Logische architectuur van BiDash in vier lagen binnen één browserorigin: de schil met schermen en orchestratie, de kern met gedeelde contracten, de bruggen via window.HUB, en de drie rekenmodules DVM, BI en planning in eigen iframes, met daarnaast de lokale opslag](afbeeldingen/architectuur.svg)

## Waarom er vier lagen zijn

BiDash is geen herschreven engine. Het is een gezamenlijke werkruimte om drie
bestaande applicaties, die elk hun eigen DOM, globale variabelen en rekenfuncties
hebben. De laagindeling bestaat om die erfenis werkbaar te houden: hoe verder je
naar beneden gaat, hoe meer het oorspronkelijke binnenwerk telt, en hoe
voorzichtiger een wijziging moet zijn.

**A · Schil** is wat de gebruiker ziet: schermen, hoofdmenu, navigatie en de
orchestratie van importeren, herstellen, opslaan en tonen. De schil rekent geen
domeinregels uit. Hij vraagt op, ontvangt samenvattingen en zet ze naast elkaar;
wat hij optelt is een weergavetotaal, geen nieuwe norm.

**B · Kern** bevat de afspraken die alle partijen delen: wat een geldig bestand
is, welke delen een import vervangt, wat een export meeneemt, hoe opeenvolgende
storingslijsten zich tot elkaar verhouden, en hoe losse signalen tot één lijst
worden samengevoegd. Dit is de enige laag waar een regel van niemand in het
bijzonder is — en juist daarom de laag waar je een nieuwe domeinregel *niet*
neerzet.

**C · Bruggen** zijn de adapters. Elke module krijgt precies één luik naar buiten,
`window.HUB`. De schil kent het binnenwerk van een module niet en mag er niet
omheen grijpen. Dat is de reden dat `parent.DB` geen geldige route naar de
BI-configuratie is: wat niet door het luik gaat, bestaat voor de rest van het
systeem niet.

De drie luiken zijn niet even breed, en dat verschil is architectuur en geen
slordigheid. `dvm-adapter.js` en `bi-adapter.js` dragen allebei `import`,
`export` en `summary`, aangevuld met ingangen naar hun verdiepende schermen.
`planning-adapter.js` heeft alleen `open`, `fullscreen` en `summary`: de planning
levert geen eigen gegevensstroom aan de schil. Haar XML en de toe te passen
formatieregels komen via `bi-adapter.js`, met `attachPlanning`, `importPlanning`
en `syncPlanningRules`; `capture()` slaat de planning-adapter dan ook expliciet
over. Wie de planning als een vierde zelfstandige gegevensbron behandelt, bouwt
een route die er niet is.

**D · Modules** zijn de drie oorspronkelijke applicaties, elk in een eigen
`iframe`. Hier zit alle domeinkennis, en hier ligt het eigenaarschap.

## Eén eigenaar per rekenregel

Dit is het dragende principe, en het is de reden dat de architectuur eruitziet
zoals hij eruitziet. DVM bezit dienstimpact en verkeerskosten. BI bezit de
formatienormen, contracten en interne bedienketens. Planning bezit het XML-model
en past de BI-formatieregels toe zonder ze te herdefiniëren.

De schil combineert uitkomsten en expliciete koppelingen. Hij introduceert geen
tweede dienst-, kosten- of formatiemodel. Een getal dat in twee lagen wordt
uitgerekend gaat vroeg of laat uiteenlopen, en dan is niet meer vast te stellen
welk getal klopt. Zie hoofdstuk 2 van de systeemwerking voor de precieze
verdeling en voor de behandeling van oude BI-aggregaatassets.

## Drie grenzen, en maar één daarvan is een beveiligingsgrens

De tekening bevat drie soorten scheiding. Ze worden makkelijk door elkaar
gehaald, dus hier staan ze uit elkaar.

**De netwerkgrens is echt.** De gestippelde rand is de browser. De Content
Security Policy met `connect-src 'none'` betekent dat de applicatie geen
netwerkverzoek voor brondata kan doen. Er is geen upload, geen accountopslag en
geen telemetrie. GitHub levert de applicatie; de gegevens blijven aan deze kant
van de rand. Dit is de grens waarop de privacybelofte rust.

**De eigenaarsgrens is een afspraak.** Niets in de techniek verhindert dat iemand
een dienstnorm in de schil programmeert. Wat dat verhindert is de afspraak, de
review en de testmatrix. Een architectuurtekening maakt zo'n grens zichtbaar, niet
afdwingbaar.

**De framegrens is functioneel, geen beveiligingsgrens.** De modules draaien in
`iframe`s met `allow-scripts` en `allow-same-origin`, op dezelfde origin als de
schil. Dat isoleert de DOM en de globale variabelen van de modules netjes van
elkaar, wat precies de bedoeling is. Het beschermt niet tegen kwaadaardige eigen
code. Wie een module aanpast, past effectief het geheel aan. `postMessage` wordt
daarom alleen verwerkt voor dezelfde origin én een bekend bronframe.

## Opslag zit aan het apparaat vast

De schil schrijft de volledige werkruimte naar IndexedDB, database
`bidash-integraal`, objectstore `workspace`, sleutel `current`. De modules
gebruiken daarnaast hun eigen lokale browseropslag voor instellingen.

Beide zijn gebonden aan deze browser op dit apparaat. Browseropslag is geen
back-up: wis je je browsergegevens en de kopie is weg. Een export is de enige
overdraagbare vorm. Gebruik één werkruimte-tab tegelijk; er is geen uitgewerkte
meergebruikerssynchronisatie.

## Wat deze tekening niet zegt

Ze zegt niets over de juistheid van de verkeerskundige of statistische modellen
daarbinnen. Een nette laagindeling is geen validatie van een formule, en een
visueel geslaagde wijziging bewijst geen correcte berekening.

Ze toont ook niet elke route. Oudere detailschermen binnen de modules kunnen
eigen dekkingslogica hebben die afwijkt van de landelijke route; maak die bij een
wijziging niet stilzwijgend gelijk.

## Waar je moet zijn bij een wijziging

Bepaal eerst in welke laag je zit en welk domein eigenaar is. Een wijziging in
laag D raakt de domeinregels van één eigenaar. Een wijziging in laag B raakt het
gegevenscontract van iedereen en vraagt om compatibiliteits- en
deelimportcontroles. Een wijziging in laag C raakt de afspraak zelf en is
zelden alleen technisch.

De verplichte werkwijze en de bijbehorende gerichte controles staan in
[SYSTEEMWERKING.md, hoofdstuk 11 en 12](SYSTEEMWERKING.md#11-verplichte-werkwijze-bij-ai-wijzigingen).
Die matrix wordt hier bewust niet herhaald.
