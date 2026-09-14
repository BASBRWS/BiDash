# BiDash gebruikershulp

Deze uitleg hoort bij de Help-knop rechtsboven in BiDash. De gepubliceerde versie staat in `site/help.html`. Bij functionele wijzigingen moeten deze uitleg, de procesflow en waar nodig `SYSTEEMWERKING.md` samen met de code worden bijgewerkt.

## Aanbevolen laadvolgorde

1. Laad All Assets als DVM-stamregister.
2. Laad de EOL-referentie als die beschikbaar is.
3. Laad historische storingsbestanden voor historie en prognosekalibratie.
4. Laad U-routes en geplande werkzaamheden als operationele context.
5. Laad als laatste de actuele open storingslijst voor het live dashboard.
6. Laad BI-gegevens en planning voor formatie, contracten en uitvoerbaarheid.

Historische storingen en actuele open storingen zijn twee verschillende gegevensstromen. Historische meldingen mogen het live dashboard niet beïnvloeden.

## Nieuwe actuele storingslijst

De invoer Open storingen accepteert XLSX, XLS en CSV met herkenbare DVM-storingsregels. De gekozen lijst is een volledige nieuwe momentopname en vervangt de vorige actuele lijst, ook als de bestandsnaam anders is.

BiDash vergelijkt de vorige en nieuwe momentopname. Een event-id heeft voorrang als identiteit. Zonder event-id gebruikt BiDash een stabiele combinatie van asset, starttijd, weg, richting, hectometer, strook, foutcode, melding en gevolg.

| Situatie | Actie |
| --- | --- |
| Storing staat in oude en nieuwe lijst | Blijft actueel open |
| Storing staat alleen in nieuwe lijst | Wordt een nieuwe actuele open storing |
| MSI-storing stond in oude lijst en ontbreekt in nieuwe lijst | Wordt afgesloten op de peildatum van de nieuwe lijst en toegevoegd aan storingshistorie |
| Afgesloten storing staat al in historie | Niet opnieuw toevoegen |

Automatisch afgesloten MSI-storingen gaan alleen naar de historische stroom. De actuele dashboards gebruiken alleen de nieuwe open momentopname.

## Hoofdproces

Lokale bronbestanden gaan naar de eigen rekenmodule. DVM berekent buitenassets, storingsimpact, dienstverlening en verkeerskosten. BI beheert formatie, capaciteit, contracten en interne bedienketens. Planning beheert activiteiten, afhankelijkheden en tijdlijnen. De BiDash-schil combineert samenvattingen en expliciete dienst-functiekoppelingen.

De bronbestanden blijven lokaal in de browser. De werkruimte wordt in IndexedDB opgeslagen. Voor overdracht of back-up gebruik je een integrale export.
