# Release notes, bron-specifiek laden in DVM-bronbeheer

Datum: 15 september 2026

## Aanleiding

De centrale generieke import van een grote integrale JSON kan op mobiele browsers veel geheugen en verwerkingstijd vragen. Voor DVM-bronnen is die route bovendien niet nodig wanneer de gebruiker al weet welk soort bronbestand wordt geladen.

## Wijziging

DVM-bronbeheer toont voortaan per bronsoort een eigen uploadknop. De zeven bronsoorten zijn:

- Assetregister / All Assets;
- EOL-referentie;
- DVM-storingshistorie;
- DRIP-storingshistorie;
- U-routes;
- Werkzaamheden;
- Open storingen.

De knop stuurt het gekozen bestand rechtstreeks naar de bestaande parser van die bronsoort. Er vindt in deze route geen generieke DVM-vs-DRIP bronclassificatie en geen integrale totaalimport plaats.

De historische DVM-knop gebruikt rechtstreeks `leesStoringsBestanden`. De DRIP-historieknop gebruikt rechtstreeks `leesDripHistorieBestanden`. Daarmee wordt de eerdere gedeelde `laadStoringsBestandenAutomatisch`-route voor deze bronbeheerknoppen omzeild.

## Gedrag bronbeheer

DVM-bronbeheer is ook toegankelijk wanneer nog geen dataset geladen is. Lege bronsoorten blijven als kaart zichtbaar, zodat de laadvolgorde vanuit één scherm kan worden uitgevoerd.

All Assets blijft de eerste verplichte bron voor de onderdelen die een assetkoppeling nodig hebben. Die vervolgknoppen zijn tot dat moment zichtbaar maar geblokkeerd met de melding dat eerst het assetregister nodig is.

Voor bronnen waarvan meerdere bestanden naast elkaar mogen bestaan, zoals DVM- en DRIP-storingshistorie, toont de knop na de eerste import `Nog een bron toevoegen`. Voor enkelvoudige bronnen wordt `Bron vervangen` getoond.

De generieke knop `Totaal JSON laden` is uit de primaire acties van DVM-bronbeheer verwijderd. De bestaande totaalimportcode blijft technisch aanwezig voor compatibiliteit met bestaande workflows, maar is niet meer de aanbevolen bronbeheerroute.

## Test

`tests/dvm-source-manager.test.js` controleert dat alle zeven bronsoorten naar hun eigen invoerveld en parser verwijzen, dat DVM- en DRIP-historie niet via de generieke storingsherkenner worden geleid, dat bronbeheer zonder datasets toegankelijk blijft en dat de beheerpagina de generieke totaalimport niet als primaire actie toont.
