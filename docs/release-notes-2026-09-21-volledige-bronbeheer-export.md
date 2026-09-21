# BiDash 2.21 en DVM 104, volledige Bronbeheerexport

Datum: 21 september 2026

## Opgelost

- De DVM-totaalexport bewaart nu de bronidentiteit van gecombineerde signaalgeverdata.
- Het oorspronkelijke bronbestand, de peildatum en de interne totaalbronmarkering gaan mee.
- Een nieuw `bronbeheer`-manifest bewaart de samenvattingen en tellingen van Signaalgevers totaal en DRIP totaal.
- Na herimport verschijnen gecombineerde bronnen weer onder hun eigen kaart in Bronbeheer, in plaats van als losse open en historische storingsbronnen.
- Oude totaalexports zonder manifest blijven importeerbaar. De vaste bronsleutels worden daarbij alsnog als gecombineerde signaalgeverbron herkend.
- De automatische lokale opslag blijft de zware signaalgeverrijen overslaan. Dit voorkomt dat de pagina bij automatisch opslaan vastloopt. De handmatige totaalexport bevat de volledige bron wel.

## Controle

- Tests controleren dat bronmarkeringen en bestandsherkomst in de export blijven staan.
- Tests controleren dat het Bronbeheermanifest wordt gemaakt en bij import wordt hersteld.
