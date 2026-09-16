# Release notes DRIP-foutregels en leidende toestand

Datum: 16 september 2026

Versie: BiDash 2.13, DVM 83

## Opgelost

- DRIP-storingen bleven staan met `Passende foutregel ontbreekt` en werden niet
  doorgerekend, omdat `RULES.foutcodes` geen enkele regel met assetType `DRIP` had.
  `foutregel()` gaf dan altijd `null` en `doorrekenen()` liet de melding vallen. Er
  zijn nu DRIP-foutregels, gematcht op de alarmtekst.
- De functionele toestand van het paneel (`technische_toestand` GESTOPT/IN-BEDRIJF,
  `classificatie` LANGDURIG/INTERMITTEREND) is leidend over de alarmtekst, zodat een
  gestopt paneel volledig telt en een werkend paneel met alleen een gemeld alarm laag
  blijft.

## Waarom dit telde

De vorige release notes (`brondekking-open-meldingen`) noemden dit al als open punt:
met een locatie haalden de DRIP-meldingen de eerste horde, maar `doorrekenen()`
vraagt daarna nog een passende foutregel. Die bestond niet voor DRIP, dus alle DRIP
open storingen bleven als niet-doorgerekend staan. De DRIP-dienstverlening kwam
daardoor te gunstig uit: open storingen die niemand meerekende.

## Hoe het nu werkt

Twee lagen bepalen samen de impact van een DRIP-melding.

**Alarmtekst.** In `dvm-1.js` staan DRIP-foutregels die op dezelfde manier matchen
als bij MSI. De percentages zijn availPct/perfPct:

| Alarm | Ernst | availPct | perfPct |
|---|---|---|---|
| contact met display verloren | kritiek | 100 | 100 |
| kritische (LED) | hoog | 80 | 95 |
| temperatuur boven het maximum | middel | 25 | 40 |
| led status fout | laag | 10 | 30 |
| gereset | laag | 5 | 10 |
| deuren staan (open) | geen | 0 | 0 |

De regels gebruiken max-wint: binnen een samengestelde melding bepaalt de zwaarste
passende regel de score. Een open kastdeur is een bekende storing zonder
dienstimpact (0/0), niet een onbekende melding.

**Functionele toestand (leidend).** In `dvm-2.js` weegt `foutregel()` voor DRIP eerst
de toestand uit de bron via `dripToestandImpact(m)`:

- GESTOPT (en niet in bedrijf): volledige uitval (100/100), code `DBD-UIT`.
- GESTOPT én weer in bedrijf: ondergrens — langdurig 60/70, intermitterend 25/40,
  gecombineerd met de alarmscore via max-wint (`DBD-TOESTAND`).
- alleen in bedrijf met een gemeld alarm: de alarmwaarde blijft leidend en laag.
- geen toestand: terugval op de classificatie (langdurig 60/70, intermitterend
  25/40).
- geen toestand, geen classificatie en geen passende alarmregel: bewust onbekend
  (`null`), telt als open melding zonder verzonnen impact.

De toestandsvelden reizen mee: `normRij()` in `dvm-2.js` en `dripOpenRow()` in
`drip-open-from-history.js` nemen `classificatie` en `technische_toestand` over uit
de bron en de historie, zodat de afgeleide open DRIP-meldingen hun toestand behouden.

## Model, geen vastgesteld getal

De percentages zijn een instelbaar model om de DRIP-dienstverlening bespreekbaar en
toetsbaar te maken; ze zijn geen door RWS vastgesteld getal. Validatie met RWS kan de
waarden bijstellen zonder de structuur te wijzigen. Een storing die niet aantoonbaar
te duiden is, blijft daarom liever zichtbaar-maar-niet-doorgerekend dan dat er een
impact wordt verzonnen.

## Ongewijzigd

- `doorrekenen()` zelf, inclusief de voorwaarde dat een melding zonder passende
  foutregel niet wordt meegerekend.
- De impactregels, wegingen en rekenketen voor MSI, camera en de overige
  assettypen; de test bevestigt dat MSI en CAM ongewijzigd blijven.
- De scheiding tussen historische en actuele stromen en de afleiding van aantoonbaar
  open DRIP-incidenten.

## Controle

- `tests/drip-foutregel.test.js` toegevoegd, 12 tests. De test voert de verzonden
  implementatie uit: de foutcodes-array uit `dvm-1.js` en `lc()`,
  `dripToestandImpact()`, `dripRegel()` en `foutregel()` letterlijk uit `dvm-2.js`.
  Tegen de oude code (zonder DRIP-regels en zonder de toestandstak) faalt de test.
- Versies bijgewerkt: DVM 82 → 83 in `dvm-source-manager.js`, met de bijbehorende
  assertions in `tests/drip-special-lists.test.js`, `tests/dvm-restore-policy.test.js`
  en `tests/versiebalk.test.js`. De schilversie blijft 2.13.
- Volledige Node-suite geslaagd. Browsersuites `browser.cjs`, `planning-large.cjs` en
  `planning-formation.cjs` geslaagd. JavaScript-syntaxcontrole geslaagd.

## Niet getest

- De doorrekening met de operationele DRIP-export waarin dit is opgemerkt. De controle
  gebruikt synthetische regels; er is geen operationele bron gebruikt of toegevoegd.
- De exacte hoogte van de percentages tegen een RWS-norm. Ze zijn een model dat nog
  getoetst moet worden.
