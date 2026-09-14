# Processflow van BiDash

BiDash voegt twee bestaande rekenwerelden samen — dienstimpact en kosten uit
DVM, planning, formatie en contracten uit BI — zonder dat een van beide zijn
eigen regels afstaat. Alles rekent in de browser van de gebruiker; er gaat geen
enkel bronbestand het apparaat af.

![Processflow: GitHub Pages levert alleen de applicatie; daarna kiest de gebruiker lokale bestanden, die na voorvertoning en validatie naar twee gescheiden rekenengines gaan, waarvan de samenvattingen worden gecombineerd, en waarvan de werkruimte in IndexedDB wordt bewaard en selectief geëxporteerd](afbeeldingen/bidash-processflow.svg)

## 1 · De app komt van GitHub, de gegevens nooit

De workflow publiceert alleen de map `site/` naar GitHub Pages. Wat je daar
ophaalt is de applicatie zelf. De pagina draagt een Content Security Policy met
`connect-src 'none'`, waardoor de app geen enkel netwerkverzoek mág doen. Dat is
de reden dat er geen account, geen login en geen synchronisatie is: er is geen
kanaal waarlangs een storingsbestand naar buiten zou kunnen.

## 2 · Je kiest bestanden en ziet eerst wat er verandert

Onder *Laden & exporteren* kies je een DVM-totaal-JSON, een integrale
BiDash-bundel, een BI Dash-JSON of een planning-XML uit Primavera P6 of
MS Project. Voordat er iets verandert draait `validate()` over de inhoud:
objectsleutels als `__proto__` worden geweigerd en te diep geneste bestanden
afgebroken. Daarna krijg je een lijst van precies die onderdelen die vervangen
gaan worden — alles wat het bestand niet meelevert blijft staan. Mislukt de
import halverwege, dan wordt de vorige werkruimte teruggezet.

## 3 · Twee engines rekenen apart door

De twee oorspronkelijke applicaties draaien ongewijzigd verder, elk in een eigen
sandboxed `iframe`. Ze praten met de schil via één luik, `window.HUB`, met vier
handelingen: `import`, `export`, `summary` en `open`. De schil kent hun
binnenwerk niet en herrekent niets zelf.

![Rekenketen binnen DVM: open storingen leiden tot verlies per assettype, dat via gewichten per subproces en per dienst tot een dienstbeschikbaarheid leidt; is een bron niet als volledig bevestigd, dan volgt een databand in plaats van een exact percentage](afbeeldingen/rekenketen-dvm.svg)

DVM blijft eigenaar van storingsimpact, assetafhankelijkheden, subprocessen,
dienstnormen, verkeersscenario's en tarieven. BI blijft eigenaar van formatie,
contracten, budget, bedienketens en planningscapaciteit. De oude
BI-storingsimport is bewust stilgezet, zodat dezelfde storing niet twee keer
meetelt.

## 4 · Samenhang ontstaat alleen waar jij die legt

![De koppelregel: een dienst onder norm geeft altijd een eigen signaal en BI-signalen gaan ongewijzigd door, maar het samengestelde signaal ontstaat alleen wanneer een vastgelegde dienstkoppeling bestaat en beide voorwaarden waar zijn](afbeeldingen/koppelregel.svg)

BI-signalen worden ongewijzigd doorgegeven. Een DVM-dienst onder zijn eigen norm
levert een eigen signaal. Het derde signaal — dienstimpact én capaciteitstekort
in één melding — ontstaat uitsluitend wanneer je in *Regels & koppelingen* hebt
vastgelegd welke bedrijfsfunctie verantwoordelijk is voor welke dienst. BiDash
leidt zo'n verband nooit af uit een gelijkende naam.

## 5 · Lokaal bewaren, zelf samenstellen wat je meeneemt

Zodra een engine iets wijzigt stuurt die een bericht naar de schil. Na ongeveer
anderhalve seconde rust schrijft de schil de volledige staat naar IndexedDB,
onder de naam `bidash-integraal`. Bij het herladen wordt diezelfde staat
teruggeduwd in beide engines, inclusief de planning-XML.

Die opslag zit aan dit apparaat en deze browser vast. Wis je je browsergegevens,
dan is de kopie weg — export is daarom de aangewezen route voor overdracht en
back-up.

---

## Wat het systeem bewust niet doet

| Grens | Waarom |
|---|---|
| Geen data naar buiten | Geen upload, geen accountopslag, geen synchronisatie. Bronbestanden horen ook nooit in de repository. |
| Geen afgeleide koppelingen | Een dienst en een bedrijfsfunctie worden nooit aan elkaar geplakt omdat ze op elkaar lijken. |
| Geen opgetelde bedragen | Verkeerskosten, contractkosten en capaciteit houden hun eigen betekenis. Onbekende kosten verschijnen als "onbekend", nooit als nul. |
| Geen verborgen onzekerheid | Is de dekking van een storingsbron niet bevestigd, dan volgt een band in plaats van een exact percentage. |

## Waar elk stuk in de code zit

| Bestand | Verantwoordelijkheid |
|---|---|
| [`site/index.html`](../site/index.html) | De schil met de schermen en de Content Security Policy |
| [`site/app.js`](../site/app.js) | Import met voorvertoning, staat ophalen, opslaan, tekenen en exporteren |
| [`site/core/model.js`](../site/core/model.js) | Validatie, samenvoegen, exportselectie en `combine()` |
| [`site/core/storage.js`](../site/core/storage.js) | Lezen en schrijven van de werkruimte in IndexedDB |
| [`site/core/signal-forecast.js`](../site/core/signal-forecast.js) | De signaalgeverprognose en de WIS-berekening |
| [`site/engines/dvm-*.js`](../site/engines) | De DVM-engine: diensten, subprocessen, assetimpact, tarieven |
| [`site/engines/bi-*.js`](../site/engines) | De BI-engine: formatie, financiën, contracten, bedienketens |
| [`site/engines/planning.html`](../site/engines/planning.html) | De planningstool die P6- en MS Project-XML leest |
| [`site/engines/*-adapter.js`](../site/engines) | Het luik `window.HUB` tussen engine en schil |
