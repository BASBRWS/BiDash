# Business Intelligence Dashboard WVM 2.39, DVM 123

Datum: 7 oktober 2026

De vaste grens van één kilometer sloot wegdelen uit van de NDW-intensiteit en daarmee van de verkeerskosten. Alle actuele wegdelen blijven nu in het overzicht. De app kiest per wegdeel de dichtstbijzijnde geldige intensiteit op dezelfde weg en rijrichting, zonder vaste afstandsgrens. A- en N-wegen en tegengestelde rijrichtingen blijven gescheiden. De representatieve zwaarste storing en de bestaande kostenformules blijven leidend.

Een afstand boven één kilometer staat als **Ruimere koppeling** in de bronkaart, de wegdeelkoppeling, kostenregel en memo, met de afstand in de bestaande herkomst. Dit is een scenario, geen bewijs dat beide locaties dezelfde verkeersstroom hebben. De gebruiker moet lokale op- en afritten en toepasbaarheid controleren. Meetpunten achter elkaar worden niet opgeteld. Zonder passende meting of hectometer blijft het wegdeel zichtbaar met een reden en onbekende intensiteit/kosten; ontbrekende waarden worden geen nul. Een echt gemeten nulintensiteit blijft nul. Handmatige scenario-invoer en bewust uitgezet NDW-gebruik blijven in het rekenpad gerespecteerd.

Een opgeslagen meetlocatie die verdwenen of ongeldig geworden is, krijgt een nieuw geldig voorstel waar beschikbaar. De bronkaart berekent het aantal gekoppelde, ruimere en ontbrekende koppelingen uit de huidige wegdelen, ook na een nieuwe storingsselectie zonder verkeersupload.

Validatie: npm test, 375 tests geslaagd, inclusief negen numerieke NDW-matchingtests. Een synthetische regressie controleert intensiteit en berekenbare kosten voor alle vijftig wegdelen, waaronder locaties buiten één kilometer, en behoud van onbekend/nul, handmatige invoer, rijrichting en A/N-scheiding. De browserregressie is uitgebreid voor de echte uploadketen, bronkaarten, herkomst en gewijzigde wegdeelselectie. Die kon in deze omgeving niet worden uitgevoerd: Chromium ontbreekt, de beschikbare oude executable is onvolledig en de downloadhost levert geen bruikbaar browserarchief. Er is dus geen geslaagde browservalidatie geclaimd. De exacte actieve werkruimte met de actuele NDW-snapshot is niet beschikbaar; volledige koppeling van de eigen wegdelen is niet vastgesteld. Operationele brongegevens zijn niet opgenomen in Git.

Dashboard 2.39 en DVM 123 delen deze verhoging. De bestaande cacheketens hebben nieuwe parameters. Na samenvoegen en Pages-publicatie de pagina herladen en de NDW-bronnen opnieuw laden.
