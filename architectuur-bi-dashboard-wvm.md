# Architectuurdocument — BI Dashboard Wegverkeersmanagement (WVM)

**Bestand:** `bi-dashboard-wvm.html` (single-file HTML-applicatie, ~640 KB)
**Versie:** 5.0 · Peildatum 2026-07-14
**Status:** Basisarchitectuur — dit document is de referentie voor doorontwikkeling
**Motto:** *Rule engine legt vast · Trigger engine monitoort · Dashboard toont*

---

## 1. Doel en positionering

Het BI Dashboard brengt de sturingsinformatie van het WVM-domein samen in één instrument, gebouwd rond drie samenwerkende engines (de "driehoek") die gevoed worden door vijf datadomeinen:

1. **Integrale planning** (GPO · VWM · CIV, via Primavera P6 XML)
2. **Asset prestaties / LCM** (CMDB DVM, Productieplatform, Tunnel/TTI, Facilitair)
3. **Bedrijfskundig model** (bedrijfsdoelen, bedrijfsfuncties, bedrijfssystemen — P×Q)
4. **Formatie** (benodigde vs actuele FTE, capaciteitsvraag uit de planning)
5. **Financiën** (benodigde middelen, budget, contractboete, inhuurrisico)

Het instrument is nadrukkelijk **geen nieuwe planningstool**: de bestaande integrale-planningstool draait er ongewijzigd in, en de bestaande VWL-configuratie (config.html) levert de regels. Het dashboard voegt de laag toe die afwijkingen signaleert, per meldingstype de **brede impact** duidt over alle datasets, en de gevolgen prognosticeert.

### 1.1 Ontwerpprincipes

| # | Principe | Uitwerking |
|---|----------|------------|
| P1 | **Eén regelbron** | Alle normen, drempels en parameters komen uit config.html (VWL Configuratie). Geen dubbele administratie. |
| P2 | **Hergebruik zonder wijziging** | De integrale-planningstool is byte-voor-byte, ongewijzigd embedded. Koppeling uitsluitend read-only. |
| P3 | **Signaal → duiding → adressering** | Een afwijking is een signaal; de trigger engine vertaalt het via rule engine-voorwaarden naar impact per domein, geadresseerd aan een verantwoordelijke. |
| P4 | **Alles simuleerbaar** | Elke parameter is verstelbaar; gevolgen zijn direct zichtbaar in triggers én in Monte Carlo-prognoses. |
| P5 | **Single-file, lokaal** | Eén HTML-bestand, geen server, geen upload. Persistentie via browseropslag; uitwisseling via JSON-export/-import. |

---

## 2. De driehoek — logische architectuur

```
                        ┌─────────────────────┐
                        │       BI DASH        │
                        │  toont & simuleert   │
                        │  · domeintegels RAG  │
                        │  · risico's per      │
                        │    verantwoordelijke │
                        │  · simulatie + MC    │
                        └──────────▲───────────┘
                                   │ toont
              vastleggen           │            monitoren
        ┌──────────────────┐       │       ┌──────────────────┐
        │   RULE ENGINE    │───────┴──────▶│  TRIGGER ENGINE  │
        │ · config.html    │  voorwaarden  │ · toetst actueel │
        │   (156 params)   │               │   aan de regels  │
        │ · P×Q per functie│               │ · duidt brede    │
        │ · impactregels   │               │   impact per     │
        │ · capaciteits-   │               │   meldingstype   │
        │   grenzen        │               │ · adresseert     │
        │ · normen/wegingen│               │   verantwoordelijke│
        └──────────────────┘               └──────────────────┘
                 ▲                                   ▲
                 │ regels                            │ actuele data
        ┌────────┴───────────────────────────────────┴────────┐
        │                 VIJF DATADOMEINEN                    │
        │ Integrale planning · Assets/LCM · Bedrijfskundig     │
        │ model · Formatie · Financiën                         │
        └──────────────────────────────────────────────────────┘
```

**Kerngedachte:** de rule engine beheert de uitgangspunten waar de dienstverlening op geënt is ("om functie X te leveren heb ik N fte, assets X/Y/Z en € K per jaar onderhoud nodig", plus wettelijke richtlijnen en locatiewegingen). De trigger engine toetst continu de actuele data aan die uitgangspunten en toont afwijkingen aan de betreffende verantwoordelijke. Het dashboard maakt alles zichtbaar en kan de gevolgen van alle parameters inzichtelijk maken via simulatie en Monte Carlo.

