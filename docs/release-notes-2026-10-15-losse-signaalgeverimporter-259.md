# BiDash 2.59 / DVM 139, losse signaalgeverimporter

Er is een aparte pagina `signaalgever-importer.html`, bereikbaar via Data & export en de bronkaart Signaalgevers uit map. Ze leest één verkeerscentrale tegelijk, zonder All Assets te laden of de dashboardwerkruimte te wijzigen. De begindatum staat op 1 januari 2025; de einddatum op vandaag. MN, NON, NWN/WNN, ZWN/WNZ en ZN zijn afzonderlijk te verwerken.

De mapkiezer zoekt uitsluitend in de gekozen verkeerscentrale en periode. De alternatieve mapinvoer ondersteunt de mtm-map of een VC-map. De verwerking groepeert bestanden per kalenderdag en geeft tussen bestanden en dagen de browser tijd om de voortgang en Stoppen te verwerken. De bestaande MTM-parser, incidentidentiteit, broncontroles en levenscyclus blijven leidend. Er is geen tweede impactberekening.

## Bewaren en overdragen

- Alle open en onzekere meldingen blijven bewaard, ongeacht hun startdatum. Een melding die vóór 2025 begon kan uit een aangeleverde snapshot vanaf 2025 worden overgenomen. Zonder een waarneming of basisbestand kan de importer haar bestaan niet reconstrueren.
- Alleen `HERSTELD_BEVESTIGD` en `HERSTELD_AFGELEID` met een sluitdatum of herstelvenster ouder dan één kalenderjaar worden verwijderd. De grens zelf blijft behouden. Schrikkeldagen vallen terug op de laatste geldige dag van dezelfde maand.
- `tot` of de begindatum geldt nooit als sluitbewijs. Oude legacyregels zonder sluitbewijs blijven bewaard. De historische incidentlijst bevat ook de nog actieve en onzekere incidenten; tel deze lijst niet op bij de actuele selectie.
- De eerste historische reconstructie mag bestanden vanaf 2025 lezen, terwijl de bewaarde afgesloten historie maximaal één jaar omvat. Na iedere dag past dezelfde bewaartermijn toe; ruwe snapshots van die dag worden daarna losgelaten.
- De eigen stand blijft bewaard in database `bidash-signaalgever-importer`, met dezelfde gesplitste opslag als de dashboardwerkruimte. De databases en schrijfqueues zijn gescheiden. Eén importer-tab tegelijk gebruiken. Een mislukte of gestopte import vervangt de vorige bevestigde stand niet. Andere reeds opgeslagen VC's blijven behouden.
- Download alle bewaarde VC's of alleen de gekozen VC. De uitvoer is een selectieve DVM-totaal-JSON met overdrachtskenmerk `signaalgeverImport`, verkeerscentrales, bronpeildata, snapshotdekking en bewaartermijnen. Een optioneel MTM-, DVM- of integraal basisbestand kan bij een volgende scan worden gebruikt.

Data & export en Signaalgevers totaal herkennen deze overdracht. Ze werken alleen de aangeleverde VC's bij. Overige VC's, camera's, DRIP-bronnen, parameters, matrix en andere onderdelen blijven behouden. Herhaald laden is idempotent; een bronpeildatum ouder dan de geladen VC wordt geweigerd. Een reguliere DVM-totaal zonder het overdrachtskenmerk houdt zijn bestaande vervangende gedrag. De gewone handmatige back-up bevat geen tijdelijk overdrachtskenmerk.

## Controles en grenzen

Een onleesbaar bestand, onherkenbare momentopname, onvolledige alarmregel of tegenstrijdige dubbele snapshot blokkeert toepassing van die VC. Geen stil overslaan en geen herstel uit een lege of onleesbare bron. De eerder gemelde onherkenbare bron kan zonder het ruwe bestand niet inhoudelijk worden hersteld. De bestaande minimale twee volledige snapshots, zesuurscontrole en controle op sterke volumedaling blijven gelden. Een dagelijkse bronlevering kan daardoor onbekende toestanden opleveren; de importer verruimt de sluitregels niet vanzelf.

`tests/signaalgever-import.test.js` controleert de bewaartermijn, kalendergrens, oude open/legacyregels, VC-overdracht, nul/ontbrekend, idempotentie en afwijzing van een oude stand. `tests/signaalgever-importer-browser.cjs` gebruikt de echte aparte pagina, mapinvoer, MTM-parser, lokale opslag en DVM-bronimport voor VC-selectie, retentie, afsluiting, hervatten, download, bronfout, stoppen en behoud van de dashboardwerkruimte. `tests/storage-browser.cjs` bewaakt de bestaande grote opslag en regressies na het beschikbaar maken van een afzonderlijke opslaginstantie.

De pagina gebruikt een verborgen DVM-frame voor de gedeelde parser en normalisatie; het frame laadt geen assetregister en voert voor deze importer geen dienstberekening uit. Het is een aparte pagina op dezelfde website, geen zelfstandig offline HTML-bestand. Bronbestanden blijven lokaal. De snelheid op een netwerkshare en de inhoudelijke volledigheid van een echte meerjarige MTM-levering zijn niet bewezen met synthetische tests. Browserquota en werkgeheugen blijven grenzen. Maak een JSON-back-up na iedere verkeerscentrale.

De via de losse importer gereconcilieerde MTM-stand krijgt `bronbeheer.signaalgeverTotaal.importerBewaren`. Deze stand en haar manifest blijven ook in de lokale dashboardopslag behouden, zodat herladen de ingevoerde VC's niet verwijdert. De bestaande compacte opslag blijft voor reguliere MTM-map-/totaalbronnen zonder dit kenmerk gelden. Na samenvoegen bewaart de uitzondering de gezamenlijke MTM-stand, inclusief eerder geladen andere VC's. De gesplitste opslag uit 2.58 blijft de grote records afhandelen.
