# Vraag BiDash: lokale chat en doorvragen

Datum: 19 september 2026

Versie: BiDash 2.17, DVM 102

## Doel

Gebruikers kunnen vanuit ieder BiDash-scherm vragen stellen over de geladen data zonder AI of externe dienst. Het gesprek kan worden vervolgd op dezelfde selectie.

## Gewijzigd

- Rechtsboven is de knop **Vraag BiDash** toegevoegd.
- De popup kent twee contextmodi: het huidige scherm met de huidige filters, of alle beschikbare data.
- Vervolgvragen erven VC, weg, assettype, foutcode en andere ondersteunde gesprekcontext.
- De eerste vraagset ondersteunt open storingen, assets, foutcodes, bestaande dienstverleningsuitkomsten en bestaande verkeerskosten/VVU.
- Antwoorden kunnen tabellen, aantallen en contextlabels tonen.
- **Gebruik als filter** zet ondersteunde context terug in de bestaande asset- of storingsfilters.
- **Open bijbehorende data** navigeert naar de bestaande BiDash-weergave.

## Rekengrens

De queryassistent bevat geen tweede impact-, dienstverlening- of kostenmodel. Hij gebruikt de waarden die de bestaande adapters en rekenmodules al aanbieden. Niet-doorgerekende storingen blijven niet doorgerekend; de chat verzint geen impact.

## Privacy en techniek

De parser draait volledig in de browser. Er is geen AI-call, API-call of andere netwerkverbinding toegevoegd. De bestaande Content Security Policy met `connect-src 'none'` blijft intact.

## Controle

`tests/query-assistant.test.js` controleert onder meer het herkennen van MSI/A15/ZWN, contextbehoud bij doorvragen, foutcodegroepering, schermcontext, niet-doorgerekende meldingen, dienstverlening en verkeerskosten.
