# Business Intelligence Dashboard WVM 2.30, DVM 114

Datum: 6 oktober 2026

## NDW en verkeerskosten

De knop voor NDW-verkeersdata kon na een asynchrone zoekactie een verborgen bestandskiezer openen. Browsers kunnen zo'n bestandsdialoog blokkeren omdat de oorspronkelijke gebruikersklik dan niet meer actief is.

De NDW-sectie heeft daarom twee expliciete acties:
- Gebruik NDW uit werkruimte, zoekt in de actieve en lokaal opgeslagen werkruimte.
- Kies export met NDW, opent de bestandskiezer direct vanuit de gebruikersklik.

De kostenmodule gebruikt voor deze route een opgeslagen NDW-verkeerssnapshot. Dit is niet dezelfde bron als de NDW CMDB-import voor MSI- en DRIP-areaal.

NDW levert in deze kostenketen het voertuigaantal. Zes hinderuren en 30 procent snelheidsreductie zijn scenarioaannames. De interface benoemt dat nu expliciet en bestaande handmatige waarden blijven leidend.
