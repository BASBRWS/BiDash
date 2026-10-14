# BiDash 2.55 / DVM 135, achtergrondkaart bij Gebied & knelpunten

De kaartweergave had een lege NWB-kaartbasis en toonde daardoor geen herkenbare achtergrond. De kaart laadt nu automatisch de topografische BRT Achtergrondkaart van Kadaster / PDOK onder de bestaande knelpunten.

Gebiedskeuze, zoom, Hele regio en klikken vanuit de ranglijst blijven werken. De RD-coördinaten van kaart en markeringen gebruiken dezelfde projectie. Zonder bruikbare coördinaten verschijnt een landelijke kaart met uitleg. Knopen zonder locatie blijven zichtbaar in de ranglijst en de telling. Bij kaartuitval blijven de knelpuntgegevens beschikbaar.

Alleen vaste openbare kaartafbeeldingen worden opgehaald. De DVM-CSP staat daarvoor het specifieke PDOK-tegelpad toe; connect-src blijft self. Geen externe scripts of kaartbibliotheken. Geen bronbestanden, asset-id's, cookies of referrer in de kaartverzoeken. De kaartdienst ontvangt de normale netwerkgegevens en gevraagde tegeluitsnede. Berekeningen, lokale bronnen en exports veranderen niet.

Validatie: 472 tests en de browserregressie voor kaartladen, RD-projectie, gebiedskeuze, zoom, selectie, mobiel en kaartuitval. De browserregressie gebruikt standaard nagebootste kaartafbeeldingen. De echte PDOK-tegeldienst en de live kaartweergave zijn aanvullend in Chromium getest en visueel gecontroleerd. De live test gebruikte de omgevingsproxy; vanwege het proxycertificaat stond alleen voor die test HTTPS-certificaatcontrole uit. Dit verandert de HTTPS- of CSP-instellingen van de applicatie niet. Publicatie volgt na merge en een geslaagde Pages-run.
