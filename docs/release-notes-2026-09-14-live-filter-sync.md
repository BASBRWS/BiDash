# Release notes — live storingsfilter en dashboard

Datum: 14 september 2026

## Probleem

De filterkaart in DVM-bronbeheer werkte als een voorvertoning. Het wijzigen van vinkjes veranderde alleen de teller in de filterkaart. De daadwerkelijke actuele DVM-doorrekening werd pas opnieuw uitgevoerd na de knop `Toepassen en overzicht openen`, die onderaan de lange filterkaart stond. Daardoor kon het dashboard ongewijzigd lijken terwijl de gebruiker dacht dat de selectie al actief was.

Daarnaast gebruikte de filterkaart de term `tellen mee` voor bronregels, terwijl de DVM-doorrekening daarna nog ongeldige locaties en echte doublures kan uitsluiten. Daardoor kon bijvoorbeeld het aantal bronregels hoger zijn dan het aantal doorgerekende open meldingen zonder dat duidelijk was waarom.

## Oplossing

- Wijzigingen aan vinkjes worden automatisch, met een korte debounce, toegepast op de actuele doorrekening.
- `Alles` en `Niets` per filtergroep passen de selectie eveneens automatisch toe.
- De aparte knop om de selectie eerst te activeren vervalt; er blijft een knop om direct naar het dienstoverzicht te gaan.
- De filterkaart onderscheidt voortaan:
  - open bronregels;
  - geselecteerd door het filter;
  - doorgerekende open meldingen na DVM-validatie en ontdubbeling;
  - door het filter uitgesloten bronregels.
- De melding boven het DVM-dienstoverzicht toont dezelfde keten van bronregels naar doorgerekende meldingen.
- De volledige bronmomentopname blijft ongewijzigd voor A/B-vergelijking en automatische historisering.

## Rekenkundige betekenis

`bronregels → gebruikersfilter → DVM-validatie/locatie/foutregel/ontdubbeling → doorgerekende open meldingen → dienstimpact`

Een verschil tussen `geselecteerd` en `doorgerekend` is dus geen verloren brondata, maar een zichtbaar gemaakte volgende stap in de rekenketen.
