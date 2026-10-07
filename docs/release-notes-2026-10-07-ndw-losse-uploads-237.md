# Business Intelligence Dashboard WVM 2.37, DVM 121

Datum: 7 oktober 2026

## Twee aparte NDW-bronuploads

Bronbeheer toont NDW meetlocaties en NDW trafficspeed / verkeersdata voor kosten als aparte kaarten. Elke kaart heeft een eigen bestandinput en controleert de gekozen bronsoort. Beide laadvolgordes zijn ondersteund.

De meetlocatietabel wordt direct verwerkt en blijft tijdens de sessie beschikbaar. Een nieuwe trafficspeedmeting leest die tabel niet opnieuw volledig in. Een mislukte verkeersupload wist de configuratie en vorige geldige verkeerssnapshot niet. Onvolledige XML-meetblokken geven een gerichte foutmelding.

De NDW-loader meldt voortgang via de bestaande importstatus in de hoofdschil en geeft tijdens streaming ruimte om de status te tekenen. Het oude pad toonde de NDW-voortgang uitsluitend in het kostenpaneel, waardoor de verwerking vanuit Bronbeheer stil leek te staan.

De bestaande meervoudige upload, gecombineerde DATEX II v3-bron en JSON/HTML-export blijven via Gecombineerd bestand of export beschikbaar. De cache en losse bestanden blijven sessiegebonden. Er verandert niets aan de verkeerskostenformules of scenarioaannames.

## Controle

De browserregressie gebruikt synthetische configuratie en verkeersmetingen en controleert de twee echte broninputs, beide laadvolgordes, configuratiehergebruik, herstel na een parsefout, vorige snapshot behouden en geen dubbeltelling van voertuigcategorieën. De browserregressie is toegevoegd aan npm run test:browser. Volledige aangeleverde bronbestanden worden uitsluitend lokaal gecontroleerd en gaan niet mee in Git.

Controles: npm test, alle 366 tests geslaagd; npm run test:ndw geslaagd; tests/browser.cjs en tests/planning-formation.cjs geslaagd. De bestaande browserscripts zoeken de BI-frame nu op URL-pad, zodat een cacheparameter de frameherkenning niet blokkeert. De brede suite bereikt vervolgens een timeout in tests/planning-large.cjs bij herstel van 4.000 planningregels; de betreffende planningcode is niet gewijzigd. De NDW-import met de volledige aangeleverde bestanden is lokaal geslaagd; koppeling met een volledig operationeel All Assets-register is niet in deze controle meegenomen.

Dashboard 2.37 en DVM 121 delen deze releaseverhoging. De volledige DVM-loaderketen krijgt een nieuwe cacheparameter.
