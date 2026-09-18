# Release notes, lokaal kwaliteitsdashboard

BiDash 2.15, DVM 100. Bijgewerkt op 18 september 2026.

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

Auditresultaten bevatten samenvattingen, aantallen en maximaal honderd minimale
herstelidentifiers per bevinding. Volledige bronregels worden niet opgenomen en de
audit verzendt geen brondata. De laatste audit en scorehistorie worden in dezelfde lokale IndexedDB-
werkruimte opgeslagen. Bij **Export samenstellen** kan **Kwaliteitsaudit en
scorehistorie** worden meegenomen. Het laatste rapport kan ook apart als JSON worden
gedownload.

## Testdekking

`tests/quality-audit.test.js` bewaakt de lege werkruimte, een gezonde synthetische
DVM-keten, een ketenbreuk tussen bron en dashboard en het onterecht tonen van een
exact dienstpercentage naast niet-doorgerekende meldingen.

## Betere beoordeling en herstelactie

Een locatieconflict dat veilig buiten de berekening blijft, is een waarschuwing.
Het wordt alleen blokkerend wanneer een melding met een locatieconflict toch een
impactuitkomst krijgt. De audit toont de betrokken identifiers, locaties,
rekenstatussen en foutcodes zodat de oorzaak gericht kan worden hersteld.

Vanuit de bevinding **Open meldingen niet doorgerekend** kan **Foutcodes beheren**
worden geopend. Daar kun je een onderbouwde foutcode maken en geselecteerde meldingen
toewijzen. Een locatieconflict kan niet met een foutcode worden omzeild en moet via
Assetconfiguratie worden opgelost.
