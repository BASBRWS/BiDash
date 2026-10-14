# BiDash 2.51 / DVM 131, blokkade bij Assetmanagement

De aanpassing uit 2.50 versnelde de registerweergave, maar liet twee omwikkelingen ongemoeid. De statusfiltermodule vergeleek ieder asset met alle storingen. De storingsverrijking zocht voor iedere melding opnieuw door het hele register. Open storingen werd daarnaast meermaals en volledig als tabel opgebouwd, ook wanneer het scherm verborgen was.

## Wijzigingen

- De registeradapter levert de volledige populatie; status en speciale DRIP-filters worden in de paginalijst toegepast.
- De bestaande operationele statusregel ontvangt uitsluitend de vooraf gegroepeerde meldingen van dat asset.
- Storingsverrijking gebruikt één sleutelindex per leesactie en een aanvullende asynchrone leesroute met browserpauzes.
- Open storingen heeft één weergave-eigenaar en wordt uitsluitend opgebouwd als het scherm zichtbaar is.
- Zoeken en queryfilters worden gebundeld en in korte blokken verwerkt. Achterhaald werk wordt afgebroken.
- De storingslijst toont 60 meldingen per pagina. Telling, filters, foutcodes op hetzelfde asset en memo gebruiken de volledige selectie.
- Bronwijzigingen, locatiecorrecties en vernieuwen maken de lijst ongeldig. De bestaande brondata, rekenregels en exports blijven behouden.

## Controle

De nieuwe browsertest gebruikt de echte adapter- en statusketen met 50.000 synthetische assets en 5.000 meldingen, bij viermaal vertraagde CPU. Hij controleert browsertaakduur, verborgen lijst, status/speciale filters, paging, snelle zoekwisselingen, de volledige memo en een nieuwe lege bron. De vorige UI-test verving de adapterlezingen en ving de nu gevonden omwikkelingen niet af.

Unitcontroles vergelijken synchrone en asynchrone meldingen en bewaken indexgebruik, afbreken, nul/onbekend, DRIP-conflicten en volledige populatie. De aangeleverde totaal-JSON wordt uitsluitend lokaal gebruikt. Operationele bronnen of afgeleide tellingen staan niet in Git.

Alle 438 unitcontroles en de browsertests voor beide registertests, planning/import/export/herstel/mobiel en individuele assetlocatiecorrecties zijn geslaagd.

Grote imports en expliciete volledige memo-opbouw blijven afzonderlijke bewerkingen. Testtijden hangen af van browser, apparaat en broninhoud.
