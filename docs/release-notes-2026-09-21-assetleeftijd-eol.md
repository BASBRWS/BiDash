# Release notes — assetleeftijd en EOL uit All Assets

Datum: 21 september 2026

## Aanleiding

Vraag BiDash behandelde vragen als **“wat is de oudste asset?”** niet als een rangschikking op installatie-/ingebruiknamedatum. Daarnaast bestond er nog een losse EOL-referentiebron terwijl **All Assets** al de expliciete EOL- en levensduurvelden bevat.

## Gewijzigd

- Vraag BiDash herkent nu vragen naar de **oudste**, **nieuwste** en **jongste** asset als leeftijdsvragen.
- De leeftijdsrangschikking gebruikt uitsluitend de installatie-/ingebruiknamegegevens uit **All Assets**. Ondersteunde bronvelden blijven de bestaande installatie-aliases, waaronder ingebruikname, bouwjaar, installatiejaar en commissioning/installation date.
- Assets zonder bruikbare installatie-/ingebruiknamedatum worden niet stilzwijgend als oud of nieuw beschouwd, maar buiten de rangschikking gehouden.
- Assetresultaten ontsluiten nu expliciet `ingebruikname`, `bouwjaar`, bronveld, EOL-jaar en EOL-levensduur richting Vraag BiDash.
- De losse **EOL-referentie** is verwijderd uit:
  - DVM bronbeheer en uploadinterface;
  - reliability-/Weibull-bronvolgorde;
  - datasetbeheer;
  - Context API;
  - totaalexport en totaalimport;
  - DVM-adapter;
  - universele importer;
  - regelscherm.
- EOL-vragen in Vraag BiDash lezen alleen nog concrete EOL-waarden uit **All Assets**.
- Voor prognoses blijft de bestaande terugval bestaan: wanneer All Assets geen bruikbare levensduur bevat, kan een bewuste assetconfiguratie of generieke levensduur van het assettype worden gebruikt. Dit wordt als modelbron aangeduid en niet als gemeten EOL-data.

## Compatibiliteit

Oude totaalexports met een apart `eol`-onderdeel blijven als JSON leesbaar, maar die losse referentie wordt niet meer als bron gebruikt. De expliciete EOL-gegevens horen voortaan in het assetregister / All Assets.

## Acceptatie

Regressietests dekken minimaal:

1. “Wat is het oudste asset?” kiest de vroegste installatie-/ingebruiknamedatum uit All Assets.
2. “Wat is het nieuwste asset?” kiest het hoogste bruikbare bouw-/installatiejaar en negeert ontbrekende datums.
3. EOL-vragen gebruiken alleen EOL uit All Assets.
4. Bronbeheer bevat geen losse EOL-uploadroute meer.
