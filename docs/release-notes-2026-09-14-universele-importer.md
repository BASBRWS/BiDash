# Release notes, universele importer

Datum: 14 september 2026

## Doel

De centrale BiDash-importer herkent voortaan bronnen op inhoud en kolomcombinaties in plaats van alleen op één exact bestandsformaat of vaste bestandsnaam.

Bestaande DVM-totaalexports, waaronder oude versie-27 exports, blijven rechtstreeks bruikbaar. De herkenningslaag verandert deze bestanden niet voordat ze naar de bestaande DVM-engine gaan.

## Ondersteunde bestandssoorten

- DVM-dienstimpact-totaal JSON, oude en huidige versies;
- BiDash-integraal JSON;
- bestaande BI Dash JSON;
- planning XML;
- losse JSON-tabellen en JSON-objecten met `rijen`, `rows`, `records` of `data`;
- JSON Lines en NDJSON;
- CSV, TSV en teksttabellen;
- XLSX, XLS, XLSM, XLSB en ODS via de reeds meegeleverde lokale SheetJS-bibliotheek.

Er vindt geen upload naar een externe dienst plaats. Excel wordt in de browser gelezen met `site/vendor/xlsx.full.min.js`.

## Inhoudelijke herkenning

Voor tabulaire bronnen wordt per werkblad of tabel een score berekend. De importer kan onder andere herkennen:

- assetregister;
- EOL- en levensduurreferentie;
- historische storingen;
- actuele open storingen;
- DRIP-historie;
- U-routes;
- geplande werkzaamheden.

De herkenning gebruikt combinaties van kolommen en, als extra signaal, bestands- en werkbladnamen. Een bestandsnaam alleen is nooit voldoende om een bron als geldig te accepteren.

## Kolomaliassen

Bekende varianten worden aangevuld met de bestaande DVM-kolommen. Voorbeelden zijn:

- `wegnummer`, `weg`, `rijksweg`, `road`;
- `hm`, `hectometer`, `kilometrering`;
- `asset`, `assetnaam`, `objectnaam`, `name`;
- `VC`, `verkeerscentrale`, `regio`;
- `start`, `startdatum`, `van`;
- `einde`, `einddatum`, `tot`;
- `melding`, `storingsmelding`, `foutmelding`;
- `Werk_ID`, `work id`, `project id`;
- `U_route`, `uitwijkroute`, `omleidingsroute`.

De oorspronkelijke kolommen blijven behouden. Normalisatie voegt alleen de velden toe die de bestaande rekenketen nodig heeft.

## Veilig gedrag bij twijfel

Als twee brontypen vrijwel even waarschijnlijk zijn, importeert BiDash de tabel niet stilzwijgend. De gebruiker krijgt een melding met de mogelijke matches. Hiermee wordt voorkomen dat bijvoorbeeld werkzaamheden als storingshistorie worden verwerkt.

## Compatibiliteit

Los herkende DVM-bronnen worden omgezet naar een normale deelimport van `DVM-dienstimpact-totaal`. Daardoor blijven de bestaande DVM-rekenregels, assetkoppeling, prognoses, dienstverlening en exportstructuur de eigenaar van de inhoudelijke verwerking.

De universele importer vervangt dus niet de DVM-engine. Hij vormt een herkennings- en normalisatielaag vóór de bestaande importketen.

## Tests

`tests/universal-importer.test.js` controleert herkenning en normalisatie voor:

- assetregister met afwijkende kolomnamen;
- actuele storingen zonder vaste bestandsnaam;
- storingshistorie;
- werkzaamheden;
- U-routes;
- CSV met quoted velden;
- DVM-deelimportstructuur;
- hoofdletter-, accent- en scheidingstekenongevoelige kolomnamen.
