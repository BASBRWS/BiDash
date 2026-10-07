# Business Intelligence Dashboard WVM 2.38, DVM 122

Datum: 7 oktober 2026

NDW-bestanden werden ingelezen, maar de wegdeelkoppeling bleef leeg. De index sloeg een meetpunt bijvoorbeeld onder `A15|RE` op, terwijl de zoekfunctie onder `15|RE` keek. Beide gebruiken nu dezelfde normalisatie. Voorloopnullen en richtingsaliassen zijn ondersteund; A- en N-wegen worden niet met elkaar vermengd.

De MONIBAS-regex in de runtimepatch bevatte dubbel ge-escapete tekens binnen String.raw. Daardoor herkende de parser de locatiecode niet. De code levert nu weg en hectometer en, voor expliciete hoofdbaancodes hrr/hrl, richting RE/LI. Aansluitingen krijgen geen afgeleide richting op basis van het 0/1-cijfer. Een complete bronlocatie wordt niet overschreven door de dichtstbijzijnde asset op de andere rijbaan.

De bestaande grens van één kilometer en de keuze van de representatieve zwaarste storing blijven behouden. De wijziging past geen verkeerskostenformules aan.

Validatie: de numerieke regressietest reproduceert de ontbrekende kandidaat en ontbrekende scenario-intensiteit vóór herstel. Na herstel slagen de vier matchingtests. De browsertest controleert de hele keten van configuratie en trafficspeed naar gekoppeld wegdeel en scenario-invoer, inclusief MONIBAS, tegengestelde richting en een nabijgelegen asset op de andere rijbaan. Alle 370 tests van npm test slagen. Volledige aangeleverde NDW-bestanden en representatieve wegdeelkoppelingen zijn uitsluitend lokaal gecontroleerd; operationele brongegevens en tellingen zijn niet opgenomen in Git. De exacte volledige werkruimte van de gebruiker is niet beschikbaar, dus een dekking van alle eigen wegdelen is niet vastgesteld.

Dashboard 2.38 en DVM 122 delen deze verhoging. De loaderketen gebruikt nieuwe cacheparameters. Laad na publicatie de NDW-bronnen opnieuw.
