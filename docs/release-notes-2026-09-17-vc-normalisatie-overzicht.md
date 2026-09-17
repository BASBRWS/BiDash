# Release notes hoofdletterongevoelige VC-groepering

Datum: 17 september 2026

Versie: BiDash 2.14, DVM 99

## Probleem

Het Overzicht groepeerde wegdelen op de onbewerkte tekst van de verkeerscentrale.
Daardoor werden bijvoorbeeld `ZWN` en `zwn` als twee losse entiteiten getoond,
terwijl hoofdletters inhoudelijk geen verschil maken.

## Gewijzigd

- Verkeerscentralecodes worden vóór aggregatie omgezet naar één canonieke code.
- Hoofdletters, spaties en een optioneel `VC`-voorvoegsel maken geen verschil.
- De historische aliassen `WNN` en `WNZ` worden als `NWN` en `ZWN` verwerkt.
- Het Overzicht, de uitvoeringstabel per verkeerscentrale en het VC-filter bij
  Wegdelen gebruiken dezelfde groepering.
- Nieuwe wegdeelresultaten bewaren direct de genormaliseerde verkeerscentralecode.

## Ongewijzigd

De storingsselectie, assetkoppeling, impactregels en dienstberekening zijn niet
gewijzigd. Alleen de identificatie en presentatie van de verkeerscentrale is
gelijkgetrokken.

## Controle

`tests/vc-normalisatie-overzicht.test.js` controleert dat `ZWN`, `zwn`, `VC ZWN`
en `WNZ` één groep `ZWN` vormen, terwijl `NWN` een aparte groep blijft. De test
borgt ook dat de overzichtsgrafiek en het wegdelenfilter de canonieke code gebruiken.
