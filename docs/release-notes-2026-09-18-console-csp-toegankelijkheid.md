# Console- en inspectieproblemen opgelost

Datum: 18 september 2026

Versie: BiDash 2.16, DVM 102

## Probleem

De hoofdschil probeerde dynamisch inline stijlen te zetten voor de memo bij open
storingen en de trendgrafiek van de kwaliteitsaudit. Het beveiligingsbeleid van de
schil blokkeerde die stijlen terecht. Edge meldde daarnaast formuliervelden zonder
`id` of `name` en focusbare informatie-elementen binnen een `summary`.

## Gewijzigd

- De dynamische onderdelen in de hoofdschil gebruiken alleen klassen uit
  `site/style.css`; de strikte CSP blijft ongewijzigd.
- De trendgrafiek gebruikt CSP-veilige hoogteklassen in stappen van vijf procent.
- Queryvelden en dynamische DVM-regelvelden krijgen stabiele veldnamen en de
  queryvelden krijgen toegankelijke omschrijvingen.
- Informatietips binnen uitklapkoppen zijn niet meer zelfstandig focusbaar. Bij
  toetsenbordfocus op de uitklapkop blijft de toelichting beschikbaar.

## Buiten deze wijziging

De browserwaarschuwing over `allow-scripts` samen met `allow-same-origin` hoort bij
de bestaande functionele iframe-scheiding. De modules en de schil draaien bewust
op dezelfde origin en gebruiken elkaars `window.HUB`. De Permissions-Policy-regels
over advertentiefuncties komen uit de browser- of hostingheaders. Beide soorten
waarschuwingen zijn geen fout in de berekening en zijn niet versoepeld of omzeild.

## Controle

`tests/browser-inspection.test.js` bewaakt de CSP-veilige opbouw, veldnamen en
summary-structuur. De bestaande versie-, query- en open-storingentests blijven van
toepassing.
