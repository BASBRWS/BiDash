# Release notes, herstel importregressie na PR 22

Datum: 14 september 2026

## Aanleiding

Na de architectuurwijzigingen leek de centrale import steeds vaker vast te lopen bij grote integrale JSON-bestanden. De regressiegeschiedenis is daarom opnieuw vanaf de laatst bekende werkende importer onderzocht, in plaats van de huidige keten verder te optimaliseren.

De architectuur-PR zelf wijzigde alleen documentatie. De eerste technische wijziging van de centrale bestandslezer daarna zat in PR 22, `Voeg voortgangsbalk toe bij data laden`.

## Gevonden regressie

PR 22 verving wereldwijd `File.prototype.text()` door een eigen `FileReader`-implementatie om bytevoortgang te kunnen tonen. Daarmee veranderde een observatielaag onbedoeld de daadwerkelijke importsemantiek. De browser gebruikte niet langer zijn eigen native Blob/File-lezer voor ieder bestand dat via de centrale import liep.

Direct na deze wijziging volgde PR 23 met `Fix/import stuck 92`. Latere performancewijzigingen verbeterden delen van de DVM-verwerking, maar herstelden de oorspronkelijke leesroute niet.

Een tweede belasting is later toegevoegd door de universele importer. Voor een reeds bekende `BiDash-integraal` of `DVM-dienstimpact-totaal` JSON werd het volledige bestand eerst gelezen en geparsed om het formaat te herkennen. Daarna kreeg de bestaande centrale importer hetzelfde bestand opnieuw en las en parsede het nogmaals. Bij een integrale export van circa 80 MB levert dit onnodige CPU- en geheugenpieken op, vooral op mobiele browsers.

## Wijziging

De centrale import gebruikt weer de native browserimplementatie van `File.text()`. De voortgangslaag overschrijft geen browserprototype meer en observeert alleen nog de importstatus.

Voor bekende grote JSON-exports is een fast path toegevoegd:

- er wordt maximaal 256 kB van de bestandskop bekeken;
- `BiDash-integraal` en `DVM-dienstimpact-totaal` worden daaruit herkend;
- een bekende export gaat direct naar de oorspronkelijke centrale importer;
- de volledige JSON wordt daardoor nog maar één keer gelezen en één keer geparsed;
- onbekende of losse JSON-bronnen blijven via de universele herkennings- en normalisatielaag lopen;
- CSV, TSV, Excel en andere ondersteunde bronindelingen behouden de brede inhoudelijke herkenning.

De brede importer is dus niet teruggedraaid. Alleen reeds bekende grote BiDash-formaten slaan de dure extra herkenningsparse over.

## Voortgang

Tijdens het eerste native lezen is de centrale voortgang bewust onbepaald. Dit is minder schijnnauwkeurig dan een bytepercentage dat de browserlezer moet vervangen. Zodra DVM-, BI- of planningsverwerking start, blijven de bestaande modulefasen en percentages zichtbaar.

## Regressietests

De tests borgen nu expliciet dat:

- `load-progress.js` `File.prototype.text` niet overschrijft;
- de voortgangslaag geen eigen `FileReader` voor de centrale JSON-route installeert;
- een 80 MB bekende integrale JSON op basis van alleen de eerste 256 kB kan worden herkend;
- daarbij geen volledige `file.text()` vanuit de universele herkenner wordt aangeroepen;
- de bekende JSON-route rechtstreeks naar de oorspronkelijke app-importer gaat;
- de fast path vóór de universele importer wordt ingepland.
