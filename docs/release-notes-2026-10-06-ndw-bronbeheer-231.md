# Business Intelligence Dashboard WVM 2.31, DVM 115

Datum: 6 oktober 2026

## NDW als eigen DVM-bron

DVM-bronbeheer heeft nu een aparte kaart NDW verkeersintensiteit voor kosten.

De kaart toont de geladen NDW-verkeerssnapshot, waaronder het aantal meetlocaties, het aantal bruikbare intensiteiten en de publicatiedatum. De bron staat los van de NDW CMDB-import voor MSI- en DRIP-areaal.

Er zijn twee routes:
- NDW verkeerssnapshot laden, kiest direct een Business Intelligence Dashboard WVM/DVM JSON- of HTML-export waarin ndw69Snapshot aanwezig is.
- Gebruik uit werkruimte, zoekt de snapshot in de actieve of lokaal opgeslagen werkruimte.

De file-handler wordt rechtstreeks vanuit DVM-bronbeheer aangeroepen. Daardoor is hij niet afhankelijk van een uitgestelde klik op een verborgen bestandsveld.

## Kosten

NDW voedt alleen voertuigen per uur. Zes hinderuren en 30 procent snelheidsreductie blijven scenarioaannames en zijn geen NDW-metingen.

## Ruwe NDW open data

De bronkaart leest nu rechtstreeks het actuele DATEX II v3 gecombineerde bestand snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz. GZIP wordt in Edge en Chrome in de browser uitgepakt. De parser leest meetlocaties, anyVehicle-intensiteiten, rijstroken, meettijd, snelheid en beschikbare locatiekenmerken. Een eerdere dashboard/DVM-export met ndw69Snapshot blijft ondersteund.
