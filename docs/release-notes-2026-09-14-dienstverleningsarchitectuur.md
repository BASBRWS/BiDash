# Release notes 14 september 2026 — dienstverleningsarchitectuur

De architectuurdocumentatie maakt nu expliciet onderscheid tussen de inhoudelijke denkwijze en de technische implementatie van BiDash.

## Inhoudelijk model

De VWM-dienstverlening staat bovenaan als doellaag. Daaronder staan drie gelijkwaardige informatiedomeinen:

1. Bedrijfsvoering / BI: formatie, capaciteit, contracten, budget en interne bedienketens.
2. Technische middelen / DVM-assets: areaal, EOL, storingen, technische beschikbaarheid, prestatie en assetgerelateerde verkeerskosten.
3. Planning en externe invloeden: activiteiten, afhankelijkheden, werkzaamheden, U-routes, afsluitingen en tijdgebonden context.

De rule engine vertaalt bronfeiten naar invloed op de dienstverlening. De trigger engine bepaalt wanneer de berekende toestand een signaal of besluitmoment oplevert.

BI is daarmee niet technisch of logisch de eigenaar van DVM en Planning. De drie domeinen leveren ieder zelfstandig feiten. De dienstverlening is de gemeenschappelijke bovenlaag.

## Technische architectuur blijft behouden

De bestaande vierlagenarchitectuur met schil, kern, adapters en modules blijft apart zichtbaar en normatief gekoppeld aan `SYSTEEMWERKING.md`. De nieuwe inhoudelijke tekening vervangt die technische tekening niet.

## Relatie met het storingsfilter

Het live storingsfilter uit de rule engine illustreert de scheiding tussen bronfeit en dienstberekening. De volledige open-storingsmomentopname blijft intact voor A-B-vergelijking en historisering. Alleen de geselecteerde meldingen voeden de actuele impactberekening.

## Documentatie

- nieuw: `docs/afbeeldingen/architectuur-dienstverlening.svg`;
- bijgewerkt: `docs/architectuur.md`;
- bijgewerkt: `docs/README.md`.

Omdat Help rechtstreeks uit `docs/` wordt opgebouwd, verschijnt deze architectuur na publicatie automatisch in de Help-viewer.
