# Business Intelligence Dashboard WVM 2.33, DVM 117

Datum: 7 oktober 2026

## NDW DATEX II v2.3 als dubbele bron

DVM-bronbeheer accepteert nu twee NDW v2.3 bestanden tegelijk:

- measurement_current.xml.gz
- trafficspeed.xml.gz

measurement_current levert de meetlocatieconfiguratie, rijstrookindeling en locatiereferentie. trafficspeed levert de actuele intensiteit en gemeten snelheid. De bestanden worden gekoppeld via measurementSiteReference en de meetindex.

De bestaande DATEX II v3 route blijft ondersteund via één gecombineerd bestand:

- snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz

All Assets blijft vereist voor de koppeling van NDW-meetpunten aan weg, richting en hectometer.

## Verkeerskosten

NDW vult nu twee verkeerswaarden automatisch in wanneer die beschikbaar zijn:

- voertuigen per uur;
- gemeten snelheid als basissnelheid zonder assetstoring.

Een handmatig opgeslagen snelheid blijft leidend. De snelheidsreductie door assetuitval en de hinderuren blijven scenarioaannames.

## Bronbeheer

De NDW-kaart toont na laden:

- aantal meetlocaties;
- aantal locaties met bruikbare intensiteit;
- aantal locaties met bruikbare snelheid;
- aantal geldige rijstrookintensiteiten;
- aantal locaties met weg, richting en hectometer;
- aantal actuele wegdelen dat aan een NDW-meetpunt is gekoppeld.

Versies:
Dashboard 2.33.
DVM 117.
