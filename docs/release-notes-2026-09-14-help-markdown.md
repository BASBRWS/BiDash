# Release notes 14 september 2026 — Help uit Markdown

## Aanleiding

De eerste geïntegreerde Help-pagina bevatte een handmatig geschreven HTML-samenvatting. Daardoor ontbraken de uitgebreidere procesflows, tabellen en SVG-afbeeldingen die al in `docs/` aanwezig waren.

## Gewijzigd

- De Help-knop opent nog steeds `site/help.html`, maar die pagina is nu alleen de viewer.
- `scripts/stage-docs.mjs` bundelt bij testen en publicatie alle Markdown-bestanden uit `docs/` en kopieert de documentatiebestanden en SVG's naar het Pages-artifact.
- `site/help.js` toont de echte Markdown-inhoud met documentnavigatie.
- `site/core/markdown.js` rendert koppen, lijsten, tabellen, links, code, citaten en afbeeldingen zonder externe Markdown-dienst of CDN.
- Relatieve SVG-verwijzingen uit de Markdown worden opgelost vanuit het bronbestand, zodat de bestaande procesflow-afbeeldingen in Help zichtbaar zijn.
- De processflow is de standaardweergave van Help.
- Wijzigingen onder `docs/**` activeren voortaan de Pages-workflow.
- De gegenereerde `site/docs/` en `site/help-docs.js` worden niet in Git opgeslagen.

## Kwaliteitscontrole

Er zijn regressietests toegevoegd voor de Help-shell, het bundelen van `docs/`, het beschikbaar zijn van de processflow-SVG en de Markdown-rendering. HTML uit Markdown wordt geescaped en onveilige URL-schema's worden niet als actieve links gerenderd.
