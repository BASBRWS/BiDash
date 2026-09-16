# Documentatie

Achtergrond bij BiDash integraal. De applicatie zelf staat in [`site/`](../site). De Help-knop rechtsboven opent een viewer die tijdens testen en publicatie rechtstreeks uit de Markdown-bestanden in deze map wordt opgebouwd. Er is dus geen tweede handmatig bijgehouden HTML-versie van de inhoud.

| Pagina | Waarover |
|---|---|
| [Gebruikershulp](GEBRUIKERSHULP.md) | Praktische laadvolgorde, actuele storingslijst, storingsfilter, opslag en hoofdproces |
| [Processflow](processflow.md) | Hoe de applicatie in elkaar zit, van bestand kiezen en actuele storingsselectie tot signaal, opslag en export |
| [Systeemwerking](SYSTEEMWERKING.md) | Technische architectuur, kwaliteitscontract, importregels, rekenketens en verplichte wijzigingscontroles |
| [Logische architectuur](architectuur.md) | Dienstverlening als doellaag, de drie invloeddomeinen, rule engine en trigger engine, plus de relatie met de technische vierlagenarchitectuur |
| [Rekenvoorbeeld signaalgevers](rekenvoorbeeld-signaalgevers.md) | Tien jaar geen signaalgevers vervangen, doorgerekend tot beschikbaarheid, dienstverlening en kosten |
| [Release notes runtime-patches en versiebalk](release-notes-2026-09-16-runtime-patches-en-versiebalk.md) | Bewaakt per runtime-patch dát hij installeert, en toont de versie van de schil en de geladen modules in de kopbalk |
| [Release notes herkomst DRIP-classificatie](release-notes-2026-09-16-drip-markerherkomst.md) | Maakt zichtbaar wanneer geen markerkolom is herkend en de gekozen soort een aanname is, en herkent samengestelde kopteksten |
| [Release notes afgeleide hersteltijd](release-notes-2026-09-16-afgeleide-hersteltijd.md) | Behandelt een hersteltijd die uit de peildatum volgt als bovengrens en houdt die buiten de herstelduurstatistiek en de prognose |
| [Release notes dienstaandelen normaliseren](release-notes-2026-09-16-dienstaandelen-normalisatie.md) | Normaliseert de subprocesaandelen bij het laden, zodat de dienstverlening niet langer een band 0,00–0,00% toont voordat het regelscherm is geopend |
| [Release notes DRIP-bronclassificatie](release-notes-2026-09-15-drip-bronclassificatie.md) | Filtert actuele DRIP-incidenten op het bronvenster, splitst RIA4 en Windwaarschuwing per regel en toont de herkomst in de brondekking |
| [Release notes operationele status uit storing](release-notes-2026-09-15-operationele-status-storing.md) | Voegt `Niet operationeel door storing` toe, koppelt fout 1003 en matcht open Windwaarschuwing-/RIA4-DRIP-storingen aan het assetregister |
| [Release notes RIA4- en Windwaarschuwingfilter assetregister](release-notes-2026-09-15-assetregister-ria4-windfilter.md) | Voegt dezelfde speciale DRIP-selectie als bij Open storingen toe aan het gezamenlijke assetregister |
| [Release notes speciale DRIP-referentielijsten](release-notes-2026-09-15-drip-speciale-referentielijsten.md) | Voegt aparte uploads voor Windwaarschuwing- en RIA4-DRIP’s toe en koppelt die classificatie aan het actuele Open storingen-beeld |
| [Release notes open DRIP-storingen uit historie](release-notes-2026-09-15-drip-open-uit-historie.md) | Toont aantoonbaar nog open DRIP-incidenten uit de historische werkmap ook in het actuele Open storingen-beeld, zonder nieuwe impactaanname |
| [Release notes expliciete NDW-laadknop](release-notes-2026-09-15-ndw-laadknop.md) | Laadt NDW-verkeersdata expliciet met voortgang, koppelt wegdelen en vult 6 spitsuren en 30% snelheidsreductie |
| [Release notes verkeersdata en spitsdefaults](release-notes-2026-09-15-verkeersdefaults-spits.md) | Herstelt opgeslagen NDW-verkeerscontext bij uitgestelde DVM-restore en vult 6 spitsuren en 30% snelheidsreductie als scenario-defaults |
| [Release notes open storingen worker-first](release-notes-2026-09-15-open-storingen-worker-filter-off.md) | Verwerkt actuele XLSX eerst in een Web Worker en schakelt live-overzichtsfilters tijdelijk uit tijdens importstabilisatie |
| [Release notes bron-specifiek DVM laden](release-notes-2026-09-15-dvm-bronbeheer-upload.md) | Geeft ieder DVM-brondeel een eigen uploadknop en stuurt bestanden rechtstreeks naar de bijbehorende parser |
| [Release notes actuele storingslijst](release-notes-2026-09-14-live-storingen.md) | Vervangen van live momentopnamen en automatisch historiseren van verdwenen MSI-storingen |
| [Release notes storingsfilter](release-notes-2026-09-14-storingsfilter.md) | Zelf instellen welke actuele open storingen meetellen zonder de bron- en historielogica te wijzigen |
| [Release notes filter-dashboard synchronisatie](release-notes-2026-09-14-live-filter-sync.md) | Filterwijzigingen automatisch doorrekenen en bron-, selectie- en dashboardaantallen uit elkaar houden |
| [Release notes datalaadvoortgang](release-notes-2026-09-14-data-load-progress.md) | Zichtbare byte- en fasevoortgang bij hub-import en specialistische DVM-bronnen |
| [Release notes importregressie PR 22](release-notes-2026-09-14-import-regressie-pr22.md) | Herstelt native File.text en voorkomt een tweede volledige parse van bekende grote BiDash-JSON |
| [Release notes snellere analysebeeldherbouw](release-notes-2026-09-14-import-analysebeeld-performance.md) | Vermijdt herhaalde assetkoppelingen en een dubbele matchbeeldpass tijdens een grote DVM-totaalimport |
| [Release notes snelle combiregels](release-notes-2026-09-14-combiregel-performance.md) | Vervangt de kwadratische N x N-combiloop door selectie op weg, type, afstand en tijdvenster bij grote totaalimports |
| [Release notes grote integrale import](release-notes-2026-09-14-integrale-import-memory.md) | Wacht op de DVM-performancepatches en voorkomt een overbodige volledige kopie van grote DVM-bundles |
| [Release notes universele importer](release-notes-2026-09-14-universele-importer.md) | Herkent JSON, CSV, TSV en Excel op inhoud, normaliseert kolomaliassen en zet losse DVM-bronnen om naar compatibele deelimports |
| [Release notes grote historie uitgesteld](release-notes-2026-09-14-grote-historie-uitgesteld.md) | Laat het live dashboard eerst starten en voert de kostbare historische assetkoppeling pas uit wanneer de prognose die nodig heeft |
| [Release notes Markdown Help](release-notes-2026-09-14-help-markdown.md) | Help toont de echte `.md`-inhoud, tabellen en SVG-procesflows |
| [Release notes dienstverleningsarchitectuur](release-notes-2026-09-14-dienstverleningsarchitectuur.md) | Scheiding tussen de inhoudelijke dienstverleningslogica en de technische implementatiearchitectuur |

