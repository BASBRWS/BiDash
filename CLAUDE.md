# BiDash — BI Dashboard Wegverkeersmanagement (WVM)

## Basisinstructies

**Het bestand [`architectuur-bi-dashboard-wvm.md`](architectuur-bi-dashboard-wvm.md) is de bindende referentie voor alle (door)ontwikkeling in dit project.** Lees dat document vóór elke wijziging; bij twijfel of conflict geldt het architectuurdocument.

Motto: *Rule engine legt vast · Trigger engine monitoort · Dashboard toont*

## Wat dit project is

- Eén single-file HTML-applicatie: `bi-dashboard-wvm.html` (~640 KB, versie 5.0).
- Drie samenwerkende engines (de "driehoek"): rule engine, trigger engine, dashboard — gevoed door vijf datadomeinen (integrale planning, assets/LCM, bedrijfskundig model, formatie, financiën).
- De originele integrale-planningstool zit als `IPL_EMBED`-string embedded en draait in een iframe.

## Harde ontwerpprincipes (nooit schenden)

| # | Principe | Consequentie voor wijzigingen |
|---|----------|-------------------------------|
| P1 | **Eén regelbron** | Alle normen/drempels/parameters via `cfg(sleutel, fallback)` uit de config (config.html / `CFG_DEFAULTS`). Geen dubbele administratie of hardcoded normen. |
| P2 | **Hergebruik zonder wijziging** | De embedded planningstool (`IPL_EMBED`) blijft byte-voor-byte identiek aan het bronbestand. Koppeling uitsluitend read-only via `iframe.contentWindow`. Nooit code in de tool zelf aanpassen. |
| P3 | **Signaal → duiding → adressering** | Elke trigger heeft severity, domein, verantwoordelijke, toelichting mét toegepaste regel en gekwantificeerde waarde. Planningssignalen gaan door `berekenImpact()` voor de brede duiding. |
| P4 | **Alles simuleerbaar** | Nieuwe parameters moeten doorwerken in triggers én Monte Carlo, en verstelbaar zijn in de simulatie. |
| P5 | **Single-file, lokaal** | Geen server, geen upload, geen externe dependencies. Persistentie via localStorage (`bidash_wvm_v2`); uitwisseling via JSON-export/-import. |

## Kernafspraken bij ontwikkeling

- `cfg(sleutel, fallback)` is de **enige** toegangsweg tot configuratiewaarden.
- Alle planningsberekeningen gebruiken **effectieve datums** via `ipl_eff(regel)` (inclusief cascade-shifts), nooit ruwe t0/t1.
- De planningsbrug (`bridgeModel`) en capaciteitsbrug (`bridgeCapaciteit`) lezen uitsluitend via de eigen functies/objecten van de tool: `IPL_MODEL`, `ipl_eff`, `IPL_WBS_DIENST`, `IPL_SHIFT`, `ipl_dashEnsureFte`, `ipl_dashTaakFteRollen`.
- Update van de planningstool = alléén het `IPL_EMBED`-blok vervangen (JSON-gecodeerd, `</script` → `<\/script`), met byte-verificatie.
- Datamodelwijzigingen in `DB` vereisen migratielogica voor oudere localStorage-staten (zie § 9 van het architectuurdocument).
- Huisstijl: RWS — #003082 blauw, #F9B000 geel, rijkslint, Segoe UI.
- Taal van UI, code-commentaar en documentatie: Nederlands.

## Doorontwikkeling

Nieuwe features bij voorkeur langs de haakjes uit § 13 van het architectuurdocument (locatie via ActivityCodes, CMDB-koppeling, formatie per dienst, triggerhistorie, rapportage-export, scenariovergelijking). Werk het architectuurdocument bij wanneer de architectuur wijzigt — document en code horen synchroon te blijven.
