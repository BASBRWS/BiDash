# DRIP-locatiekoppeling en kwaliteitsaudit — 2.52 / DVM 132

## Gedrag

- Een DRIP-code (DBD/BD/D…) is geen unieke, hoofdletterongevoelige identiteit: dezelfde code komt in meerdere verkeerscentralegebieden voor. Een opgeslagen alias op enkel de code wordt daarom niet meer blind gevolgd. Past de alias qua weg, richting en hectometer bij de bronlocatie, dan wordt hij gebruikt; wijkt hij af, dan negeert BiDash hem en koppelt het de melding primair op locatie.
- Een conflicterende alias blokkeert niet langer onnodig. Als de bronlocatie wél een passend DRIP-asset heeft, wordt daarop gekoppeld in plaats van een locatieconflict te melden. Pas wanneer ook locatiekoppeling niet lukt, blijft het een veilig geblokkeerd locatieconflict; de bronlocatie wordt daarbij niet door de alias vervangen en de melding blijft zichtbaar en niet-doorgerekend.
- Eén nog openstaande DRIP-storing die door meerdere bronnen wordt gemeld (bijvoorbeeld een DRIP-totaalbestand en een CDMS-mapscan) telt nu één keer. Twee bronnen kunnen dezelfde open storing met een andere waargenomen starttijd melden; BiDash ontdubbelt op code, gebied en locatie en behoudt de vroegste start. Een hergebruikte code in een ander gebied of op een andere plek blijft een eigen storing.

## Kwaliteitsaudit

- De storingsketen wordt niet meer als dekkingspercentage boven 100% gerapporteerd. De keten voegt afgeleide open meldingen toe, dus de uitvoer kan groter zijn dan de ruwe bronregels. Een percentage verschijnt alleen zolang de meldingen een deelverzameling van de bronregels zijn; daarboven worden de aantallen zonder misleidend percentage getoond.
- De uitsplitsing van de bronregels verzoent de niet-doorgerekende aantallen. "Zichtbaar maar niet doorgerekend" is het totaal; "zonder passende foutregel" en "zonder locatie" zijn deelredenen daarvan (getoond als "waarvan"), en het resterende deel — bijvoorbeeld een locatieconflict met wél een foutregel — wordt expliciet benoemd, zodat de getallen precies optellen.

## Validatie en grenzen

De volledige bestaande testsuite slaagt, met nieuwe tests voor locatie-eerst DRIP-koppeling bij een conflicterende alias, cross-bron ontdubbeling van open DRIP-storingen, de ketenrapportage zonder percentage boven 100% en de verzoende uitsplitsing van niet-doorgerekende bronregels. De documentatiepagina en het hulpdocument-bundelscript (`site/help-docs.js`) vallen buiten deze wijziging.

De koppeling gebruikt nabije registerassets op dezelfde weg, richting en hectometer binnen de bestaande HM-tolerantie; zonder een passend asset op de bronlocatie blijft handmatige controle nodig en blijft het conflict zichtbaar. De audit bewijst geen verkeerskundige of statistische juistheid.
