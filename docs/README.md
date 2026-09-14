# Documentatie

Achtergrond bij BiDash integraal. Deze map bevat alleen documentatie; de
applicatie zelf staat in [`site/`](../site) en wordt daar ongewijzigd door
gepubliceerd.

| Pagina | Waarover |
|---|---|
| [Processflow](processflow.md) | Hoe de applicatie in elkaar zit: van bestand kiezen tot signaal, opslag en export |
| [Rekenvoorbeeld signaalgevers](rekenvoorbeeld-signaalgevers.md) | Tien jaar geen signaalgevers vervangen, doorgerekend tot beschikbaarheid, dienstverlening en kosten |

## Mappen

- [`afbeeldingen/`](afbeeldingen) — de figuren, als SVG. Schaalvrij en bruikbaar
  in Word, PowerPoint of Confluence.
- [`scripts/`](scripts) — de scripts die het rekenvoorbeeld en de grafieken
  maken. Ze gebruiken de echte prognosemodule uit `site/core/`, zodat de
  documentatie niet uit de pas kan lopen met de applicatie.
- [`rekenvoorbeeld.json`](rekenvoorbeeld.json) — de uitkomsten van het
  rekenvoorbeeld, machineleesbaar.

## Opnieuw genereren

```
node docs/scripts/bereken-rekenvoorbeeld.mjs   # rekent door, schrijft rekenvoorbeeld.json
node docs/scripts/maak-grafieken.mjs           # tekent de figuren opnieuw
```

De simulatie gebruikt een vaste seed, dus dezelfde invoer geeft altijd dezelfde
uitkomst.
