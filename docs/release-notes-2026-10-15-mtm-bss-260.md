# BiDash 2.60 / DVM 140, MTM-BSS-gebeurtenissen

De aangeleverde MTM-storinglijst bevat Registreer BSS en Hef op BSS, met een BSS_ID en tabgescheiden locatie en brontijd. De bestaande parser herkende uitsluitend verticale tabelregels. De gedeelde lezer ondersteunt nu beide indelingen, in Signaalgevers uit map én de losse signaalgeverimporter.

De vroegere maproute sloeg bestanden zonder herkende tabelregels over. De later toegevoegde strikte controle maakte die lacune zichtbaar met de melding geen herkenbare MTM-momentopname. Deze wijziging verwerkt de aangetroffen gebeurtenissen; de controle wordt niet uitgezet.

- Registreer BSS opent een incident; een passende Hef op BSS sluit expliciet.
- VC, BSS_ID, foutcode, locatie, eenheid en start onderscheiden incidenten. Gelijke locatie, minuut en code voegen verschillende BSS_ID's niet samen.
- Zonder herstelregel blijft een geregistreerde melding open. Ontbreken in een gebeurtenislog is nooit een herstelbewijs.
- Een herstelregel zonder bekende registratie blijft bewaard met onbekende start en duur. De bronminuten blijven als minuutprecisie herkenbaar; duur nul wordt behouden en niet als exact nul seconden gepresenteerd.
- Logs en tabellen worden chronologisch gecombineerd. Dezelfde ID en start verbinden een tabelmelding aan haar logepisode. Expliciet herstel vervangt afgeleid herstel van hetzelfde incident.
- Herhaald lezen, downloaden voor Signaalgevers totaal en totaalherimport behouden dezelfde incidenten en de bronbalans per VC en bestand.
- De standalone verwijdert alleen afgesloten gebeurtenissen buiten de bewaartermijn van één kalenderjaar. Dat gebeurt al tijdens verwerking om oude gesloten rijen niet onnodig op te bouwen. Open en onzekere meldingen blijven behouden. De BSS-route in Bronbeheer gebruikt dezelfde jaargrens; de bestaande tabelroute houdt haar historiegedrag.
- Een onvolledige of onbekende BSS-regel breekt vóór toepassing af met bestand en regelnummer. Andere VC's en eerder opgeslagen standen blijven behouden.

Een BSS-log is een reeks veranderingen. Zonder een volledige openstaande-storingenlijst als basis zijn reeds eerder open meldingen niet volledig te reconstrueren. De metadata onderscheidt een volledig herkende logstructuur van bewezen volledige actuele dekking. De bronbalans is geen bewijs dat alle bronbestanden beschikbaar waren. Open meldingen worden niet opnieuw bevestigd door gebeurtenissen over andere assets; de bestaande controle op verouderde bevestiging blijft gelden.

## Validatie

`tests/mtm-bss.test.js` toetst registratie/herstel, losse herstelregels, dezelfde minuut, VC-/ID-/eenheidsonderscheid, herstel over dagen, retentie, chronologische combinatie, afgeleid naar expliciet herstel en afwijzing van onvolledige bronregels. De browserregressie `tests/mtm-bss-browser.cjs` leest exact dezelfde bestanden via beide mapimporters, vergelijkt de incidenten en laadt de standalone-JSON via Signaalgevers totaal en totaalherimport. De bestaande importer- en mapbrowserregressies blijven gelden.

Het aangeleverde BSS-bestand is lokaal volledig geparseerd en tegen een afzonderlijke reconstructie van de open selectie gecontroleerd. Ook de echte standalonepagina, bewaren en herladen zijn ermee gecontroleerd. Operationele brondata, uitsneden en tellingen zijn niet gepubliceerd. De volledige meerjarige netwerkmap en alle leveringsvarianten zijn niet getest. Grote aantallen bewaarde incidenten blijven afhankelijk van beschikbaar geheugen en browserquota.
