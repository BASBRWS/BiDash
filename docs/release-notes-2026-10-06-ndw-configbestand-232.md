# Business Intelligence Dashboard WVM 2.32, DVM 116

Datum: 6 oktober 2026

## NDW configuratiebestand gecontroleerd

Het aangeleverde bestand snelheden_en_intensiteiten_configuratie_meetlocaties.xml.gz.xml is inhoudelijk gecontroleerd.

Hoewel Windows het bestand als XML toont, bevat het nog steeds een gzip-header. Na uitpakken is het circa 147 MB groot. Het bevat 20.577 measurementSite-configuraties, maar geen siteMeasurements, physicalQuantity of vehicleFlowRate. Het bestand beschrijft dus alleen de meetlocaties en bevat geen actuele verkeersintensiteiten.

Voor de verkeerskosten moet het gecombineerde NDW DATEX II v3 bestand worden geladen:

snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz

Dit bestand hoeft niet handmatig te worden uitgepakt of hernoemd.

## Gedrag in bronbeheer

DVM-bronbeheer weigert voortaan het losse configuratiebestand direct met een gerichte melding. Daardoor wordt het bestand niet eerst onnodig volledig naar circa 147 MB XML uitgepakt en in de DOM geladen.

De NDW-bron vereist All Assets. De meetlocaties hebben WGS84-coördinaten. De loader zet die om naar RD en gebruikt All Assets om weg, richting en hectometer voor de koppeling aan de verkeerskosten te bepalen. RWS MONIBAS-identificaties worden aanvullend gebruikt als weg- en hectometerhint.

Versies:
Dashboard 2.32.
DVM 116.
