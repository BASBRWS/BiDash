# DVM stackveiligheid, 6 oktober 2026

## Opgelost

Na de eerdere DRIP-fixes kon bij verder oplopende brondata opnieuw `Maximum call stack size exceeded` ontstaan. De oorzaak zat niet alleen in de DRIP-tijdreeks zelf. In meerdere DVM-schermen, grafieken, contextberekeningen en koppelstappen stonden nog spread-aanroepen zoals `Math.min(...groteArray)`, `Math.max(...groteArray)` en `doel.push(...groteArray)`.

Die constructies zijn vervangen door iteratieve helpers die geen groot aantal functieargumenten aanmaken.

## Bereik

De wijziging geldt onder meer voor:

- live peildatums;
- historische en actuele grafiekberekeningen;
- kosten- en Monte Carlo-uitkomsten;
- route- en NWB-geometrie;
- contextassets en U-routes;
- DRIP- en dienstverleningsweergaven;
- grote kandidaat- en puntenlijsten.

## Test

Een regressietest controleert dat in `dvm-2.js` en `dvm-3.js` geen call-stackgevoelige `Math.min/max(...)` of `push(...)` meer staat. De helpers worden daarnaast getest met 300.000 waarden.
