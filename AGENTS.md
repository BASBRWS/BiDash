# Werkinstructies voor AI-bijdragen aan BiDash

Lees vóór functionele wijzigingen [docs/SYSTEEMWERKING.md](docs/SYSTEEMWERKING.md).
Dat is de centrale beschrijving van systeemwerking, eigenaarschap, gegevenscontracten,
modelaannames en vereiste controles. Deze korte ingang bevat geen tweede set rekenregels.

- Controleer de actuele branch en wijzigingen van andere auteurs vóór bewerken en publiceren.
- DVM blijft eigenaar van dienstimpact en kosten; BI van formatie en contractregels.
- Gebruikersdata blijft lokaal in de browser. Commit geen operationele bronnen of afgeleide data.
- Behoud bestaande XML/JSON-imports, selectieve export en null/0-betekenis.
- Voer de tests uit die bij de wijziging horen; Pages-CI draait niet alle browsertests.
- Werk de centrale beschrijving bij als de werking verandert en benoem ongeteste beperkingen.
- Maak geen tests of kwaliteitsafspraken zwakker om een wijziging te laten slagen.

Deze instructies gelden voor de hele repository, voor zover niet door hogere
instructies of expliciete nieuwe gebruikersopdrachten vervangen.
