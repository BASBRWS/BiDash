# Release notes — BiDash 2.20 / DVM 103: All Assets als bron voor leeftijd en EOL

Datum: 21 september 2026

## Doel

All Assets wordt de enige operationele assetbron voor installatie-/stichtingsdatum, EOL en expliciete levensduur. De losse EOL-referentiebron vervalt.

## Vraag BiDash

De chat begrijpt nu onder meer:

- `Wat is de oudste asset?`
- `Wat is de oudste MSI asset in ZWN?`
- `Wat is de nieuwste asset?`
- `Welke assets zijn voorbij EOL?`

Voor oudste/nieuwste assets gebruikt BiDash de installatiedatum uit All Assets. Als alleen een installatie-/stichtingsjaar bekend is, wordt dat jaar gebruikt. Assets zonder bruikbare datum worden niet in de leeftijdsrangschikking opgenomen.

## EOL-bron verwijderd

Verwijderd:
- de EOL-upload in DVM-bronbeheer;
- de EOL-upload in de DVM-regelinterface;
- `EOL_REF`, `eolRegelVoor()` en de factsheetkoppeling;
- EOL als aparte datasetkaart;
- EOL als apart onderdeel van DVM- en integrale exports;
- EOL als zelfstandige universele importsoort.

EOL-kolommen en levensduurkolommen blijven juist wél onderdeel van de All Assets-herkenning.

## Betrouwbaarheidsvolgorde

1. individuele assetconfiguratie;
2. handmatige fabrikant×type-override;
3. expliciete levensduur/EOL uit All Assets;
4. generieke assettype-levensduur;
5. standaard-terugval.

## Compatibiliteit

DVM-totaalformaat is verhoogd naar versie 55. Oude totaalbestanden blijven leesbaar. Een oud los `eol`-blok wordt bewust genegeerd; de EOL-waarden in het assetregister zijn leidend.

## Versies

- BiDash 2.20
- DVM 103
