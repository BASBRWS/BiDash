# Release notes snellere DRIP-map met zichtbare voortgang

Datum: 17 september 2026

Versie: BiDash 2.14, DVM 99

## Probleem

De nieuwe bron **DRIP uit map (CDMS)** werkte, maar leek bij een grote map stil te
staan. Tijdens het zoeken werd een percentage afgeleid van alleen het aantal reeds
bezochte mappen, terwijl het totaal nog onbekend was. Daarna werden alle gevonden
logbestanden één voor één gelezen. Op een grote netwerkshare gaf dat weinig houvast
en onnodig veel wachttijd.

## Gewijzigd

- Tijdens het doorzoeken van de map toont BiDash nu een bewegende, onbepaalde balk.
  Daarbij staan het aantal bekeken mappen, gevonden bestanden en de verstreken tijd.
  Er wordt geen schijnpercentage meer getoond zolang het totaal onbekend is.
- Zodra de bestandslijst bekend is, toont de voortgang het aantal gelezen bestanden,
  het totaal, het aantal herkende DRIP-gebeurtenissen, eventuele leesfouten, de
  verstreken tijd en een schatting van de resterende tijd.
- CDMS-mappen per boomniveau en de logbestanden worden met maximaal zes gelijktijdige
  leesacties verwerkt. Dat houdt de belasting begrensd, maar voorkomt de volledig
  seriële wachtrij.
- De eindmelding benoemt hoeveel geselecteerde bestanden niet leesbaar waren.

## Ongewijzigd

De padselectie, DRIP-logparser, episodevorming, classificatie, koppeling aan All
Assets en doorrekening zijn niet gewijzigd. De browser verwerkt de brondata nog
steeds uitsluitend lokaal.

## Controle

`tests/drip-totaal.test.js` controleert aanvullend dat de workerpool de ingestelde
paralleliteit niet overschrijdt, alle taken afrondt en de eindstand van de
voortgang meldt. De bestaande parser-, mapfilter-, incident- en koppelingstests
blijven ongewijzigd van kracht.

## Beperking

De winst op een echte X:-netwerkshare hangt af van browser, netwerk en bestandsgrootte.
De gewone mapinvoer kan pas voortgang tonen nadat de browser zelf de gekozen map
heeft opgesomd; kies daarom in Edge of Chrome bij voorkeur de moderne mapkiezer en
beperk regio en periode wanneer mogelijk.
