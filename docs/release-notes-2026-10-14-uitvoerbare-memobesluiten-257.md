# BiDash 2.57 / DVM 137, uitvoerbare memobesluiten

Een gevraagd besluit bevat voortaan een concrete opdracht met een eigenaar, uiterste opleverdatum, toetsbaar resultaat en datum plus ontvanger voor vaststelling en een volgend besluit. Een algemene zin zoals instemmen met betere datakwaliteit wordt daarmee een invulbare uitvoeringsopdracht.

De gewone memo, Lieke-memo en begeleidende MSI-/DRIP-Monte Carlo-brief gebruiken dezelfde afspraken. De gebruiker kan elk voorgesteld beslispunt afzonderlijk aanpassen. Namen, mandaat, termijnen en resultaat worden niet uit de berekening afgeleid. Ontbrekende afspraken blijven in de memo en de documentexports gemarkeerd als concept. Ongeldige datums en een vervolgbesluit vóór de opleverdatum worden benoemd.

Invoer blijft behouden bij wisselen van memovorm, ontvangerniveau en opties. Een andere scope of bronstand krijgt eigen afspraken. Parameters bewaart de invoer bij export en herimport. De memo-invoer verandert geen analysewaarden, dienstimpact of simulatie. Kopiëren, Word en afdrukken/PDF nemen dezelfde beslispunten over.

Validatie. Alle 500 tests slagen. De browserregressie controleert afzonderlijke invoer, gewone en Lieke-memo, opties, behoud van een tijdelijk verborgen bedrijfswaardenadvies, ongewijzigde berekening, printvenster, inhoud van de gedownloade Word-XML en totaalexport/herimport. MSI- en DRIP-begeleidende brieven gebruiken dezelfde geteste opbouw. De technische controle stelt geen mandaat, capaciteit of bestuurlijke haalbaarheid vast.

Deze wijziging bouwt voort op de storingslevenscyclus uit PR 132. Publicatie volgt na merge en een geslaagde Pages-run.
