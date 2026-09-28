# BiDash 2.27 en DVM 112, compact bronbeheer

Datum: 28 september 2026

## Wat is aangepast

- De kaarten **Signaalgevers totaal** en **DRIP totaal** tonen niet langer de
  volledige lijst met alle ingelezen bestanden.
- De inhoudelijke tellingen blijven zichtbaar.
- Onder **Laatste update per regio** staat per verkeerscentrale alleen de nieuwste
  bekende brondatum. Regio's blijven onder elkaar staan met een vetgedrukte code.
- Bestandsnamen en bronhistorie blijven in de bronstatus en exports beschikbaar.
  Alleen de presentatie in DVM-bronbeheer is compacter gemaakt.

## Techniek en controle

- `laatstePerVc` selecteert bij het opbouwen van de bronstatus de hoogste datum
  per regio; `regioUpdatesHtml()` rendert precies één regel per regio.
- Een regressietest borgt dat de totaalbronkaarten geen bestandenlog meer
  renderen en de inhouds- en regioblokken behouden.
- Import, samenvoegen, opslag, export en DVM-berekeningen zijn niet gewijzigd.
