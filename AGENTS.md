# Werkinstructies voor AI-bijdragen aan BiDash

Deze instructies gelden expliciet voor Codex én Claude.

Lees vóór wijzigingen [CHANGELOG.md](CHANGELOG.md) en [docs/SYSTEEMWERKING.md](docs/SYSTEEMWERKING.md).
Dat is de centrale beschrijving van systeemwerking, eigenaarschap, gegevenscontracten,
modelaannames en vereiste controles. Deze korte ingang bevat geen tweede set rekenregels.

- Controleer de actuele branch en wijzigingen van andere auteurs vóór bewerken en publiceren.
- DVM blijft eigenaar van dienstimpact en kosten; BI van formatie en contractregels.
- Gebruikersdata blijft lokaal in de browser. Commit geen operationele bronnen of afgeleide data.
- Behoud bestaande XML/JSON-imports, selectieve export en null/0-betekenis.
- Voer de tests uit die bij de wijziging horen; Pages-CI draait niet alle browsertests.
- Werk bij iedere wijziging `CHANGELOG.md` bij in dezelfde branch/PR: doel, gedrag, controles, beperkingen en publicatiestatus. Ook documentatiewijzigingen krijgen een vermelding.
- Controleer bij iedere wijziging alle relevante Markdown-documentatie. Werk `docs/SYSTEEMWERKING.md` bij als de werking verandert; werk `AGENTS.md` en `CLAUDE.md` bij als de werkafspraken veranderen. Kopieer geen releasehistorie naar elk document.
- Neem bestaande release notes van andere auteurs over en voeg toe; overschrijf hun historie niet.
- Noteer alleen werkelijk uitgevoerde tests en bevestigde publicatiestatus. Een samengevoegde PR is niet automatisch een geslaagde Pages-publicatie.
- Een wijziging is pas gereed als de relevante documentatie en release notes aansluiten op de opgeleverde code.
- Maak geen tests of kwaliteitsafspraken zwakker om een wijziging te laten slagen.

Deze instructies gelden voor de hele repository, voor zover niet door hogere
instructies of expliciete nieuwe gebruikersopdrachten vervangen.
