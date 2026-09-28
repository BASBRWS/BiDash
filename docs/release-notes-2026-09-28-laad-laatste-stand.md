# BiDash 2.25, laad laatste stand uit SharePoint-map

Datum: 28 september 2026  
DVM-engine: 111, ongewijzigd

## Wat is toegevoegd

- Onder **Data & export** staat de knop **Laad laatste stand**.
- Bij het eerste gebruik kiest de gebruiker de lokale map die OneDrive met de
  SharePoint-map synchroniseert. Edge en Chrome kunnen deze mapkoppeling in de
  browser onthouden.
- BiDash zoekt alleen naar geldige integrale BiDash- en DVM-totaal-JSON. Andere,
  kapotte of niet-ondersteunde JSON-bestanden worden overgeslagen.
- De nieuwste stand wordt bepaald met de exporttijd `opgeslagen`, daarna met de
  ISO-datum in de bestandsnaam en ten slotte met de wijzigingsdatum.
- De gevonden stand loopt door de bestaande importvoorvertoning. De gebruiker
  ziet dus eerst welke onderdelen worden vervangen en bevestigt daarna bewust de
  import.
- **Map koppelen of wijzigen** maakt het mogelijk een andere synchronisatiemap te
  kiezen. Browsers zonder blijvende mapkoppeling gebruiken een mapupload per keer.

## Beveiliging en gegevens

BiDash benadert SharePoint niet rechtstreeks. OneDrive synchroniseert de map op
het apparaat; BiDash leest die lokale map na toestemming van de gebruiker. Er is
geen Microsoft Graph-aanmelding, geen upload en geen wijziging in SharePoint. De
bestaande Content Security Policy met `connect-src 'none'` blijft behouden.

## Techniek en controle

- Nieuwe selectie- en toestemmingslogica staat in
  `site/core/latest-snapshot.js`.
- De gekoppelde `FileSystemDirectoryHandle` staat onder een aparte sleutel in de
  bestaande IndexedDB en wordt niet onderdeel van een export.
- Tests dekken formaatherkenning, datumvolgorde, het overslaan van ongeldige JSON,
  directorylezing, toestemmingsvernieuwing, de knop en de ongewijzigde
  netwerkgrens.
