# BiDash 2.53 / DVM 133, signaalgevers per VC bijwerken

Signaalgevers uit map vult de geladen stand nu aan per daadwerkelijk gelezen VC. De DRIP-locatiekoppeling en kwaliteitsaudit uit 2.52 / DVM 132 zijn meegenomen.

- De app bewaart de laatste complete momentopname inclusief tijd per VC, ook bij nul open alarmen.
- Oudere historie, andere VC’s, camera en DRIP blijven behouden. Een optionele MTM- of DVM-totaalbasis wordt met de huidige stand gecombineerd.
- Herhaald en overlappend inlezen werkt bestaande incidenten bij. VC, locatie, start, type, rijstrook, foutcode en lamp-/detectornummer bepalen de identiteit, geen opnieuw gegenereerd incidentnummer.
- Verdwenen MSI- en LUS-meldingen gaan eenmaal naar de historie, ook als ze kortdurig waren. Laatste bewezen aanwezigheid en eventuele afsluitbovengrens blijven apart. Een datagat krijgt geen verzonnen herstelmoment.
- Oudere mapsneden zetten de actuele lijst niet terug. Onleesbare, onvolledige en tegenstrijdige bestanden breken de update vóór bronmutatie af.
- De download bevat een selectieve DVM-totaalexport, inclusief bronidentiteit en exacte VC-watermerken. Deze kan opnieuw als mapbasis of via de bestaande JSON-imports worden geladen.
- Oude light-historie met uitsluitend locatie en start blijft in haar oorspronkelijke aantallen behouden. Zonder VC, rijstrook en foutcode kan overlap met rijkere nieuwe alarmen niet betrouwbaar worden vastgesteld.

Validatie. De synthetische regressies voeren de verzonden bundelaar, import, live doorrekening, algemene snapshotpatch en totaalexport/herimport uit. De aangeleverde oudere JSON is lokaal op behoud van bronrijen gecontroleerd en is niet gepubliceerd. Een aanvullende browserregressie is toegevoegd; in deze omgeving ontbreekt Chromium en de browserdownload wordt door de netwerkgrens geblokkeerd. Visuele browsercontrole is daarom nog niet uitgevoerd. Zware maprijen blijven buiten de compacte automatische opslag; een handmatige export is nodig voor volledig herstel na herladen.
