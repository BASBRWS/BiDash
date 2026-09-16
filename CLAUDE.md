# BiDash — ingang voor Claude

Lees [AGENTS.md](AGENTS.md) en [docs/SYSTEEMWERKING.md](docs/SYSTEEMWERKING.md)
voordat je functionele wijzigingen maakt. Zij beschrijven de gedeelde werkafspraken
en de werking van dit systeem. Gebruik dezelfde domeineigenaren en testmatrix;
onderhoud hier geen afwijkende kopie van de regels.

Verhoog bij elke functionele wijziging het versienummer, ook bij een kleine fix.
De schilversie staat in `site/core/versie.js`, een engine houdt haar eigen nummer bij.
Zet hetzelfde nummer in de release notes en werk de tests bij die het vastleggen.
De volledige regel staat in SYSTEEMWERKING §11; onderhoud hier geen afwijkende kopie.

Controleer de actuele GitHub-branch en wijzigingen van andere auteurs. Codex en
andere hulpmiddelen kunnen tegelijk aan dit project werken. Neem geen lokale
brondata op in commits en rapporteer welke controles werkelijk zijn uitgevoerd.
