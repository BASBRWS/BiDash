# BiDash 2.43, Primavera P6-scenario-export

De planning kan vanaf de tijdlijn en Data & export als Primavera P6 XML worden gedownload. De geladen XML levert de volledige structuur en haar eigen P6-versie. WBS, relaties, kalenders, codes, resourcegegevens, object-ID’s en veldvolgorde blijven behouden.

De volledige actuele cascade wordt opnieuw berekend. Gevulde geplande, effectieve, vroege, late, resterende en verwachte datumvelden van activiteiten en geplande datums van gekoppelde resources volgen het scenario, met behoud van tijd en tijdzone. Actuals, constraints, duur, uren en kosten blijven bronwaarden. Lege/nil-velden worden niet gevuld. Filters en ingeklapte groepen beperken de export niet. Ook prefixed P6-namespaces worden gelezen. De oorspronkelijke XML-export en integrale bron-plus-instellingenback-up blijven beschikbaar.

Schilversie 2.43; DVM blijft 126 omdat de DVM-rekenregels niet veranderen. Geen operationele bijlagen in Git.

Validatie: 407 unit-/regressietests geslaagd. De browsercontrole voor de nieuwe export is geslaagd met synthetische P6-data en een lokale aangeleverde bron, inclusief structuurvergelijking en herimport. De bestaande browsersuite voor MS Project/P6-import, selectieve export, mobiel, grote planning, slepen, zoom, fullscreen, formatie, herstel en NDW is geslaagd. JavaScript-syntaxcontrole en git diff --check zijn geslaagd. Import in een echte P6-omgeving is nog niet uitgevoerd. De bestaande tijdlijn gebruikt fractiejaren; terugexport gebruikt kalendermaanden met maandultimo-klemming. P6 moet na import worden gecontroleerd en herberekend.
