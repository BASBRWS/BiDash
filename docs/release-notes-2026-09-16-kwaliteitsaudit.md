# Release notes, lokaal kwaliteitsdashboard

BiDash 2.12, DVM 80. Datum 16 september 2026.

## Nieuwe kwaliteitstab

Onder **Data & export** staat nu **Kwaliteit**. De knop **Audit uitvoeren** legt de
actuele lokale werkruimte vast en controleert vijf onderdelen:

1. bronnen en actualiteit;
2. datakwaliteit en uniciteit;
3. koppelingen tussen meldingen, assets, diensten en functies;
4. rekenregels en zichtbaarheid van niet-doorgerekende meldingen;
5. beheerbaarheid, back-up en herleidbaarheid.

Het dashboard toont een totaalscore, een oordeel, deelscores, blokkerende fouten,
waarschuwingen en concrete herstelacties. Maximaal twaalf audits blijven lokaal
bewaard als scorehistorie. Zo wordt zichtbaar of de kwaliteit stijgt of daalt.

## Bewuste grens

De audit controleert aantoonbare technische en gegevenskundige voorwaarden. Zij
bewijst niet dat verkeerskundige, statistische of beleidsmatige aannames inhoudelijk
juist zijn. Een score van 100 betekent daarom dat de vaste controles slagen, niet
dat ieder model extern is gevalideerd.

## Opslag en export

Auditresultaten bevatten alleen samenvattingen en aantallen. De audit verzendt geen
brondata. De laatste audit en scorehistorie worden in dezelfde lokale IndexedDB-
werkruimte opgeslagen. Bij **Export samenstellen** kan **Kwaliteitsaudit en
scorehistorie** worden meegenomen. Het laatste rapport kan ook apart als JSON worden
gedownload.

## Testdekking

`tests/quality-audit.test.js` bewaakt de lege werkruimte, een gezonde synthetische
DVM-keten, een ketenbreuk tussen bron en dashboard en het onterecht tonen van een
exact dienstpercentage naast niet-doorgerekende meldingen.
