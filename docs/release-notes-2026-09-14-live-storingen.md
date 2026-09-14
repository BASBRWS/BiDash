# Release notes 2026-09-14, actuele storingslijst

## Gewijzigd

- De knop Open storingen accepteert een herkenbare XLSX, XLS of CSV als expliciete actuele momentopname. De import blokkeert niet meer omdat de bestandsnaam of peildatumstructuur afwijkt van de oude kruislampfoutenlijst.
- Een nieuw geladen open-storingenbestand vervangt de vorige actuele momentopname volledig. Oude en nieuwe bestanden worden niet meer naast elkaar opgeteld.
- Bij vervanging worden storingen uit de vorige momentopname vergeleken met de nieuwe lijst op event-id of een stabiele combinatie van asset, starttijd, locatie, strook en fout.
- Verdwenen MSI-storingen worden automatisch afgesloten op de peildatum van de nieuwe momentopname en toegevoegd aan de storingshistorie.
- Automatisch afgesloten storingen worden ontdubbeld tegen de bestaande storingshistorie.
- De actuele dashboards blijven alleen de nieuwe open momentopname gebruiken. De automatisch afgesloten meldingen gaan alleen naar de historische stroom voor historie en prognosekalibratie.

## Controle

Er zijn regressietests toegevoegd voor stabiele storingidentiteit, dubbelen, het bepalen van verdwenen storingen en het afsluiten van historische meldingen.
