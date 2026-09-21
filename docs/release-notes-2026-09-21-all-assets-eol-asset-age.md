# Release notes — BiDash 2.20 / DVM 103: assetleeftijd en EOL uit All Assets

Datum: 21 september 2026

## Doel

All Assets wordt de enige expliciete bron voor installatie-/ingebruiknamedatum, EOL en levensduurgegevens. De aparte EOL-referentie vervalt. Vraag BiDash gebruikt dezelfde assetvelden voor vragen over ouderdom.

## Vraag BiDash

De lokale chat begrijpt nu onder meer:

- `Wat is het oudste asset?`
- `Welke assets zijn het oudst?`
- `Wat is het nieuwste asset?`
- `Welke assets zijn over EOL?`

Voor oudste/nieuwste wordt de echte installatie-/ingebruiknamedatum uit All Assets gebruikt wanneer die beschikbaar is. Alleen als geen exacte datum beschikbaar is, wordt een bruikbaar bouw-/installatiejaar gebruikt. Assets zonder bruikbare datum worden niet in de rangschikking opgenomen.

## EOL-model

De afzonderlijke EOL-referentie is verwijderd uit:

- DVM-bronbeheer en uploadschermen;
- de reliability-/levensduurketen;
- Datasetbeheer;
- Context API;
- universele bronherkenning;
- DVM totaalimport en totaalexport;
- regelscherm en adapterstate.

All Assets blijft EOL-kolommen, expliciete levensduur en installatie-/ingebruiknamedatum herkennen.

De effectieve levensduur volgt nu:

1. individuele assetconfiguratie;
2. handmatige fabrikant×type-override;
3. expliciete levensduur uit All Assets, of EOL-jaar minus installatiejaar;
4. generieke levensduur van het assettype;
5. voor DRIP de bestaande standaard-terugval als ook de assettypewaarde ontbreekt.

Er wordt dus geen fabrikant-factsheet/EOL-referentie meer gematcht.

## Compatibiliteit

Een oudere totaalexport die nog een zelfstandige `eol`-sectie bevat kan worden geopend, maar die sectie wordt niet meer als actieve bron toegepast. De EOL-informatie die nodig is voor de huidige versie moet in All Assets staan.

## Versies

- BiDash 2.20
- DVM 103

DVM is verhoogd omdat de bronvolgorde voor de levensduur-/EOL-doorrekening inhoudelijk is gewijzigd.

## Tests

Regressies borgen:
- oudste en nieuwste asset op installatiegegevens uit All Assets;
- assets zonder installatiedatum tellen niet mee in de rangschikking;
- EOL-vragen gebruiken de assetregistervelden;
- geen zelfstandige EOL-upload, state, importer, Context API of totaalexport;
- All Assets behoudt installatie-, EOL- en levensduurvelden.
