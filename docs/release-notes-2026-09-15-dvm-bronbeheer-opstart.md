# Release notes, DVM-bronbeheer zonder automatische totaalherbouw

Datum: 15 september 2026

## Aanleiding

Na de invoering van bron-specifieke uploadknoppen kon DVM-bronbeheer alsnog vastlopen voordat een losse bron werkelijk werd verwerkt. De voortgang toonde dan `dvm-lokaal.json` met de fase `Koppelingen en analysebeeld herbouwen`.

Dat bestand kwam niet van de gekozen uploadknop. De centrale BiDash-schil herstelde bij het starten eerst de eerder in IndexedDB opgeslagen DVM-werkruimte. De DVM-adapter stuurde die complete werkruimte opnieuw door `totaalImportJson()`. Een grote opgeslagen combinatie van assetregister en storingshistorie kwam daardoor opnieuw in de zware totaalherbouw terecht.

## Wijziging

Grote opgeslagen DVM-werkruimtes worden tijdens de eerste pagina-opstart of bij DVM-bronbeheer niet meer automatisch door de totaalimport herbouwd.

De grens is bewust conservatief. Automatisch herstel wordt uitgesteld wanneer onder meer het assetregister meer dan 20.000 regels bevat, de historische storingenset meer dan 20.000 regels bevat, of het totaal van de relevante DVM-bronregels boven 30.000 komt.

De opgeslagen browserwerkruimte blijft bestaan. De DVM-engine start in dit geval licht, zodat de gebruiker via DVM-bronbeheer de bronnen één voor één rechtstreeks naar hun eigen parser kan sturen.

Na een succesvolle bron-specifieke upload stuurt de DVM-engine nu expliciet een `hub:changed`-melding naar de BiDash-schil. Daardoor wordt de nieuwe, daadwerkelijk geladen bronset weer als centrale lokale werkruimte opgeslagen en vervangt deze de oude zware DVM-toestand zodra de bronimport gereed is.

## Versie

De integratiebadge wordt bijgewerkt naar `v2.4`. De DVM-bronbeheerlaag toont `DVM v73`. Daarmee is op het scherm direct te controleren of deze wijziging geladen is.

## Diagnostiek

Wanneer automatisch herstel is uitgesteld staat in het DVM-frame `window.__BIDASH_DVM_RESTORE_DEFERRED__`. Daarin staan alleen aantallen per bronsoort, het totale aantal bronregels, de reden (`opstart` of `bronbeheer`) en het tijdstip.

## Test

`tests/dvm-restore-policy.test.js` controleert een werkruimte met 50.852 assetregels, 57.970 historische storingsregels en 130 actuele regels. Deze werkruimte moet de automatische totaalherbouw overslaan. Een kleine werkruimte moet nog wel automatisch kunnen herstellen. De test controleert ook de bron-specifieke terugmelding naar de schil en de nieuwe versienummers.
