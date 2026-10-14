# Assetlocaties en verbindingsbogen — 2.48 / DVM 129

## Gedrag

- Eén locatieparser voor register en storingen behoudt expliciete A- en N-wegen en leest HM en HMP als dezelfde kilometereenheid. Nul blijft een geldige positie. PW-BPS wordt als N-weg herkend wanneer een expliciet wegnummer ontbreekt.
- Een bronzijde met een andere letter dan LI/RE kan naar een nabijgelegen hoofdrijbaan op dezelfde weg worden herleid. De bestaande HM-tolerantie is standaard 0,35 km; beschikbare RD-coördinaten helpen de zijde onderscheiden. Bij vrijwel gelijke kandidaten voor tegengestelde richtingen blijft de keuze open.
- De bronletter en werkelijke positie blijven bewaard. Netwerkschakelrapportage gebruikt bij zo'n afgeleide koppeling de positie van de hoofdrijbaan. Een ontbrekend matrixbereik of meerdere passende schakels worden niet automatisch ingevuld.
- Onder Regels & signalen → Impactregels → Assets zoeken en individueel configureren zijn weg, hoofdrijrichting, HM/HMP, hectoletter en optionele RD-coördinaten wijzigbaar. Opslaan herberekent areaal, actuele en historische storingen, DRIP-koppelingen en afhankelijke analyses.
- Correcties zijn afzonderlijke assetparameters: identiteit, naam en oorspronkelijke registerrij blijven intact. Export en totaalherstel bewaren correcties. Herstel alleen bronlocatie behoudt andere individuele rekenwaarden.
- Ongeldige correcties worden geweigerd. Een handmatig gecorrigeerd DRIP kan nog aan zijn oorspronkelijke bronlocatie worden herkend; de controle tegen verwisseling met een andere locatie blijft actief.

## Validatie en grenzen

429 automatische tests en de volledige bestaande browsersuite slagen. De nieuwe browserscenario's controleren de echte configuratievelden, A/N-correctie, zijbaanherleiding, areaal, DRIP-model, actuele doorrekening, export/herstel, invoerweigering en terugzetten. Het lokaal aangeleverde register/totaalbestand en de netwerkschakelmatrix zijn gecontroleerd zonder operationele brondata in de repository op te nemen.

De benadering gebruikt nabije registerassets, geen NWB-topologie. Zonder onderscheidende hoofdrijbaan of coördinaten is handmatige richtingkeuze nodig. Matrixgaten en overlappende schakels vragen een inhoudelijke matrixcorrectie; deze release verzint geen ontbrekende grenzen.
