# Release notes DRIP meldingen en dienstberekening

BiDash 2.11, DVM 80. Datum 16 september 2026.

## Probleem en herstel

Open DRIP-meldingen konden zichtbaar zijn in de storingenlijst en ontbreken in de
landelijke telling. Meldingen zonder foutregel worden nu behouden, geteld en als
niet doorgerekend getoond. Het betrokken assettype levert geen exact percentage
zolang de impact van die meldingen onbekend is. Er worden geen standaardimpact of
nieuwe domeinregels verzonnen.

De afzonderlijke toevoeging van historische schermregels is verwijderd. De adapter
publiceert het doorgerekende en het niet doorgerekende deel van dezelfde verwerking.
Starttijd, bronduur en de onzekerheidsmarkering blijven behouden. Onbekende impact
wordt niet meer als nul procent getoond. Onbekende duur wordt geen minuut.

Conflicterende DRIP-aliases en codekandidaten op een andere weg, richting of
hectometer worden geweigerd. De bronlocatie blijft zichtbaar. Dynac-identifiers in
classificatiebronnen worden ook met underscores en koppelteken gelezen. Oudere
classificatierecords worden vanuit hun oorspronkelijke identifier hersteld.

## Controle

Synthetische regressietests toetsen ontbrekende foutregels, landelijke telling,
adapter en bronduur, locatieconflicten, ontdubbeling en classificatieherstel.
De DRIP-keten is ook lokaal uitgevoerd met een gebruikersbestand. Dat bestand en
de operationele uitkomsten zijn niet opgenomen in de repository.

De browsercontrole kon lokaal niet worden uitgevoerd. De beschikbare Chromium
crashte bij starten en het downloaden van een vervangende versie liep vast.
De VM-ketentests verifiëren de rekenfuncties, niet de volledige DOM- of importflow.

## Gebruik en beperkingen

Herlaad de applicatie en importeer de volledige werkruimte-export opnieuw zodat
de afgeleide meldingen opnieuw worden opgebouwd. Controleer in het rekenverslag de
niet doorgerekende meldingen en corrigeer ongeldige koppelingen in bronbeheer.
Een passende DRIP-foutregel vereist inhoudelijke beoordeling. Deze release bepaalt
niet hoeveel dienstverlies een reset of langdurige onzekere episode veroorzaakt.
De overige detailgrafieken blijven gebaseerd op het doorgerekende deel; zij zijn
geen volledige beoordeling zolang er meldingen niet doorgerekend zijn.
