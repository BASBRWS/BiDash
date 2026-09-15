# Release notes, verkeersdata en spitsdefaults

Datum: 15 september 2026

## Aanleiding

In Wegdelen bleef een verkeersscenario `Niet berekenbaar` wanneer de zware DVM-werkruimte bij opstart bewust niet volledig werd hersteld. Daardoor konden ook eerder opgeslagen verkeersparameters, waaronder de NDW-meetmomentopname, buiten beeld blijven. Daarnaast stonden hinderuren en snelheidsreductie leeg terwijl hiervoor al vaste scenarioafspraken waren gemaakt.

## Wijziging

Bij een uitgestelde zware DVM-restore wordt `parameters.kosten` nu wel selectief hersteld. Daarmee blijft een eerder opgeslagen `ndw69Snapshot` beschikbaar zonder het assetregister en de storingshistorie opnieuw via de zware totaalimport op te bouwen.

Voor het Wegdelen-verkeersscenario gelden bij ontbrekende handmatige waarden voortaan de volgende defaults:

- ochtendspits: 07:00–10:00;
- avondspits: 16:00–19:00;
- hinderuren per brondag: 6 uur;
- generieke snelheidsreductie bij volledige assetuitval: 30 procent.

Een expliciet handmatig ingevulde waarde, ook nul, blijft altijd leidend. De voertuigen per uur blijven uit de bestaande NDW-koppeling komen wanneer een bruikbare meetlocatie is gevonden. De bestaande ruimtelijke kwaliteitsregel voor de meetlocatie is in deze wijziging niet versoepeld.

## Onderbouwing in de UI

Wanneer nog geen eigen brontekst is ingevuld, vult BiDash een scenariobron in waarin de gebruikte spitsblokken en de generieke 30-procentreductie expliciet worden genoemd. Daardoor is zichtbaar welke delen gemeten verkeersdata zijn en welke delen scenarioaannames zijn.

## Techniek

`site/core/traffic-scenario-defaults.js` wrapt `sc67Config()` en vult uitsluitend ontbrekende scenario-invoer. `site/engines/dvm-adapter.js` herstelt bij een uitgestelde zware werkruimte alleen de verkeers-/kostencontext en slaat de zware operationele restore nog steeds over.
