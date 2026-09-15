# Release notes 2026-09-15 – Open storingen worker-first

## Aanleiding

De bron-specifieke import van `20260731-kruislampfouten_met_link_v3 ... .xlsx` kwam verder dan in versie 2.5, maar Edge meldde nog steeds dat de pagina niet reageerde tijdens `Werkmap uitlezen`.

De gerichte XLSX-lezer was geheugenarmer dan de algemene SheetJS-route, maar voerde nog steeds een groot deel van de ZIP- en werkbladverwerking op de hoofdthread uit. Daarnaast breidde het live-overzichtsfilter de te bewaren kolomset uit en voegde het extra synchronisatiewerk toe.

## Wijzigingen

- Open-storingenbestanden met `.xlsx` of `.xlsm` worden nu eerst via `sheetJsWorkerRijen` in een Web Worker verwerkt.
- De hoofdthread blijft daardoor beschikbaar voor de gebruikersinterface en voortgangsweergave.
- De worker krijgt maximaal 90 seconden. Alleen wanneer de worker niet beschikbaar is of faalt, wordt de gerichte lichte werkbladlezer gebruikt als fallback.
- De live-overzichtsfilters en de automatische filter-sync worden tijdelijk niet geactiveerd. De modules en opgeslagen configuratie blijven aanwezig zodat de functie later gecontroleerd kan worden teruggezet.
- De live momentopname wordt na lezen geactiveerd zonder vooraf de volledige historische storingsinspectie opnieuw op te bouwen.
- Zichtbare versie: BiDash `v2.6`, DVM `v75`.

## Functionele impact

De ruwe open-storingenmomentopname blijft volledig bewaard. De tijdelijke filterstop betekent dat alle herkenbare actuele open storingen weer meetellen in het actuele dashboard. Er worden op dit moment dus geen aanvullende gebruikersuitsluitingen toegepast op storingstype, gevolg, maatregel of andere filterfacetten.

## Tests

De regressietest controleert dat de Excel-worker vóór de main-thread fallback wordt aangeroepen, dat de 90-secondenbewaking aanwezig is en dat de live-overzichtsfilterpatches tijdens deze stabilisatiefase niet worden geactiveerd.
