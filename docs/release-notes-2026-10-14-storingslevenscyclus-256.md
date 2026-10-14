# BiDash 2.56 / DVM 136, storingslevenscyclus en herstelbewijs

Een melding in een snapshot bewijst aanwezigheid op dat moment. De verwerking onderscheidt nu eerste waarneming, laatste waarneming, bronpeildatum en expliciet herstel. Een snapshotgrens wordt niet als bewezen hersteltijd geëxporteerd.

MTM volgt incidenten per VC met een stabiele samengestelde identiteit, bewaart ook systeem- en overige meldingen en controleert bronrijbalans en snapshotdekking. Eén afwezigheid blijft voorlopig. Minimaal twee volledige opeenvolgende afwezigheden geven afgeleid herstel met uitsluitend een herstelvenster. Een tijdgat, onvolledige bron of verdachte volumedaling blokkeert sluiten. Bij een losse live lijst blijven verdwenen meldingen zichtbaar als onbekend; terugkeer werkt dezelfde historie bij. Een mislukte bestandenset behoudt de vorige stand.

CDMS bewaart expliciete OK/AAN-herstelmeldingen, ook uit een volgende scan zonder nieuwe storing. Die herstellen uitsluitend de passende VC, DRIP, conditie en locatie. Een volgende scan met dezelfde bronnaam behoudt eerder bewijs. Korte gesloten episodes blijven bewaard. Export bevat de bronherkomst en de effectieve DRIP-incidenten; herimport bouwt dezelfde stand op.

De storingslijst en memo onderscheiden technische meldingen, unieke geraakte assets en onvolledige identiteit, met afzonderlijke toestanden en waarnemingsvelden. Verouderde of onzekere meldingen geven geen bewezen gezonde asset of exact actueel landelijk percentage. In het standaard actuele cap-model telt gelijktijdige fysieke uitval per asset maximaal eenmaal, terwijl afzonderlijke foutcodes zichtbaar blijven. De standaard 48 uur voor veroudering en zes uur tussen volledige MTM-snapshots zijn instelbaar en gaan mee met Parameters.

Validatie: 493 tests geslaagd, plus browsercontroles van de levenscyclusweergave, filters, memo, instellingen, MTM-mapupdates, herhaalde imports, download/herstel, lege snapshots en behoud na leesfouten. De prestatietest met 50.000 synthetische assets en 5.000 adaptermeldingen slaagt bij viermaal vertraagde CPU; de grootste gemeten browsertaak was 119 ms. Deze meting geldt voor de testomgeving.

Ontbrekende oude bronbestanden, herstelmeldingen en incidentkenmerken kunnen niet uit de export worden teruggevonden. Zulke onzekerheid blijft expliciet zichtbaar. De aangehaalde tellingen uit de export van 14 oktober zijn niet zelfstandig gevalideerd; regressies gebruiken synthetische bronnen. Publicatie volgt na merge en een geslaagde Pages-run.
