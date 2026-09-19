# Release notes — BiDash 2.19: brede periodevragen in Vraag BiDash

Datum: 19 september 2026

Versie: BiDash 2.19, DVM 102

## Doel

Vraag BiDash moet periodevragen in gewone taal begrijpen zonder dat de gebruiker exacte querytermen hoeft te kennen. Daarnaast mag een nieuw onderwerp niet stilzwijgend het vorige antwoordpad hergebruiken.

## Nieuw periodebegrip

Ondersteund zijn onder meer:

- meerdere kwartalen, bijvoorbeeld `Q3 en Q4 2027`;
- eerste/tweede halfjaar, `H1` en `H2`;
- voorjaar, zomer, najaar/herfst en winter;
- individuele maanden;
- maandranges zoals `van april tot oktober 2027`;
- begin, midden en eind van een jaar;
- dit/volgend/vorig kwartaal en jaar;
- komende N maanden;
- komende N volledige kwartalen;
- komende N jaren;
- meerjarige bereiken zoals `2027 en 2028`;
- relatieve eindgrenzen zoals `tot eind 2027`.

De geïnterpreteerde periode wordt als contextlabel in het antwoord getoond.

## Vaste betekenis van brede termen

- voorjaar = maart t/m mei;
- zomer = juni t/m augustus;
- najaar/herfst = september t/m november;
- winter = december t/m februari;
- eerste halfjaar = januari t/m juni;
- tweede halfjaar = juli t/m december;
- begin van een jaar = Q1;
- midden van een jaar = Q2 en Q3;
- eind van een jaar = Q4;
- komende N kwartalen = de eerstvolgende N volledige kwartalen.

## Contextfix

Woorden als `project` en `projecten` worden expliciet als planningdomein herkend.

Een nieuwe vraag zonder herkenbaar vervolgkarakter erft niet meer automatisch de vorige dienst-/storingscontext. Daardoor leidt bijvoorbeeld:

1. `Waarom is Incidentmanagement onder de norm?`
2. `Welke projecten spelen er in Q3 en Q4 2027?`

niet meer tot een herhaling van het Incidentmanagement-antwoord.

## Tests

Regressietests dekken:
- projectvraag na een dienstvraag;
- meerdere kwartalen;
- halfjaar;
- seizoen;
- maandrange;
- meerjarig bereik;
- relatieve perioden;
- contextreset bij een nieuw, onbekend onderwerp.


## Planningterminologie is data-gedreven

De geladen planning fungeert nu zelf als woordenlijst voor Vraag BiDash. De assistent indexeert:
- activiteit- en mijlpaalnamen;
- activiteitcodes;
- WBS/blok;
- volledig WBS-pad;
- planningsdienst;
- activiteitstype.

Hierdoor hoeft bijvoorbeeld `IFAT` niet in de broncode te staan. Als IFAT in een activiteitnaam, code of WBS-pad voorkomt, begrijpt de assistent `Wanneer is de eerst volgende IFAT?` als planningvraag en toont hij de eerstvolgende effectieve planningmatch.

Deze herkenning verbreekt oude gesprekcontext uit een ander domein. Planningcodes en WBS-termen worden op dezelfde manier behandeld.
