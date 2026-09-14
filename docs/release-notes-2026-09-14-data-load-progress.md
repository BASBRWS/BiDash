# Release notes — voortgang bij data laden

Datum: 14 september 2026

## Waarom

Bij het laden van grotere JSON-, XML- en DVM-bronbestanden kon de browser tijdelijk zwaar belast zijn. De gebruiker zag dan onvoldoende of niets over welke stap bezig was, waardoor een zware parse op een vastloper leek.

## Nieuw

- De hoofdapp toont tijdens gegevensimport één voortgangsbalk onder de statusregel.
- Bij bestanden uit **Data & export** wordt de leesvoortgang op basis van werkelijk gelezen bytes weergegeven.
- Na het lezen toont de balk expliciet dat de inhoud wordt gecontroleerd/verwerkt.
- Voor specialistische DVM-bronnen worden de bestaande fasen en percentages uit `zetImportVoortgang()` doorgestuurd naar de hoofdapp.
- Tijdens een fase zonder betrouwbaar percentage gebruikt BiDash een onbepaalde geanimeerde balk in plaats van een verzonnen percentage.
- Voor een zware parse krijgt de browser eerst een paint-moment zodat de gebruiker de voortgangsstatus ziet voordat de hoofdthread mogelijk kort bezet raakt.
- Bij geslaagde afronding wordt 100% getoond; bij een fout blijft de laatste fase met een waarschuwingsmarkering zichtbaar.

## Techniek

`site/core/load-progress.js` verzorgt de algemene voortgangsweergave. Tijdens een actieve hub-import gebruikt het een `FileReader`-pad voor `File.text()` zodat bytevoortgang beschikbaar is zonder het bestand dubbel te lezen.

`site/core/import-progress-bridge.js` koppelt de bestaande DVM-importstatus aan de hoofdapp via hetzelfde-origin `postMessage` met type `hub:import-progress`.

De DVM-importlogica, snapshots, filters en rekenregels zijn niet gewijzigd. De voortgangslaag is uitsluitend observatie en gebruikersfeedback.

## Beperking

JSON- en XML-parsing zijn in de browser nog steeds deels synchroon. Tijdens zo'n zware parse kan het percentage kort stilstaan. De nieuwe balk maakt die fase zichtbaar, maar maakt een zware parser niet automatisch parallel.

## Test

`tests/data-load-progress.test.js` controleert byteaggregatie, begrenzing van percentages, het FileReader-pad, het paint-moment vóór zware verwerking en de DVM-voortgangsbrug.
