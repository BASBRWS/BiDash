# BiDash 2.54 / DVM 134, assetkoppeling en HMP met streepjes

Een opgeslagen locatiealias kon meldingen van verschillende locaties of rijstroken naar één signaalgever verplaatsen. De parser las bovendien bijvoorbeeld `A4-Li-7,49` zonder richting en hectometer.

## Gewijzigd

- Register en storingen herkennen streepjes tussen weg, zijde, HM/HMP en hectometer. A/N-prefix, nul-HMP, bronletter en oorspronkelijke bronrij blijven behouden.
- MSI en Detectielus lezen een uniek rijstrook-/eenheidnummer ook uit melding en gevolg. Een expliciet nummer blijft leidend; meerdere nummers worden niet tot het eerste gereduceerd.
- Nieuwe koppelidentiteiten gebruiken type, VC, weg, oorspronkelijke zijde, HMP en eenheid. Algemene foutcodes zijn geen assetidentiteit. Expliciete log-ID’s blijven behouden.
- Bestaande aliassen blijven opgeslagen maar volgen dezelfde locatie-, VC-, zijde- en eenheidcontrole. Een onjuiste alias wordt genegeerd. Zonder passende kandidaat blijft de melding zichtbaar op haar bronlocatie; er wordt geen onjuist asset gekozen.
- Richting- en VC-filters vallen niet terug op tegengestelde of andere gebieden. Een alias zonder rijstrook koppelt niet alle eenheden op dezelfde plek aan één asset. Bestaande individuele locatiecorrecties kunnen hun oorspronkelijke bronlocatie blijven herkennen.
- De importmatchcache en ontdubbeling behouden VC, oorspronkelijke zijde, hectoletter en eenheid. Verschillende foutcodes op één asset blijven aparte meldingen; exacte dubbelen tellen eenmaal.
- De bron-, historie-, impact- en exportstromen uit 2.53 / DVM 133 blijven behouden. Er zijn geen nieuwe dienstformules of exportsecties toegevoegd.

## Controle

- `npm test`, 468 tests geslaagd, inclusief twaalf nieuwe synthetische regressies voor parser, matrix, aliassen, eenheden, VC, zijbanen, Detectielus, ontdubbeling en parameterexport/herstel.
- De bestaande echte-enginecontrole voor mapimport, live doorrekening, totaalexport en herimport blijft onderdeel van de suite.
- Aanvullende lokale controle met de aangeleverde DVM-totaal-JSON. Geen brongegevens, operationele uitsneden of afgeleide tellingen in Git opgenomen.
- `tests/assetlocaties-browser.cjs` geslaagd met Chromium, inclusief streepjeslocaties, een verkeerde oude rijstrookalias, exacte doublures, echte adapter en export/herstel.
- `tests/netwerkschakel-issues-browser.cjs` geslaagd, inclusief probleemgroepen, assetcorrectie, behoud van matrixinvoer, grenscorrectie en export/herstel.
- `tests/signaalgever-map-sync-browser.cjs` geslaagd, inclusief behoud van andere VC's, historie, herhaald inlezen, download/herimport, lege snapshot en behoud na een leesfout.
- Publicatie volgt na merge en geslaagde Pages-run; de PR is geen bewijs dat deze versie al live staat.

## Gebruik

Controleer na publicatie BiDash 2.54 en DVM 134. Laad je bestaande totaalexport opnieuw om de opgeslagen bronregels met de nieuwe koppeling door te rekenen. Controleer meldingen zonder koppeling en maak daarna een nieuwe totaalexport.
