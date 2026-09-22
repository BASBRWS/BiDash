# Release notes — DVM 107: leesbare bronbeheerkaarten

Datum: 22 september 2026

## Wijziging

De bronkaarten voor **Signaalgevers totaal** en **DRIP totaal** tonen hun metadata niet langer als één lange tekstregel.

De kaart is nu opgebouwd uit afzonderlijke blokken voor:
- bestand of bestanden;
- aantallen en koppeling;
- laatste update per regio;
- toelichting op de bronwerking.

Regio's staan onder elkaar. De regiocode is vet en de datum staat er direct naast als **Laatste update <datum>**.

Voorbeeld:

```text
ZWN   Laatste update 21-09-2026
NWN   Laatste update 20-09-2026
```

De wijziging is alleen presentatie. Brondata, koppelingen en rekenlogica veranderen niet.

## Versie

- BiDash 2.22
- DVM 107