## Mappen

- [`afbeeldingen/`](afbeeldingen), de figuren als SVG. Schaalvrij en bruikbaar in Help, Word, PowerPoint of Confluence.
- [`scripts/`](scripts), de scripts die het rekenvoorbeeld en de grafieken maken. Ze gebruiken de echte prognosemodule uit `site/core/`, zodat de documentatie niet uit de pas kan lopen met de applicatie.
- [`rekenvoorbeeld.json`](rekenvoorbeeld.json), de uitkomsten van het rekenvoorbeeld, machineleesbaar.

## Help-publicatie

`scripts/stage-docs.mjs` kopieert `docs/` naar de tijdelijke publicatiemap `site/docs/` en genereert `site/help-docs.js` met de inhoud van alle Markdown-bestanden op het hoogste niveau van deze map. Beide gegenereerde paden staan in `.gitignore`.

De Help-viewer in `site/help.html` gebruikt die bundel met `site/help.js` en `site/core/markdown.js`. Relatieve afbeeldingsverwijzingen zoals `afbeeldingen/bidash-processflow.svg`, `afbeeldingen/storingsfilter-flow.svg` en `afbeeldingen/architectuur-dienstverlening.svg` blijven daardoor zowel op GitHub als in de gepubliceerde Help werken. Een wijziging onder `docs/**` start de Pages-workflow opnieuw.

## Documentatiecontract

Bij een functionele wijziging controleer je minimaal `GEBRUIKERSHULP.md`, `processflow.md` en `SYSTEEMWERKING.md`. Als de wijziging invloed heeft op de bediening, gegevensstroom, rekenlogica, opslag of export, werk je de relevante stukken tegelijk met de code bij. De Help wordt daarna automatisch uit deze bronbestanden opgebouwd; wijzig inhoud daarom niet rechtstreeks in gegenereerde `site/docs/` of `site/help-docs.js`.

## Opnieuw genereren

```text
node docs/scripts/bereken-rekenvoorbeeld.mjs
node docs/scripts/maak-grafieken.mjs
node scripts/stage-docs.mjs
```

De simulatie gebruikt een vaste seed, dus dezelfde invoer geeft altijd dezelfde uitkomst.
