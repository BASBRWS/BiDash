# Release notes, open DRIP-storingen uit historische werkmappen

Datum: 15 september 2026

## Aanleiding

De aparte bron `Open storingen` bevat de actuele signaalgeverstoringen. DRIP-storingshistorie wordt daarnaast uit XLS/XLSX-werkmappen met meerdere tabbladen geladen. In die DRIP-werkboeken kunnen incidenten expliciet als nog open aan het einde van het databereik zijn gemarkeerd. Tot nu toe werden die alleen als historische DRIP-invoer voor de prognose gebruikt en niet in het actuele scherm Open storingen getoond.

## Nieuw gedrag

Na het laden of opnieuw opbouwen van DRIP-storingshistorie maakt BiDash automatisch een afgeleide actuele DRIP-bron van incidenten die aantoonbaar nog open zijn.

Een DRIP-incident geldt als open wanneer:

- de genormaliseerde historie `censored = true` bevat, waaronder de bronvelden `open_aan_einde_databereik` / `open_at_end`;
- de technische toestand expliciet `open`, `openstaand`, `actief`, `onopgelost` of `niet hersteld` vermeldt;
- er geen eindtijd én geen afgeronde storingsduur beschikbaar is.

Gesloten historische incidenten blijven uitsluitend historie en worden niet naar het actuele scherm gekopieerd.

## Scheiding historie en actueel

De oorspronkelijke DRIP-historie blijft ongewijzigd beschikbaar voor DRIP Monte Carlo en historische kalibratie. De afgeleide open DRIP-regels worden daarnaast als virtuele live bron toegevoegd zodat signaalgeverstoringen en actuele DRIP-storingen gezamenlijk in het actuele bronbeeld beschikbaar zijn.

De publieke BiDash-pagina `Open storingen` voegt deze DRIP-incidenten ook toe. Als het incident aan All Assets is gekoppeld, gebruikt de weergave dezelfde asset-identiteit, weg, richting, hectometer en verkeerscentrale.

## Geen stille impactaanname

Voor deze wijziging wordt geen nieuwe generieke DRIP-impactfactor verzonnen. Een afgeleide open DRIP-storing wordt daarom wel als open storing getoond, maar krijgt in de publieke storingenlijst nog geen numerieke dienstimpact wanneer geen expliciete DRIP-live-impactregel bestaat. Dit voorkomt dat zichtbaarheid van een open incident ongemerkt een nieuwe rekenregel introduceert.

## Versie

BiDash v2.8, DVM v77.
