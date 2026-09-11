# BiDash — release notes

Nieuwste wijzigingen staan bovenaan. Werk dit bestand bij in dezelfde branch/PR
als iedere wijziging, ook bij documentatiewijzigingen. Bewaar eerdere vermeldingen.
De applicatieversie en de documentatiegeschiedenis zijn afzonderlijk: een wijziging
in alleen documentatie vereist geen nieuwe UI-versie.

Per vermelding: datum/versie, doel, gewijzigd gedrag, uitgevoerde controles,
beperkingen, PR/commit indien bekend en bevestigde publicatiestatus.
Gebruik vóór publicatie “Niet gepubliceerd” of “Publicatie nog niet bevestigd”.
Vul een successtatus pas in na controle. Voeg geen operationele gegevens toe.

## 11 september 2026 — releaseafspraken voor Codex en Claude

- Doel: beide AI’s laten werken met dezelfde systeemafspraken en wijzigingshistorie.
- Gewijzigd: `AGENTS.md` verplicht release notes bij iedere wijziging; `CLAUDE.md`
  verwijst naar dezelfde afspraak. De systeembeschrijving bevat deze oplevervoorwaarde.
- Toegevoegd: dit centrale changelog. Andere Markdown-documenten blijven actuele
  beschrijvingen/instructies; ze bevatten geen afwijkende kopie van de releasehistorie.
- Controle: bestaande instructies en hoofdbranch gecontroleerd; lokale links en
  diff gecontroleerd. Geen functionele tests herhaald voor alleen documentatie.
- Applicatiegedrag: ongewijzigd, Integratie 2.3.
- Publicatie: documentatie in deze wijziging; geen Pages-deployment vereist.
  Samenvoegstatus is te controleren in de bijbehorende GitHub-PR.

## 11 september 2026 — centrale systeembeschrijving

- Toegevoegd: `docs/SYSTEEMWERKING.md`, `AGENTS.md` en `CLAUDE.md`.
- Vastgelegd: architectuur, domeineigenaarschap, lokale gegevensverwerking,
  import/export, dienstimpact, kosten, simulaties, memo’s, planning en testmatrix.
- Expliciete beperkingen: niet alle BI-formatievelden vallen onder de exportkeuze
  `biRules`; de Pages-workflow voert geen browsertests uit.
- Controle: beschrijving vergeleken met Integratie 2.3; bestandslinks en diff gecontroleerd.
- Publicatie: samengevoegd via [PR 12](https://github.com/BASBRWS/BiDash/pull/12),
  commit `06f9e990305bc3d4849475cf2f45916def2b5f23`. Alleen documentatie; geen nieuwe siteversie.

## 10 september 2026 — Integratie 2.3

- Probleem: planning ontving de VWM-configuratie niet meer via de oude `parent.DB`-route.
- Hersteld: expliciete synchronisatie van BI-formatieregels naar planning bij
  koppelen, import, herstel en wijzigingen. Cumulatieve VWM telt overlappende taken op.
- Vormgeving: VWM- en CIV-grafieken blijven beschikbaar in volledig scherm;
  op smalle schermen staan planning en grafieken onder elkaar.
- Controles: lokaal aangeleverd planningbestand, synthetische overlappende taken,
  regelwijziging, herladen, fullscreen/mobiel, bestaande MS Project/P6-import en
  selectie-export, vijf modeltests en JavaScript-syntaxis. Geteste browserroutes
  gaven geen paginafouten of externe dataverzoeken.
- Beperking: geen volledige statistische/inhoudelijke herkalibratie van de rekenengines.
- Publicatie: [PR 11](https://github.com/BASBRWS/BiDash/pull/11) samengevoegd,
  commit `85086d3c7c7ed42e691ad216110c823d6081fee7`.
  [Pages-run 34465307633](https://github.com/BASBRWS/BiDash/actions/runs/34465307633)
  succesvol afgerond en destijds gecontroleerd.

## Oudere versies

Eerdere integratie- en validatienotities staan in `INTEGRATIE.txt` en `VALIDATIE.txt`.
Dit changelog begint bij de hierboven onderbouwde wijzigingen; oudere releases
zijn niet achteraf als volledig opnieuw getest aangemerkt.