---

## 3. Fysieke opbouw van het bestand

Het bestand bestaat uit vier lagen in één HTML-document:

| Laag | Inhoud | Omvang (indicatief) |
|------|--------|---------------------|
| 1. Presentatie | CSS (RWS-huisstijl: #003082 blauw, #F9B000 geel, rijkslint, Segoe UI), topbar met navigatie, vijf pagina-containers | ~12 KB |
| 2. Applicatiescript blok 1 | Configuratie (CFG_DEFAULTS), datamodel (DEFAULT_DB), config-import, planningsbrug, capaciteitsbrug, impact engine, trigger engine, Monte Carlo | ~30 KB |
| 3. Applicatiescript blok 2 | Renderers per pagina, capaciteitskaart, navigatie, JSON-export/-import | ~30 KB |
| 4. Embedded planningstool | `const IPL_EMBED = "<volledige integrale-planning-rws.html>"` — de originele tool als JSON-gecodeerde string, byte-voor-byte identiek aan het bronbestand | ~565 KB |

**Pagina's (tabbladen):** Dashboard · Rule engine · Trigger engine · Integrale planning · Databronnen · Simulatie.

---

## 4. Rule engine — de vastleggende laag

### 4.1 Configuratiebron (config.html-koppeling)

De regels komen uit dezelfde bron als de VWL Beheertool. Drie laadroutes:

1. **Ingebouwde standaard** — alle 156 parameters uit config.html zijn 1-op-1 als `CFG_DEFAULTS` opgenomen (fallback).
2. **JSON-import** — het bestand `vwl_scenario_config.json` (knop *Export voor Framework* in config.html; formaat `{_type:'vwl-scenario', _version:1, config:{…}}`) of een kale config-JSON. De structuur wordt plat geslagen naar sleutel-notatie (`personeel.ziekteverzuim` etc.) en over de defaults gelegd.
3. **Browseropslag** — directe uitlezing van de localStorage-sleutels `vwl-scenarios` en `vwl-active-scenario` van config.html (zelfde origin vereist).

Helper: `cfg(sleutel, fallback)` — de énige toegangsweg tot configuratiewaarden in de hele applicatie.

### 4.2 Parameterdoorwerking (koppeling op alle afhankelijke onderdelen)

| Config-parameter | Werkt door op |
|---|---|
| `personeel.ziekteverzuim` | Verzuimopslag op benodigde FTE — trigger engine én Monte Carlo, én startwaarde van de simulatieslider |
| `personeel.min_bezetting` | Harde ondergrens bezettingsgraad → kritieke formatietrigger |
| `escalatie.niveau1` / `niveau2` | Severity-drempels bezettingsgraad (aandacht / kritiek) |
| `atw.max_uren_week`, `atw.rust_dagelijks`, `atw.max_nachten_14d`, `atw.rust_na_nachtreeks`, e.a. | Inhoud van ATW-risicotriggers bij onderbezetting en piekinzet |
| `kpi.asset_beschikbaarheid.tunnel` | Norm CMDB-categorie **Tunnel/TTI** |
| `kpi.asset_beschikbaarheid.msi` | Norm CMDB-categorie **DVM** |
| `kpi.asset_beschikbaarheid.werkplek` | Norm CMDB-categorie **Productieplatform** |
| `kpi.asset_beschikbaarheid.drip` | Norm CMDB-categorie **Facilitair** |
| `assets.hw_mttr` / `assets.sw_mttr` | Hersteltijd per storing in de Monte Carlo (hardware resp. software/Productieplatform) |
| `contract.beschikbaarheidseis`, `contract.boete_per_uur`, `contract.boete_actief` | Boeterisicotrigger financiën + boetekolom Monte Carlo |
| `hinder.max_files_werk` | Drempel gelijktijdigheidspiek in de planning |
| `sim.personeel_factor`, `sim.budget_factor`, `sim.asset_factor`, `sim.incident_multiplier` | Knop "Config-scenario overnemen" op de simulatiepagina (asset_factor wordt omgezet naar storingsfactor = 1/asset_factor × incident_multiplier) |

Asset-normen zijn hierdoor **afgeleid** (`normVoor(asset)` = config-norm van de CMDB-categorie); alleen de locatie-**weging** blijft lokaal bewerkbaar ("asset Z op locatie Y weegt zwaarder").

### 4.3 P×Q-uitgangspunten per bedrijfsfunctie

Per bedrijfsfunctie legt de rule engine vast: `benodigdFte`, gekoppelde `assets[]`, `onderhoudEur` per jaar, toepasselijke `richtlijnen[]` (ATW, Warvw/Rarvw, BABW) en het bedrijfsdoel + systemen (bedrijfskundig model). Weergave als regel: *P×Q: N fte + € K/jr*.

### 4.4 Impactregels (voorwaarden voor de brede duiding)

Bewerkbaar op de rule engine-pagina; standaardwaarden tussen haakjes:

| Regel | Betekenis | Doorwerking |
|---|---|---|
| `fteOpslagConflict` (10 %) | Extra inzet op gekoppelde functies tijdens een corridorconflict | Formatie- en ATW-triggers + meerkosten |
| `storingsOpslag` (×1,5) | Verhoogd storingsrisico op gekoppelde assets tijdens werkzaamheden | Assettriggers + boeterisico + Monte Carlo |
| `fteKostenJr` (€ 95.000) | Loonkosten per fte per jaar | Meerkosten- en inhuurberekening |
| `piekOpslagPct` (4 %) | Regie-inzet per werk boven de hinderdrempel | Formatietrigger bij gelijktijdigheidspiek |
| `shiftKostenPctMnd` (0,35 %) | Kostenindexatie op P×Q-onderhoud per maand verschuiving | Financiëntrigger bij planningsshift |

### 4.5 Capaciteitsgrenzen per dienst

`capgrens = {GPO, CIV, VWM, PPO, Regio}` (fte, bewerkbaar). De trigger engine toetst de FTE-vraag uit de planningstool hieraan (§ 6.3).

---

## 5. Integrale planning — de embedded tool en de brug

### 5.1 Embedding (principe P2)

De originele `integrale-planning-rws.html` is als JSON-string (`IPL_EMBED`) in het bestand opgenomen — **byte-voor-byte identiek**, geautomatiseerd geverifieerd. Bij het openen van het tabblad wordt eenmalig een iframe aangemaakt met `URL.createObjectURL(new Blob([IPL_EMBED], {type:'text/html'}))`. Een blob-URL erft de origin van het dashboard, waardoor:

- alle functies van de tool intact blijven (P6 XML-import/-export, gelaagde Gantt, cascade-shifts globaal/per mijlpaal/per project, FTE-capaciteit, dienst-/VC-mapping via ActivityCodes, dashboards per dienst en niveau, autosave/restore);
- het dashboard **rechtstreeks en read-only** in het geheugen van de tool kan kijken (`iframe.contentWindow`), zonder één regel van de tool aan te passen.

Het iframe wordt éénmaal gemount en blijft bestaan bij tabwissel (state gaat niet verloren).

### 5.2 De planningsbrug (`bridgeModel`)

Leest per verversing uit het iframe:

| Bron in de tool | Gebruik in het dashboard |
|---|---|
| `IPL_MODEL.regels` (id, naam, code, t0, t1, kind, wbs, wbsPath) | Activiteiten en mijlpalen |
| `ipl_eff(regel)` | **Effectieve datums inclusief cascade-shifts** — alle triggers rekenen hiermee |
| `wbsPath[0]` + `IPL_WBS_DIENST` | Blok (WBS-hoofdgroep) en dienst (GPO/CIV/VWM/PPO/Regio) per regel |
| `IPL_MODEL.relaties` (from/to) | Relatietelling; cross-dienst = verschillende top-WBS |
| `IPL_SHIFT` | Globale verschuiving (maanden) |
| `IPL_RAW_FILENAME` | Bestandsnaam van de geladen XML |

Een poller (elke 2 s) berekent een signatuur (bestand + aantal regels + shift + bereik + capaciteitssom). Verandert die — door XML-import, schuiven of FTE-configuratie in de tool — dan hertoetst de hele driehoek automatisch en kleuren de statusstippen in de navigatie mee.

### 5.3 De capaciteitsbrug (`bridgeCapaciteit`)

Capaciteit leeft in de planningstool als **FTE-rollen per taak** (`IPL_CONFIG.fte`), gevuld via het Config-paneel van de tool of via FTE-templates die matchen op de ActivityCode "[VWM] Fase". De brug roept uitsluitend de eigen functies van de tool aan (`ipl_dashEnsureFte`, `ipl_dashTaakFteRollen`, `ipl_eff`) en aggregeert:

- per **kwartaal** per **dienst** de som van de FTE van actieve taken (effectieve datums);
- per dienst: piek-FTE, piekkwartaal, grens (uit `capgrens`), aantal kwartalen boven de grens;
- totalen: taken met FTE / totaal, cumulatieve FTE-toewijzing;
- `geconfig:false` wanneer nog geen enkele taak FTE-rollen heeft — de UI legt dan uit hoe capaciteit geladen wordt (Config-paneel, templates, of staat-import uit een eerder gebruikte losse tool).

**Weergave:** kaart "Capaciteitsvraag uit de planning" onder het iframe: gestapelde kwartaalgrafiek in dienstkleuren met gestippelde grenslijnen per dienst, plus statustabel (piek/kwartaal/grens/overschrijdingen).

> **Let op:** de P6-XML zelf bevat doorgaans géén resource-units (LaborUnits = 0). Capaciteit komt uit de tool-configuratie; die reist mee via de export/import van de opgeslagen staat van de tool.

---

## 6. Trigger engine — toetsing en meldingstypen

`evalTriggers(params)` levert de volledige triggerset, gesorteerd op severity (kritiek → aandacht → ok). Elke trigger bevat: severity, domein, **verantwoordelijke**, titel, toelichting mét de toegepaste regel, en een gekwantificeerde waarde.

### 6.1 Verantwoordelijken (adressering)

| Domein | Verantwoordelijke |
|---|---|
| Formatie, Richtlijnen (ATW) | Afdelingshoofd VWM |
| Financiën | Businesscontroller WVM |
| Assets | Assetmanager CIV/PPO |
| Planning | Planningscoördinator WVM |
| Bedrijfskundig model | Adviseur bedrijfsvoering |

### 6.2 Directe toetsingen (actuele data vs regels)

1. **Formatie** — per bedrijfsfunctie: `benodigdEff = benodigdFte × (1 + verzuim%)`; `bezetting% = actueelEff / benodigdEff`. Severity: kritiek onder `personeel.min_bezetting` of `escalatie.niveau2`, aandacht onder `escalatie.niveau1`. Bij tekort én ATW-regime volgt een gekoppelde **ATW-risicotrigger** met de concrete ATW-parameters uit config.html.
2. **Financiën (P×Q)** — benodigde middelen = Σ onderhoud × kostenindex; toets tegen budget. Kritiek bij gat > 5 % van het budget.
3. **Financiën (contractboete)** — per asset onder `contract.beschikbaarheidseis`: boete = tekort% × 8760 uur × `boete_per_uur` (indien `boete_actief`).
4. **Assets** — per asset: effectieve beschikbaarheid vs categorienorm uit config.html; impact = tekort × locatieweging. Kritiek bij impact ≥ 0,8.

### 6.3 Planningssignalen (meldingstypen uit de brug)

| Type | Detectie | Standaard-severity |
|---|---|---|
| `conflict` | Corridorconflict: twee werken uit **verschillende** WBS-hoofdgroepen overlappen in tijd én delen een corridor-token (regex `A##`/`N##` of `…tunnel` uit de activiteitnamen) | kritiek bij > ~1 maand overlap |
| `piek` | Gelijktijdigheidspiek: maximum aantal gelijktijdige werken (exact geteld op elk startmoment) > `hinder.max_files_werk` | kritiek |
| `capaciteit` | FTE-vraag per dienst piekt boven de capaciteitsgrens uit de rule engine | kritiek bij ≥ 2 fte overschrijding |
| `shift` | Globale verschuiving actief in de planningstool | kritiek bij ≥ 9 maanden |
| `cross` | Relaties tussen verschillende WBS-hoofdgroepen (ketenafhankelijkheid) | aandacht |

### 6.4 Impact engine — brede duiding per meldingstype (principe P3)

Elk planningssignaal gaat door `berekenImpact(trigger, params)`. **Koppelvoorwaarde:** corridor-/locatietoken → assets (match op `asset.locatie`/naam) → bedrijfsfuncties (match op naam of gekoppelde assets) → fte, euro's en richtlijnen. Resultaat: impact-chips op het bronsignaal ("BREDE IMPACT →") én **afgeleide triggers** (badge "⛓ afgeleid ← planning") in elk geraakt domein:

| Signaal | Afgeleide impact |
|---|---|
| **conflict** | *Formatie:* piekinzet = Σ benodigdFte gekoppelde functies × `fteOpslagConflict`% tijdens het venster · *Richtlijn:* ATW-druk op gekoppelde ATW-functies · *Assets:* prognosebeschikbaarheid = 100 − (100 − besch) × `storingsOpslag`; trigger als < norm · *Financiën:* meerkosten = piekinzet × duur × `fteKostenJr` + venster-boeterisico |
| **piek** | *Formatie:* regie-inzet = totaal benodigdFte × overschot × `piekOpslagPct`% |
| **capaciteit** | *Financiën:* inhuurrisico = tekort-fte × (overschrijdingskwartalen/4) × `fteKostenJr` × inhuurfactor 1,3 |
| **shift** | *Financiën:* indexatie = Σ P×Q-onderhoud × `shiftKostenPctMnd`% × |maanden| |
| **cross** | Ketenrisico-chip (kwalitatief) |

Afgeleide triggers dragen de bron mee en worden geadresseerd aan de verantwoordelijke van het geraakte domein — een corridorconflict landt dus tegelijk bij planningscoördinator (bron), afdelingshoofd (piekinzet + ATW), assetmanager (uitvalrisico) en controller (meerkosten).

---

## 7. Monte Carlo — prognose op de uitgangspunten

`runMC(n, params)` met n = 2.000 (dashboard-widget) tot 50.000 runs (simulatiepagina). Per run wordt één jaar gesimuleerd:

| Grootheid | Verdeling |
|---|---|
| Verzuim | Normaal(μ = verzuimparameter, σ = 1,6), afgekapt op ≥ 0 |
| Onderhoudskosten | Normaal(P×Q × kostenindex, σ = 4 %) |
| Storingen per asset | Poisson(storingen/jr × storingsfactor × werkzaamhedenopslag uit de impact engine) |
| Hersteltijd per storing | `assets.hw_mttr` of `assets.sw_mttr` × U(0,6–1,4) |
| Planningsimpact | Extra fte-vraag en meerkosten uit conflicten en capaciteitsoverschrijdingen × U(0,7–1,3) |

Uitkomsten: kans op FTE-tekort, kans op budgetoverschrijding (kosten + boete + planningsimpact > budget), kans dat een asset dat nú binnen norm valt eronder zakt; P10/P50/P90 voor FTE-gat, budgetgat en contractboete; histogram van een samengestelde risicoscore (blauw < P50, oranje P50–P90, rood > P90).

---

## 8. Simulatie — "alle parameters inzichtelijk" (principe P4)

Vijf sliders (verzuim %, formatie Δ%, kostenindex, budget Δ%, storingsfactor) vormen samen `SIM`; zolang die actief is toont de topbar de badge *Simulatiemodus actief* en rekent de héle driehoek (triggers, tegels, impact, MC) met de simulatiewaarden. Tabel *basis vs simulatie* toont de verschuiving in kritiek/aandacht-aantallen. Knoppen: *Config-scenario overnemen* (sim.\*-factoren uit config.html) en *Terug naar basis*.

---

## 9. Datamodel en persistentie

```
DB = {
  meta: { versie, peildatum },
  params: { kostenIndex },                    // lokale basisparameter
  config: { …156 sleutels… },                 // config.html-regels (plat)
  configBron: '…',                            // herkomstlabel
  richtlijnen: [ {id, naam, oms} ],
  functies: [ {id, naam, doel, systemen[], benodigdFte, actueelFte,
               assets[], onderhoudEur, richtlijnen[]} ],
  assets:   [ {id, naam, cmdb, besch, storingenJr, locatie, weging} ],
  financien:{ budgetJr },
  impact:   { fteOpslagConflict, storingsOpslag, fteKostenJr,
              piekOpslagPct, shiftKostenPctMnd },
  capgrens: { GPO, CIV, VWM, PPO, Regio }
}
```

- **Opslag:** localStorage-sleutel `bidash_wvm_v2`; migratielogica vult ontbrekende blokken (config/impact/capgrens) aan bij laden van oudere staten.
- **Uitwisseling:** topbar-knoppen ⭳ Export / ⭱ Import (volledige DB als JSON) — geschikt als datasetleverantie richting andere omgevingen.
- **De planningstool** bewaart zijn eigen staat via zijn eigen autosave (aparte sleutels, zelfde origin) en zijn eigen export/import; het dashboard slaat daar niets van op (P2).
- De demo-inhoud (5 bedrijfsfuncties rond VC Rhoon/Noordtunnel/UWW, 7 assets) is vervangbaar via de Databronnen-pagina of JSON-import.

---

## 10. Pagina-overzicht (functionele dekking)

| Pagina | Inhoud |
|---|---|
| **Dashboard** | Vijf domeintegels met RAG-status, kernwaarde en databron-chips; de interactieve driehoek (klikbaar, kleurt mee, met MC-kanspercentages); risico's gegroepeerd per verantwoordelijke |
| **Rule engine** | Config.html-koppeling (import/browseropslag/reset) met per parameter de doorwerking; impactregels; capaciteitsgrenzen; P×Q-tabel per bedrijfsfunctie; asset-normen (afgeleid, met bronvermelding) en wegingen; richtlijnen met ATW-parameters |
| **Trigger engine** | KPI-strook (kritiek/aandacht/getoetst/binnen norm) en de volledige triggerlijst met toelichting, waarde, verantwoordelijke, impact-chips en afgeleid-badges |
| **Integrale planning** | De originele planningstool (iframe) + brugstatus + capaciteitskaart |
| **Databronnen** | Actuele data bewerkbaar: assets (beschikbaarheid, storingen), formatie (actueel), financiën (budget, kostenindex); planningsverwijzing |
| **Simulatie** | Sliders, basis-vs-simulatievergelijking, Monte Carlo met kansen, P-waarden en histogram |

---

## 11. Koppelvlakken (samengevat)

| Koppelvlak | Richting | Formaat / mechanisme |
|---|---|---|
| config.html → rule engine | in | `vwl_scenario_config.json` (vwl-scenario-envelop) of localStorage `vwl-scenarios` |
| Primavera P6 → planningstool | in | P6 XML (Project/WBS/Activity/Relationship/ActivityCodes), via de eigen import van de tool |
| Planningstool → trigger engine | in (read-only) | `iframe.contentWindow`: IPL_MODEL, ipl_eff, IPL_WBS_DIENST, IPL_SHIFT, IPL_CONFIG.fte (via tool-functies) |
| Dashboard ↔ omgeving | in/uit | Volledige DB als JSON (export/import) |
| Planningstool ↔ omgeving | in/uit | Eigen staat-export/-import en P6-export van de tool zelf |

---

## 12. Beveiliging, beperkingen en beheer

- **Lokaal:** alle verwerking gebeurt in de browser; er verlaat niets het apparaat.
- **Origin-afhankelijkheid:** browseropslag (dashboard-DB, tool-autosave, config.html-scenario's) is per origin. Bij verplaatsing van het bestand reist opgeslagen staat niet mee — gebruik daarvoor de JSON-exports.
- **Opslaglimiet:** localStorage ± 5 MB; de DB is klein, de tool-autosave kan bij zeer grote planningen tegen de grens lopen (de tool meldt dit zelf).
- **Corridorherkenning** is naamgebaseerd (wegnummers/tunnelnamen in activiteitnamen); een Primavera ActivityCode voor locatie zou dit robuuster maken (zie § 13).
- **Updatepad planningstool:** nieuwe versie = het IPL_EMBED-blok vervangen door de nieuwe file (JSON-gecodeerd, `</script` → `<\/script`); de brug blijft werken zolang `IPL_MODEL`, `ipl_eff`, `IPL_WBS_DIENST` en `ipl_dashTaakFteRollen` bestaan.
- **Geverifieerd gedrag (testdekking tijdens de bouw):** embed-integriteit (byte-vergelijking), triggerlogica per meldingstype, impactketen conflict→4 domeinen, capaciteitsaggregatie en -grenzen, config-import met normverschuiving, MC-scenario's (basis/stress/herstel), alle renderers.

---

## 13. Doorontwikkelrichtingen (haakjes in de architectuur)

1. **Locatie via ActivityCodes** — corridor-/VC-koppeling op Primavera-codes i.p.v. naamherkenning (de tool leest die codes al).
2. **CMDB-koppeling** — assetbeschikbaarheid periodiek inlezen via JSON/CSV-import per CMDB in plaats van handmatige actualisatie.
3. **Formatie per dienst** — capaciteitsgrenzen voeden vanuit een formatiebron i.p.v. handmatige grenzen.
4. **Triggerhistorie** — tijdreeks van triggers bijhouden voor trendweergave op het dashboard.
5. **Rapportage-export** — triggerset + impact als PDF/Word-managementrapportage in RWS-huisstijl.
6. **Meerdere scenario's naast elkaar** — opgeslagen SIM-sets vergelijken (kolommenvergelijking i.p.v. basis-vs-één-simulatie).

---

*Einde architectuurdocument.*
