# Release notes historie-doorrekening uitstellen tot de prognose

Datum: 17 september 2026

Versie: BiDash 2.14, DVM 97

## Gewijzigd

- De **historie-doorrekening** (de zware `HISTORIE_STATE`-berekening die de Monte
  Carlo kalibreert) wordt **niet meer bij elke bronwijziging** gebouwd, maar pas
  wanneer het **prognosetabblad** wordt geopend of een **simulatie** wordt gestart.
  Bij een grote signaalgeverbron (tienduizenden rijen) blokkeerde die doorrekening
  het laden telkens; door haar uit te stellen blijft het laden en het wisselen
  tussen de overige tabbladen vlot.
- `probeerAnalyseActiveren()` zet nu alleen de vlag `HISTORIE_UITGESTELD` wanneer er
  bruikbare historie klaarstaat (`logsAlg` en geladen storingsbronnen), in plaats van
  de doorrekening meteen uit te voeren. `zorgHistorieState()` bouwt de historie
  vervolgens exact zoals voorheen — dezelfde `doorrekenen()`- en
  `bouwLiveMcHistorie()`-stappen — zodra ze echt nodig is.
- Het prognosetabblad toont, zolang de historie nog niet is doorgerekend, dat de
  MSI-historie klaarstaat en bij het starten van een simulatie wordt doorgerekend.
  Zodra het tabblad wordt geopend, bouwt BiDash de historie af en ververst het de
  tab met het volledige historiebeeld.

## Waarom

De doorrekening zelf verandert niet; alleen het **moment** waarop ze gebeurt. De
uitkomst van de prognose is identiek aan die van vóór deze wijziging — de eerste
simulatie (of het openen van de prognosetab) rekent de historie alsnog volledig
door. Het laden van bronnen en het werken op de overzicht-, storingen- en
rapporttabbladen hoeft niet langer op die berekening te wachten.

## Ongewijzigd

- De live doorrekening (`STATE`) en de **Open storingen** blijven ongewijzigd; die
  worden nog steeds direct bij een bronwijziging berekend.
- De Monte Carlo-uitkomsten, `mcHistorieBron()`, `prognoseBasisState()` en de
  koppeling aan All Assets blijven functioneel identiek.
- De of/of-vervanging van *Signaalgevers totaal* en de maplezer blijven gelijk.

## Controle

- DVM-versie 96 → 97, met de assertions in `tests/dvm-restore-policy.test.js`,
  `tests/drip-special-lists.test.js` en `tests/versiebalk.test.js`. Schilversie blijft
  2.14.
- Node-suite via `npm test` uitgevoerd; JavaScript-syntaxcontrole van `dvm-2.js` en
  `dvm-3.js` geslaagd.

## Niet getest

- Het openen van het prognosetabblad met een echte, grote X:-map in de browser. De
  controle gebruikt de bestaande synthetische testsuites; er is geen operationele
  brondata gebruikt of toegevoegd.
