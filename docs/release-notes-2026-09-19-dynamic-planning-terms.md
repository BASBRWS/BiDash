# Release notes — BiDash 2.19: dynamische planningterminologie

Datum: 19 september 2026

Versie: BiDash 2.19, DVM 102

## Doel

Vraag BiDash gebruikt voortaan de geladen planning zelf als vocabulaire. Afkortingen, projectnamen, activiteitcodes en WBS-termen hoeven niet vooraf in de parser te zijn vastgelegd.

## Werking

Per planningregel worden activiteit-/mijlpaalnaam, code, WBS/blok, volledig WBS-pad, planningsdienst en activiteitstype ontsloten en lokaal geïndexeerd.

Hierdoor werken bijvoorbeeld:
- `Wanneer is de eerst volgende IFAT?`
- `Wanneer is VAL-77?`
- `Wanneer is WBS-900?`
- `Wanneer is Gate-Z?`

Een gevonden planningterm is een expliciete planningcontext. Daardoor wordt een eerder gesprek over bijvoorbeeld Incidentmanagement niet onterecht voortgezet.

Bij `wanneer`, `eerstvolgende` en `meest recente` worden de gevonden matches geordend op de effectieve planningdatum.

## Privacy en rekengrens

De zoekindex wordt lokaal opgebouwd uit het reeds geladen planningmodel. Er is geen AI- of netwerkcall toegevoegd en er wordt geen nieuw planningmodel berekend.

## Tests

Regressietests dekken:
- IFAT na een eerdere dienstverleningscontext;
- planningcode;
- WBS-code;
- term uit volledig WBS-pad;
- contextwisseling naar planning.
