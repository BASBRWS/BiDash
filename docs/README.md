# Documentatie

Achtergrond bij BiDash integraal. De applicatie zelf staat in [`site/`](../site). De gepubliceerde gebruikershulp staat in `site/help.html` en wordt bij functionele wijzigingen samen met de documentatie in deze map bijgewerkt.

| Pagina | Waarover |
|---|---|
| [Gebruikershulp](GEBRUIKERSHULP.md) | Praktische laadvolgorde, actuele storingslijst, opslag en hoofdproces |
| [Processflow](processflow.md) | Hoe de applicatie in elkaar zit, van bestand kiezen tot signaal, opslag en export |
| [Systeemwerking](SYSTEEMWERKING.md) | Architectuur, kwaliteitscontract, importregels, rekenketens en verplichte wijzigingscontroles |
| [Logische architectuur](architectuur.md) | Leeswijzer bij de architectuurtekening: de vier lagen, het eigenaarschap en welke grenzen echt grenzen zijn |
| [Rekenvoorbeeld signaalgevers](rekenvoorbeeld-signaalgevers.md) | Tien jaar geen signaalgevers vervangen, doorgerekend tot beschikbaarheid, dienstverlening en kosten |
| [Release notes actuele storingslijst](release-notes-2026-09-14-live-storingen.md) | Vervangen van live momentopnamen en automatisch historiseren van verdwenen MSI-storingen |

## Mappen

- [`afbeeldingen/`](afbeeldingen), de figuren als SVG. Schaalvrij en bruikbaar in Word, PowerPoint of Confluence.
- [`scripts/`](scripts), de scripts die het rekenvoorbeeld en de grafieken maken. Ze gebruiken de echte prognosemodule uit `site/core/`, zodat de documentatie niet uit de pas kan lopen met de applicatie.
- [`rekenvoorbeeld.json`](rekenvoorbeeld.json), de uitkomsten van het rekenvoorbeeld, machineleesbaar.

## Documentatiecontract

Bij een functionele wijziging controleer je minimaal `GEBRUIKERSHULP.md`, `processflow.md` en `SYSTEEMWERKING.md`. Als de wijziging invloed heeft op de bediening, gegevensstroom, rekenlogica, opslag of export, werk je de relevante stukken tegelijk met de code bij. De Help-pagina in `site/help.html` moet dezelfde gebruikerswerking beschrijven.

## Opnieuw genereren

```text
node docs/scripts/bereken-rekenvoorbeeld.mjs
node docs/scripts/maak-grafieken.mjs
```

De simulatie gebruikt een vaste seed, dus dezelfde invoer geeft altijd dezelfde uitkomst.
