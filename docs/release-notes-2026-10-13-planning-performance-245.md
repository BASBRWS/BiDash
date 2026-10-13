# BiDash 2.45, snellere planningweergave

De formatiegrafieken berekenden dezelfde weekreeks meerdere keren per verversing. VWM doorliep daarbij herhaaldelijk de volledige activiteitenlijst voor ieder meetmoment en iedere rol. De grafieken delen nu één reeks. Een pure rekenmodule selecteert alleen actieve meetmomenten. De bestaande toleranties, optelvolgorde, VWM-/CIV-regels en kwartaalbijdragen blijven behouden.

Scrollen hergebruikt de gesorteerde tijdlijnvolgorde en start geen formatieberekening. Activiteiten worden via een index gevonden. Verborgen formatievakken stoppen het tekenwerk. Resize-verzoeken worden gebundeld en een dubbele dashboardverversing via een vaste timer is verwijderd. De bestaande BI-achtergrondcontrole berekent model en capaciteit pas opnieuw na gewijzigde invoer.

Bij een lokale profilering van een synthetische planning met 2.000 activiteiten daalde één grafiekverversing van circa 174 ms naar 3,4 ms. Dit is een meting in dezelfde testomgeving, geen gegarandeerde tijd voor iedere bron of browser. De eerste XML-import en uitgebreide dashboards draaien nog op de bestaande browserthread. Er is geen Web Worker of server toegevoegd.

Schil 2.45, DVM 126. De documentatie is bijgewerkt. Operationele bronnen en afgeleide brongegevens zijn niet gepubliceerd.

Validatie: 416 unit-/regressietests geslaagd. De nieuwe planningcontrole bewaakt positieve VWM-vraag, exact dezelfde weekwaarden als de bestaande VWM-regel, één berekening per grafiekbatch, geen FTE-berekening bij scrollen of verbergen, vernieuwde indices, rolweergave, gewijzigde scenario’s en rustige BI-intervalticks. De bestaande browsersuite voor MS Project/P6, grote planning, slepen, zoom, fullscreen, formatie, herstel, mobiel en NDW is geslaagd. De Primavera-browsercontrole en lokale bronproef voor structuurbehoud en herimport zijn geslaagd. Syntaxcontrole en git diff --check zijn geslaagd.
