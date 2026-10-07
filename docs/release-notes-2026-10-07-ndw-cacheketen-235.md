# Business Intelligence Dashboard WVM 2.35, DVM 119

Datum: 7 oktober 2026

## NDW loader bleef oude code gebruiken

De browser laadde dvm-source-manager.js al met de nieuwe cacheversie, maar de moduleketen daaronder niet volledig.

dvm-adapter-original.js importeerde signal-forecast.js zonder versieparameter. signal-forecast.js importeerde op zijn beurt ndw-loader.js eveneens zonder versieparameter. Daardoor kon de browser een oudere NDW-loader uit cache blijven gebruiken, terwijl de zichtbare DVM-bronbeheercode al nieuw was.

Het gevolg was precies de oude foutmelding:

Selecteer voor NDW DATEX II v2.3 beide bestanden tegelijk: measurement_current.xml.gz en trafficspeed.xml.gz.

Die tekst hoort bij de oude naamgebaseerde herkenning en niet bij de nieuwe inhoudsherkenning.

## Oplossing

De hele runtimeketen krijgt nu dezelfde cacheversie:
- dvm-adapter-original -> signal-forecast;
- signal-forecast -> alle runtimepatches, waaronder ndw-loader;
- index, app, dvm.html en dvm-adapter.

Hierdoor wordt de actuele NDW-loader met gzip-magic-byte- en XML-inhoudsherkenning geforceerd geladen.

Versies:
Dashboard 2.35.
DVM 119.
