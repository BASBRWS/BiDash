# Release notes DRIP-bronclassificatie

Datum: 15 september 2026

Versie: BiDash 2.10, DVM 79

## Opgelost

- Een gecensureerd DRIP-incident geldt niet meer zonder verdere controle als huidige open storing.
- Alleen een expliciet open incident, een incident zonder eindtijd en afgeronde duur, of een gecensureerd incident aan het actuele einde van dezelfde bron wordt afgeleid naar Open storingen.
- De afgeleide DRIP-selectie wordt opnieuw geïnspecteerd en via de normale DVM-keten doorgerekend naar assetimpact, subprocessen en dienstverlening.
- De landelijke brondekking toont bij DRIP de gebruikte historische bron en dat de actuele selectie daaruit is afgeleid. De gebruiker moet de volledigheid nog steeds zelf bevestigen.
- Een gecombineerd classificatiebestand met kolommen RIA4 en Windwaarschuwing wordt per gemarkeerde regel gesplitst.
- Een DRIP-code alleen is niet meer genoeg wanneer de bron en het asset beide locatiegegevens bevatten. VC, weg, richting en hectometer voorkomen dat dezelfde code in een ander gebied wordt meegeclassificeerd.
- Classificaties uit All Assets worden behouden wanneer de bron al RIA4- of windvelden bevat.

## Ongewijzigd

- RIA4 en Windwaarschuwing wijzigen de technische faalkans niet. Het blijven kenmerken voor selectie, presentatie en dienstduiding.
- Een DRIP kan beide kenmerken hebben.
- Operationele bronbestanden blijven lokaal in de browser en zijn niet aan Git toegevoegd.

## Controle

- Alle Node-tests zijn uitgevoerd.
- Regressietests dekken oude gecensureerde incidenten, actuele bronranden, gecombineerde RIA4- en windmarkeringen en dubbele DRIP-codes in verschillende gebieden.
- De aangeleverde DVM-totaalexport is alleen lokaal gebruikt om de actuele selectie te controleren.
