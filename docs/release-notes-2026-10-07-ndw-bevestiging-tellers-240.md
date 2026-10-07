# Business Intelligence Dashboard WVM 2.40, DVM 124

Datum: 7 oktober 2026

Een wegdeel met een NDW-intensiteit telde al mee voordat de gebruiker de meetlocatie bevestigde. Daardoor bleef het aantal berekenbare wegdelen na bevestigen en opslaan gelijk. De app toont nu afzonderlijk hoeveel NDW-locaties bevestigd zijn en hoeveel nog moeten worden gecontroleerd. Bevestigen verhoogt bevestigd en verlaagt nog te controleren, zonder intensiteiten of kosten dubbel te tellen.

Deze tellers staan in het NDW-overzicht, op de bronkaart en bij Verkeerskosten. Verkeerskosten toont ook de locatiestatus per wegdeel. De zichtbare overzichten worden direct bijgewerkt; NDW-wijzigingen melden zich expliciet aan de bestaande lokale opslagqueue. Het aantal ruimere koppelingen blijft het afstandskenmerk tellen, met daarnaast hoeveel hiervan nog controle nodig hebben. Een ander meetpunt of gewijzigde verkeersbron maakt een eerdere bevestiging ongeldig. Uitgezet NDW-gebruik en ontbrekende metingen tellen niet als te controleren koppeling.

De bestaande kostenformules, handmatige invoer, weg- en richtingsselectie en betekenis van onbekend/nul blijven gelijk. Bevestigen levert geen ontbrekende intensiteit op. Deze wijziging lost de bestaande beperking bij uitgesteld herstel van grote werkruimten niet op: daar wordt de opgeslagen NDW-verkeerscontext nog gewist. Er wordt daarom geen volledig herstel van NDW na refresh geclaimd. Een DVM-totaalexport blijft nodig als reservekopie.

Validatie: `npm test`, 381 tests geslaagd. Zes nieuwe synthetische tests voeren de echte DVM-enginefuncties uit voor bevestigen, terugdraaien, opslaan, opnieuw kiezen, uitzetten, ontbrekende metingen, export van kostenparameters, gewijzigde bron, bronkaart en de adapter/schil. De echte schilberichtenhandler ververst de teller voordat de opslag-debounce afloopt. De berekende kosten blijven gelijk bij alleen bevestigen. JavaScript-syntax en `git diff --check` zijn gecontroleerd. De browserregressie is uitgebreid met het echte bevestigingsvinkje en bronkaarttellers; `npm run test:ndw` kon niet starten omdat Chromium in deze omgeving ontbreekt. De actieve werkruimte van de gebruiker is niet beschikbaar voor een praktijktest. Operationele brongegevens zijn niet opgenomen in Git.

Dashboard 2.40 en DVM 124 delen deze verhoging. De bestaande cacheketens hebben nieuwe parameters. Na samenvoegen en geslaagde Pages-publicatie de pagina herladen en zo nodig de NDW-bronnen opnieuw laden.
