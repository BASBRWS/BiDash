# Documentatie

Achtergrond bij BiDash integraal. De applicatie zelf staat in [`site/`](../site). De Help-knop rechtsboven opent een viewer die tijdens testen en publicatie rechtstreeks uit de Markdown-bestanden in deze map wordt opgebouwd. Er is dus geen tweede handmatig bijgehouden HTML-versie van de inhoud.

| Pagina | Waarover |
|---|---|
| [Gebruikershulp](GEBRUIKERSHULP.md) | Praktische laadvolgorde, actuele storingslijst, opslag en hoofdproces |
| [Processflow](processflow.md) | Hoe de applicatie in elkaar zit, van bestand kiezen tot signaal, opslag en export |
| [Systeemwerking](SYSTEEMWERKING.md) | Architectuur, kwaliteitscontract, importregels, rekenketens en verplichte wijzigingscontroles |
| [Rekenvoorbeeld signaalgevers](rekenvoorbeeld-signaalgevers.md) | Tien jaar geen signaalgevers vervangen, doorgerekend tot beschikbaarheid, dienstverlening en kosten |
| [Release notes actuele storingslijst](release-notes-2026-09-14-live-storingen.md) | Vervangen van live momentopnamen en automatisch historiseren van verdwenen MSI-storingen |
| [Release notes Markdown Help](release-notes-2026-09-14-help-markdown.md) | Help toont de echte `.md`-inhoud, tabellen en SVG-procesflows |

## Mappen

- [`afbeeldingen/`](afbeeldingen), de figuren als SVG. Schaalvrij en bruikbaar in Help, Word, PowerPoint of Confluence.
- [`scripts/`](scripts), de scripts die het rekenvoorbeeld en de grafieken maken. Ze gebruiken de echte prognosemodule uit `site/core/`, zodat de documentatie niet uit de pas kan lopen met de applicatie.
- [`rekenvoorbeeld.json`](rekenvoorbeeld.json), de uitkomsten van het rekenvoorbeeld, machineleesbaar.

## Help-publicatie

`scripts/stage-docs.mjs` kopieert `docs/` naar de tijdelijke publicatiemap `site/docs/` en genereert `site/help-docs.js` met de inhoud van alle Markdown-bestanden op het hoogste niveau van deze map. Beide gegenereerde paden staan in `.gitignore`.

De Help-viewer in `site/help.html` gebruikt die bundel met `site/help.js` en `site/core/markdown.js`. Relatieve afbeeldingsverwijzingen zoals `afbeeldingen/bidash-processflow.svg` blijven daardoor zowel op GitHub als in de gepubliceerde Help werken. Een wijziging onder `docs/**` start de Pages-workflow opnieuw.

## Documentatiecontract

Bij een functionele wijziging controleer je minimaal `GEBRUIKERSHULP.md`, `processflow.md` en `SYSTEEMWERKING.md`. Als de wijziging invloed heeft op de bediening, gegevensstroom, rekenlogica, opslag of export, werk je de relevante stukken tegelijk met de code bij. De Help wordt daarna automatisch uit deze bronbestanden opgebouwd; wijzig inhoud daarom niet rechtstreeks in gegenereerde `site/docs/` of `site/help-docs.js`.

## Opnieuw genereren

```text
node docs/scripts/bereken-rekenvoorbeeld.mjs
node docs/scripts/maak-grafieken.mjs
node scripts/stage-docs.mjs
```

De simulatie gebruikt een vaste seed, dus dezelfde invoer geeft altijd dezelfde uitkomst.
