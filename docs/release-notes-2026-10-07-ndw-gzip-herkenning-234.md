# Business Intelligence Dashboard WVM 2.34, DVM 118

Datum: 7 oktober 2026

## NDW gzip-herkenning op inhoud

De NDW DATEX II v2.3 import vertrouwde nog te sterk op de bestandsnaam. Browsers en downloads kunnen namen veranderen, bijvoorbeeld measurement.xml.gz.xml of trafficspeed.xml.gz (1).xml. Daardoor werd een geldig gzipbestand niet altijd als het configuratie- of meetbestand herkend.

De loader controleert nu eerst de gzip magic bytes 1F 8B en daarna de XML-inhoud. Daardoor zijn de bestandsnamen niet meer bepalend.

Herkenning:
- MeasurementSiteTablePublication of measurementSiteRecord betekent meetlocatieconfiguratie.
- MeasuredDataPublication, siteMeasurements of vehicleFlowRate betekent verkeersmetingen.

## Grote XML-bestanden

De v2.3 bestanden worden nu streaming verwerkt. De meetlocatieconfiguratie en trafficspeed worden blok voor blok gelezen. Daardoor hoeft een groot uitgepakt XML-bestand niet volledig als één DOM in browsergeheugen te staan.

Dit is relevant omdat een gecomprimeerd configuratiebestand van circa 10 MB na uitpakken honderden MB XML kan bevatten.

## Laden

Selecteer in DVM-bronbeheer beide bestanden tegelijk:
- de meetlocatieconfiguratie, ook wanneer die anders heet dan measurement_current.xml.gz;
- trafficspeed, ook wanneer de browser de naam heeft aangepast.

De app koppelt daarna configuratie, rijstrookindeling, intensiteit en snelheid via measurementSiteReference en meetindex.

Versies:
Dashboard 2.34.
DVM 118.
