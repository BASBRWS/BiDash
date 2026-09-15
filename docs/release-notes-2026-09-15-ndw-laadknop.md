# Release notes, expliciete NDW-laadknop

Datum: 15 september 2026

## Aanleiding

De NDW-verkeersgegevens waren eerder onderdeel van een DVM/BiDash-export, maar de nieuwe lichte bron-specifieke laadroute maakte niet duidelijk of die verkeerssnapshot in de actieve werkruimte was hersteld. Daardoor kon Wegdelen `Niet berekenbaar` blijven tonen terwijl de gebruiker de verkeersmetingen eerder al had aangeleverd.

## Wijziging

In de NDW-sectie van Wegdelen staat nu een expliciete knop `Laad NDW` met een voortgangsbalk.

De knop voert achtereenvolgens uit:

1. zoeken naar een NDW-snapshot die al in de actieve DVM-engine staat;
2. zoeken naar dezelfde snapshot in de lokaal opgeslagen BiDash-werkruimte;
3. als die daar niet meer aanwezig is, éénmalig een eerdere BiDash/DVM JSON- of HTML-export laten kiezen en daar alleen de `ndw69Snapshot`/`NDW69_DATA` uit halen;
4. de gevonden meetlocaties koppelen aan de actuele Wegdelen via de bestaande weg-, richting- en hectometerlogica;
5. ontbrekende hinderuren invullen met 6 uur, ochtendspits 07:00–10:00 plus avondspits 16:00–19:00;
6. ontbrekende snelheidsreductie invullen met 30 procent;
7. de nieuwe verkeerscontext via de bestaande DVM-export terug laten opslaan in de lokale BiDash-werkruimte.

De generieke totaalimport wordt hiervoor niet gebruikt.

## Grote exportbestanden

Wanneer de NDW-snapshot alleen nog in een oude grote JSON- of HTML-export aanwezig is, leest de NDW-loader het bestand in blokken. Hij zoekt alleen het NDW-object en parseert dat object in een Web Worker. Hierdoor hoeft een integrale export van tientallen MB niet volledig met `JSON.parse()` op de UI-thread te worden verwerkt.

De voortgangsbalk toont zowel het uitlezen van het bronbestand als het koppelen van de meetlocaties aan de huidige wegdelen.

## Rekenwaarden

Voertuigen per uur komen uit de gekoppelde NDW-meting. De 6 hinderuren en 30 procent snelheidsreductie zijn scenarioaannames. Handmatig ingevulde waarden blijven leidend en worden door `Laad NDW` niet overschreven.
