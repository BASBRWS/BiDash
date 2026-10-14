# Netwerkschakelproblemen oplossen, 2.49 / DVM 130

Elke koppelprobleemgroep in Netwerkschakels controleren heeft een knop Oplossen. Je opent de betrokken assets en corrigeert direct weg, richting, HM/HMP, hectoletter en optionele RD-coördinaten. Opslaan herberekent de bestaande keten, houdt de dialoog open en vernieuwt de probleemlijst. De actuele koppeling staat bij elk asset. Grote groepen tonen twintig kaarten per pagina en hebben een zoekveld. Losse meldingen zonder registerkoppeling kunnen naar de bestaande assetkoppeling in Impactregels.

Vanuit hetzelfde probleem kun je de matrixregels op de betrokken weg filteren of een lege grensregel toevoegen. De bekende weg, VC en LI/RE worden klaargezet; grenzen blijven leeg totdat je gecontroleerde waarden invult. De bediening blijft bovenaan zichtbaar. Niet opgeslagen matrixinvoer blijft tijdens een assetcorrectie en sluiten/heropenen behouden zolang dezelfde matrixbron actief is. Pas matrixopslaan verandert de effectieve grenzen.

Nul als wegnummer, A0, N0 of RW/PW000 is een onbekende weg. Een herkenbaar registerasset met naam of entity-id blijft corrigeerbaar. HM/HMP nul blijft geldig. Bronrij, assetidentiteit, andere individuele rekenwaarden en oorspronkelijke Excel-grenzen blijven bewaard. Totaalexport neemt locatieparameters en matrixcorrecties via hun bestaande secties mee.

## Validatie

431 automatische tests en de volledige browsersuite slagen. De nieuwe browsertest controleert acties per probleem, locatiecorrectie in de dialoog, invoerweigering met behoud van invoer, onbekende weg, paginering, behoud van matrixinvoer, matrixfilter, toevoegen zonder geraden grenzen, herberekening en export/herstel. De bestaande netwerkschakelbrowsertest voor upload, grenscorrectie, VC-verschillen, terugzetten en totaalherstel slaagt. Het lokaal aangeleverde register en de matrix zijn gecontroleerd, zonder brondata of afgeleide tellingen te publiceren.

## Grenzen

De dialoog corrigeert geregistreerde locaties en matrixregels. Ontbrekende geografische kennis wordt niet verzonnen. Een bron-VC die afwijkt van de matrix-VC blokkeert een eenduidige locatiekoppeling niet. Nog niet opgeslagen matrixinvoer is geen back-up en gaat niet mee in export. Sla haar op en maak vervolgens een totaalexport met Parameters en Netwerkschakels.
