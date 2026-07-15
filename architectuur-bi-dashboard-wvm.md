# Architectuurdocument — BI Dashboard Wegverkeersmanagement (WVM)

**Bestand:** `bi-dashboard-wvm.html` (single-file HTML-applicatie, ~660 KB)
**Versie:** 6.1 · Peildatum 2026-07-14
**Status:** Basisarchitectuur — dit document is de referentie voor doorontwikkeling
**Motto:** *Rule engine legt vast · Trigger engine monitoort · Dashboard toont*

---

## 1. Doel en positionering

Het BI Dashboard brengt de sturingsinformatie van het WVM-domein samen in één instrument, gebouwd rond drie samenwerkende engines (de "driehoek") die gevoed worden door vijf datadomeinen:

1. **Integrale planning** (GPO · VWM · CIV, via Primavera P6 XML)
2. **Asset prestaties / LCM** (CMDB DVM, Productieplatform, Tunnel/TTI, Facilitair — inclusief bedienketens volgens ISO 55001)
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
| 1. Presentatie | CSS (RWS-huisstijl: #003082 blauw, #F9B000 geel, rijkslint, Segoe UI), topbar met navigatie, zeven pagina-containers | ~13 KB |
| 2. Applicatiescript blok 1 | Configuratie (CFG_DEFAULTS), datamodel (DEFAULT_DB), config-import, planningsbrug, capaciteitsbrug, impact engine, trigger engine, Monte Carlo | ~30 KB |
| 3. Applicatiescript blok 2 | Renderers per pagina, capaciteitskaart, navigatie, JSON-export/-import | ~30 KB |
| 4. Embedded planningstool | `const IPL_EMBED = "<volledige integrale-planning-rws.html>"` — de originele tool als JSON-gecodeerde string, byte-voor-byte identiek aan het bronbestand | ~565 KB |

**Pagina's (tabbladen):** Dashboard · Rule engine · Trigger engine · Assetmanagement · Integrale planning · Databronnen · Simulatie.

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

### 4.6 Assetmanagement-regels (ISO 55001)

De externe DVM-assets die de verkeerscentrale gebruikt (signaalgevers, camera's, DRIP's, detectie, wegkantstations, transmissie) zijn **randvoorwaardelijk** voor kwalitatief goed wegverkeersmanagement aan de burger. De rule engine legt daarom conform ISO 55001 vast:

**Line of sight** — de doorlopende lijn *bedrijfsdoel → bedrijfsfunctie → bedienketen → asset*. Bedienketens (§ 6.5) maken die lijn expliciet en doorrekenbaar.

**Functionele waarde (FW 1–5)** — niet elke signaalgever of camera heeft dezelfde functionele waarde: een CCTV bij een tunnelmond (FW5) is kritiek, dezelfde camera op vrij baanvak (FW2) niet. De FW-klasse bepaalt de regels die gelden.

| AM-regel | Standaard | Doorwerking |
|---|---|---|
| `maxUitstel` per FW-klasse | FW5: 3 · FW4: 6 · FW3: 12 · FW2: 18 · FW1: 24 mnd | Uitsteltrigger per asset zodra het uitgestelde onderhoud de klassegrens overschrijdt |
| `degrPer6Mnd` | 18 % | Extra storingskans per 6 maanden uitstel → ketenberekening én Monte Carlo |
| `conditieDrempel` (NEN 2767) | 4 | Vanaf deze conditiescore degradeert een asset ×1,5 zo snel |
| `spofFw` | 4 | Vanaf deze FW-klasse is redundantie (n+1) vereist; enkelvoudige uitvoering met matige conditie geeft een SPOF-trigger |

Per asset beheert het register aanvullend: `type`, `fw`, `conditie` (NEN 2767, 1–6), `uitstelMnd` en `redundant`.

### 4.7 Storingsregels buitenassets (MSI · CAM · LUS · wisselbord)

De rule engine legt vast hoe **storingsmeldingen** van buitenassets vertaald worden naar beschikbaarheids- én prestatie-impact op het areaal (`DB.storingsRegels`, bewerkbaar op de rule engine-pagina, gebaseerd op de Regels_MSI-template). Vier regeltabellen:

| Tabel | Inhoud | Voorbeeld |
|---|---|---|
| `assetTypen` | Herkenningsregels (veld/operator/waarde) en gewichten per type voor beschikbaarheid en prestatie | MSI: naam bevat "MSI", gewicht 1/1 · camera: 0,35/0,6 |
| `foutcodes` | Basisimpact per foutcode (of omschrijvingspatroon), met severityklasse | 1003 Fatale fout: 100/100 · 1001 lampcircuit: 15/30 |
| `locatieRegels` | Contextfactoren met prioriteit | voor_afrit ×1,6/×1,4 · tussen werkende portalen ×0,8/×0,85 |
| `combiRegels` | Samenloop van storingen: zelfde weg/richting binnen hm-afstand en tijdvenster → extra impact, met caps | MSI 1003 + lus 1006 binnen 0,3 km → +15/+25 |

**Doorrekening (meldingen-import op de pagina Assetmanagement, CSV uit de storingsbron):** per melding 1) assettype classificeren, 2) locatiecontext bepalen (kolom `context`, anders factor 1), 3) foutcode mappen, 4) basisimpact = foutcode-% × typegewicht × locatiefactor (cap 100), 5) combi-regels toepassen, 6) aggregatie per wegnummer op de NDW-MSI-assets: areaalbeschikbaarheid = 100 − Σ(impact × hersteltijd) / (aantal signaalgevers × periode), prestatie idem apart, plus storingen/jr (telt door in de Monte Carlo — P4). Dedupe op weg+richting+hm+strook+code; hersteltijd uit de melding (`duur`) of anders `assets.hw_mttr` uit config.html. Meldingen van niet-MSI-typen (lus, camera, wisselbord) doen mee in de combi-regels.

---

## 5. Integrale planning — de embedded tool en de brug

### 5.1 Embedding (principe P2)

De originele `integrale-planning-rws.html` is als JSON-string (`IPL_EMBED`) in het bestand opgenomen — **byte-voor-byte identiek**, geautomatiseerd geverifieerd. Bij het openen van het tabblad wordt eenmalig een iframe aangemaakt via `iframe.srcdoc = IPL_EMBED`. Een `srcdoc`-iframe erft de origin van het dashboard, waardoor:

- alle functies van de tool intact blijven (P6 XML-import/-export, gelaagde Gantt, cascade-shifts globaal/per mijlpaal/per project, FTE-capaciteit, dienst-/VC-mapping via ActivityCodes, dashboards per dienst en niveau, autosave/restore);
- het dashboard **rechtstreeks en read-only** in het geheugen van de tool kan kijken (`iframe.contentWindow`), zonder één regel van de tool aan te passen.

> **Waarom `srcdoc` en niet een blob-URL:** een blob-URL (`URL.createObjectURL`) erft alleen de origin bij een dashboard dat via **http(s)** geladen is. Bij het lokaal openen van het bestand (**`file://`**, precies de single-file-usecase van P5) krijgt de blob-iframe een eigen opaque origin (`"null"`) die de browser als cross-origin behandelt; de read-only brug wordt dan geblokkeerd en de planning werkt niet door in de driehoek. Een `srcdoc`-iframe erft de origin van de ouder in álle contexten, ook `file://`. De tool blijft byte-voor-byte ongewijzigd (P2) — alleen de montagewijze verschilt.

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

Capaciteit heeft **twee bronnen**; de brug houdt, indien aanwezig, de FTE aan uit een geïmporteerde Primavera-export (`DB.p6Capaciteit`), anders uit de FTE-config van de planningstool zelf (`IPL_CONFIG.fte`, gevuld via het Config-paneel of FTE-templates op de ActivityCode "[VWM] Fase"). Per taak levert `rollen(r)` dus eerst `DB.p6Capaciteit.perActiviteit[r.id]` en valt terug op `ipl_dashTaakFteRollen(r)`. De brug roept verder uitsluitend de eigen functies van de tool aan (`ipl_dashEnsureFte`, `ipl_dashTaakFteRollen`, `ipl_eff`) en aggregeert:

- per **kwartaal** per **dienst** de som van de FTE van actieve taken (effectieve datums);
- per dienst: piek-FTE, piekkwartaal, grens (uit `capgrens`), aantal kwartalen boven de grens;
- totalen: taken met FTE / totaal, cumulatieve FTE-toewijzing;
- `geconfig:false` wanneer nog geen enkele taak FTE-rollen heeft — de UI legt dan uit hoe capaciteit geladen wordt (Config-paneel, templates, of staat-import uit een eerder gebruikte losse tool).

**Weergave:** kaart "Capaciteitsvraag uit de planning" onder het iframe: gestapelde kwartaalgrafiek in dienstkleuren met gestippelde grenslijnen per dienst, plus statustabel (piek/kwartaal/grens/overschrijdingen).

**FTE-capaciteit uit een Primavera-export (`p6ParseCapaciteit`).** De embedded tool leest zelf géén resource-units (P2), maar een P6 APIBusinessObjects-export met `ResourceAssignment`-elementen bevat de FTE per activiteit (`PlannedUnitsPerTime`, per resource/rol). Met de knop *FTE-capaciteit uit P6-export importeren* (op de capaciteitskaart) leest het dashboard die FTE per activiteit uit, gesleuteld op `ActivityObjectId` — dat is exact de `id` van de tool-regels (de tool zet `regel.id = ObjectId`). De brug koppelt ze read-only aan het geladen model (dienst via WBS→`IPL_WBS_DIENST`, datums via `ipl_eff`) en aggregeert per kwartaal/dienst. Zo wordt de **capaciteitsformatie uit dat bestand aangehouden** en werkt hij door in kaart, triggers en Monte Carlo. `DB.p6Capaciteit` is persistent (localStorage/JSON-export) en wordt gewist met *Verwijder P6-FTE*.

> **Let op:** een gewone P6-XML zonder resource-toewijzingen bevat géén FTE (LaborUnits = 0); capaciteit komt dan uit de tool-configuratie of uit de P6-FTE-import hierboven.

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

### 6.5 Assetmanagementtoetsing (ISO 55001)

**Bedienketens — generiek uit de taakanalyse.** Een bedienketen is een *purpose-related function* uit de TNO-abstractiehiërarchie (taakanalyse wegverkeersleiders, 2021): de reeks generieke **objecttypen** (‘physical objects’-laag) die samen een bedienfunctie van de verkeerscentrale mogelijk maken. De ketens zijn daarmee technologie- en locatie-onafhankelijk (‘toekomstbestendig’): een schakel is een objecttype (`camera`, `detectie`, `signalering`, `drip`, `bediensysteem`, `communicatie`, `tunnelbuis`, …, catalogus `OBJECTTYPEN`), niet een specifieke asset. De zeven geseede ketens zijn de zeven purpose-related functions: *sturen en geleiden van verkeer · reis- en route-informatie · ondersteunen bij werk in uitvoering · incidentmanagement · bewaken en bedienen van objecten · gladheidbestrijding · handhaven*. Datamodel: `{id, naam, bedrijfsfunctie, doel, norm, locatie, schakelTypes[]}`; `locatie` is een optionele scope (wegnummer). Rekenregels:

- Elke schakel (objecttype) krijgt de **gemiddelde effectieve beschikbaarheid** van de aanwezige assets van dat type binnen de locatiescope; per asset gecorrigeerd voor storingsfactor én degradatie door uitstel (`factor = 1 + (uitstelMnd/6) × degrPer6Mnd% × (×1,5 vanaf conditiedrempel)`), redundante assets (n+1) tellen kwadratisch.
- **Ketenbeschikbaarheid = serieel product** van de aanwezige schakels, getoetst aan een instelbare ketennorm.
- Een objecttype zonder assets in het (gescopte) areaal is een **niet-geladen schakel**: de keten blijft *onvolledig* en de beschikbaarheid indicatief tot dat type geladen is (bv. via NDW-import). Zo werkt de generieke keten met welk areaal je ook laadt en dringt hij aan op het aanvullen van ontbrekende objecttypen.

**Triggers:** (a) *Bedienketen onder norm* — met de zwakste (objecttype-)schakels en de line of sight (bedrijfsfunctie → bedrijfsdoel); (b) *Bedienketen onvolledig in areaal* — welke objecttypen nog niet geladen zijn; (c) *Uitgesteld onderhoud boven ISO 55001-grens* — per asset; (d) *Single point of failure* — kritieke schakel (FW ≥ spofFw) enkelvoudig met conditie ≥ drempel.

**What-if doorrekening (pagina Assetmanagement).** Kies een asset, stel extra uitstel (maanden) en/of beschikbaarheidsverlies (%-punt) in; het instrument rekent door alle bedienketens heen die het bijbehorende objecttype gebruiken: ketenbeschikbaarheid vóór/na, geraakte bedrijfsfunctie, geraakt **bedrijfsdoel**, en een indicatief risicobedrag (uren onder ketennorm × boetetarief uit config.html).

---

## 7. Vroegtijdig signaleren — de tijdas van de driehoek

Het doel van het instrument is **vroegtijdig signaleren**. De hoofdstukken 4–6 beschrijven een toestandsgerichte toetsing: de trigger engine meldt wat *nu* buiten de regels valt. Vroegtijdigheid vereist een tweede as — de tijd — met vijf vragen per signaal: *wanneer* wordt het manifest (lead time), *welke kant beweegt het op* (trend), *hoe vers is de onderliggende data* (actualiteit), *hoe waarschijnlijk is het* (prognose), en *wat gebeurt er daarna* (opvolging). Dit hoofdstuk legt die tijdas vast als bindend onderdeel van de architectuur. Per paragraaf is de implementatiestatus gemarkeerd: **[v6]** = aanwezig in de huidige tool, **[haakje]** = architectuurafspraak voor de eerstvolgende iteratie.

### 7.1 Lead time: elke trigger krijgt een T-min

Elke trigger krijgt naast severity een **lead-time-klasse**, afgeleid van het moment waarop het risico manifest wordt:

| Klasse | Manifestatie | Sturingskarakter |
|---|---|---|
| **T1 — acuut** | < 6 maanden | Operationeel: mitigeren, niet meer voorkomen |
| **T2 — nabij** | 6–12 maanden | Tactisch: bijsturen kan nog (herplannen, inhuur, onderhoud naar voren) |
| **T3 — horizon** | > 12 maanden | Strategisch: structurele maatregel mogelijk (formatie, contract, vervanging) |

Rekenregels per triggertype:

- **Planningssignalen [v6, klasse toe te kennen — haakje]:** de manifestatiedatum is al bekend (start conflictvenster, piekkwartaal, mijlpaal); lead time = manifestatiedatum − peildatum. De bestaande maar ongebruikte configparameter `kpi.planningshorizon_maanden` wordt de grens waarbinnen een planningssignaal ook een **operationele** melding wordt.
- **Ketendegradatie [haakje]:** kruisdatum-extrapolatie. Bij het huidige degradatietempo (`degrPer6Mnd`, conditieafhankelijk) is de datum berekenbaar waarop de ketenbeschikbaarheid de norm kruist: `T_kruis = t_nu + 6 × (besch_keten − norm) / (Δbesch per 6 mnd)`. De trigger meldt dan niet "onder norm" maar "**zakt naar verwachting in maand X onder de norm**" — het archetype van een vroegsignaal.
- **Formatie [haakje]:** kruisdatum uit de bezettingstrend (§ 7.2) plus bekende uitstroom (pensioendata, aflopende contracten zodra die als databron beschikbaar zijn).
- **Financiën [haakje]:** uitputtingstempo: verwacht overschrijdingsmoment = budget / (gerealiseerd + verplicht per maand).

Weergave: lead-time-badge op elke trigger; het dashboard groepeert per verantwoordelijke **binnen** lead-time-klasse, zodat T3-signalen niet ondersneeuwen onder acuut rood.

### 7.2 Trend en historie: signaleren op de afgeleide

Een dalende lijn is een eerder signaal dan een gekruiste norm. De architectuur legt daarom een **snapshotmodel** vast:

- **Wat:** per peildatum de kerngrootheden — bezetting% per bedrijfsfunctie, ketenbeschikbaarheid per bedienketen, conditiescore en uitstel per asset, budgetuitputting, triggeraantallen per severity, MC-kansen (P_fte, P_budget, P_asset).
- **Wanneer:** bij elke wijziging van de peildatum plus een handmatige "snapshot nu"-actie; frequentie-eis: minimaal maandelijks.
- **Waar:** `DB.historie[]` (localStorage; ± 5 jaar maandsnapshots blijft ruim binnen de opslaglimiet), exporteerbaar in de bestaande JSON-envelop.
- **Detectieregels (trend-triggers):** (a) drie opeenvolgende dalingen van een kerngrootheid → aandachtstrigger, óók als de norm nog niet geraakt is; (b) hellingsdrempel: daling > x %-punt per kwartaal → severity één klasse hoger; (c) kruisdatum-extrapolatie voedt § 7.1.
- **Weergave:** sparkline per domeintegel en per keten; trendpijl (↗→↘) naast elke kerngrootheid.

Status: **[haakje]** — het datamodel (§ 10) reserveert `historie[]`; detectieregels zoals hierboven zijn normatief voor de implementatie.

### 7.3 Data-actualiteit: verouderde data is zélf een vroegsignaal

Vroegtijdig signaleren op oude data is schijnzekerheid. Daarom:

| Datadomein | Peildatumregistratie | Maximale ouderdom (norm) |
|---|---|---|
| Integrale planning | bestandsnaam + laaddatum **[v6]** | 1 maand |
| Assets / CMDB | per-bron peildatum **[haakje]** | 1 maand |
| Formatie | peildatum **[haakje]** | 1 maand |
| Financiën | peildatum **[haakje]** | 1 kwartaal |
| Configuratie (regels) | bronlabel **[v6]** + exportdatum **[haakje]** | 6 maanden |

**Staleness-trigger [haakje]:** overschrijdt een bron zijn maximale ouderdom, dan vuurt een aandachtstrigger *op het domein zelf*, geadresseerd aan de broneigenaar ("CMDB-stand is 4 maanden oud; ketenberekeningen zijn indicatief"). Alle triggers die op de verouderde bron rusten krijgen een onzekerheidsmarkering in plaats van een harde severity.

### 7.4 Prognosedrempels: de Monte Carlo als triggerbron

De MC is in v6 een weergave; als vroegsignaalbron krijgt hij drempels **[haakje]**:

| Prognose | Aandacht | Kritiek | Geadresseerde |
|---|---|---|---|
| P(FTE-tekort) | > 40 % | > 70 % | Afdelingshoofd VWM |
| P(budgetoverschrijding, incl. boete + planningsimpact) | > 40 % | > 60 % | Businesscontroller WVM |
| P(asset extra onder norm) | > 25 % | > 50 % | Assetmanager CIV/PPO |
| P90 contractboete | > 2 % budget | > 5 % budget | Businesscontroller WVM |

Deze triggers melden een *verwachting*, expliciet gelabeld ("prognose, n runs, parameters …"), vóórdat de toestandstoetsing iets ziet. **Anti-flapper-regels:** hysterese (aan bij drempel, uit bij drempel − 10 %-punt) en een minimum van 10.000 runs voor triggering, zodat samplingruis geen alarmen genereert.

### 7.5 Opvolging en escalatie: een signaal zonder afspraak is een lamp

Vroegsignalering werkt alleen met een gesloten lus. De architectuur legt vast **[haakje]**:

- **Statusmodel per trigger:** `nieuw → gezien → in mitigatie → opgelost / geaccepteerd (met motivatie en houdbaarheidsdatum)`. Statusregistratie in `DB.triggerStatus[]`, gekoppeld op een stabiele triggersleutel (type + object), zodat status een hertoetsing overleeft.
- **Reactietermijnen:** kritiek = kennisname ≤ 1 week, mitigatieplan ≤ 1 maand; aandacht = kennisname ≤ 1 maand. Termijnen zijn regels in de rule engine.
- **Tijdgestuurde escalatie:** een aandachtstrigger die langer dan zijn termijn op `nieuw` staat, escaleert automatisch één severity én één managementlaag (de bestaande `escalatie.*`-parameters krijgen hiermee een tweede, tijdgebonden betekenis). Een *geaccepteerd* risico waarvan de houdbaarheidsdatum verstrijkt, keert terug als `nieuw`.
- **Pushkanaal:** periodiek (wekelijks) overzicht per verantwoordelijke — nieuwe signalen, verlopen termijnen, trendwijzigingen — als exporteerbaar rapport; technisch haakje: hetzelfde patroon als de bestaande Apps Script-monitors (HTML-mail per rol).

### 7.6 LCM en restlevensduur: het vroegste signaal van allemaal

Het assetregister wordt uitgebreid met **[haakje]**: `bouwjaar`, `verwachteLevensduur` (per type), en daaruit `vervangingsjaar`. Regels:

- **Vervangingshorizon-trigger:** vervangingsjaar − doorlooptijd vervangingsproject (per type, bv. TTI 4 jaar, camera-areaal 1 jaar) < peiljaar → trigger, jaren van tevoren.
- **Koppeling met de planning:** de trigger engine zoekt in het geladen P6-model naar een vervangings-/renovatieactiviteit voor het asset (tokenmatch); ontbreekt die → **"vervanging niet geborgd in de integrale planning"** — de meest waardevolle kruising van de datadomeinen die het instrument kan maken.
- **Degradatiecurves per assettype** vervangen op termijn de ene generieke `degrPer6Mnd` (elektronica degradeert anders dan civiel), met de huidige parameter als fallback.

### 7.7 Drempelbeheer: vroeg signaleren zonder alarmmoeheid

Vroegsignalering faalt op twee manieren: te laat (drempels te ruim) of genegeerd (te veel rood). Daarom **[haakje]**:

- **Eigenaarschap:** elke drempel (severity-grenzen, MC-drempels, lead-time-grenzen, AM-klassegrenzen) heeft een eigenaar — dezelfde verantwoordelijke die de bijbehorende triggers ontvangt.
- **Kalibratiecyclus:** halfjaarlijkse evaluatie op twee maatstaven: gemiste signalen (incident zonder voorafgaande trigger) en loze signalen (trigger zonder opvolgingsnoodzaak). Beide worden bijgehouden via het statusmodel (§ 7.5: `geaccepteerd` zonder gevolg telt als loos).
- **Signaalbudget:** richtwaarde maximaal ~10 openstaande kritieke triggers per verantwoordelijke; structureel erboven is een kalibratie- of capaciteitssignaal richting het management, geen reden om drempels stilzwijgend te verruimen.

### 7.8 Meetbare bedrijfsdoelen: het einde van de line of sight

De line of sight eindigt in v6 bij een doel als tekst. Om afglijden op doelniveau vroegtijdig te zien, krijgt elk bedrijfsdoel een indicator **[haakje]**: `doelen: [{id, naam, indicator, norm, actueel, bron, peildatum}]` — bv. *Vlot en veilig verkeer*: voertuigverliesuren-index; *Beschikbaarheid netwerk*: gerealiseerde beschikbaarheid hoofdwegennet; *Informatievoorziening*: actualiteit/juistheid reisinformatie. De what-if-doorrekening (§ 6.5) en de impact engine rapporteren dan niet alleen *welk* doel geraakt wordt, maar *hoeveel* de indicator naar verwachting beweegt — en de doelen zelf worden trendmatig bewaakt (§ 7.2).

### 7.9 Samenvatting en prioritering

| § | Onderdeel | Status | Prioriteit |
|---|---|---|---|
| 7.1 | Lead-time-klassen + kruisdatums | haakje | **1** — maakt bestaande triggers vroegtijdig |
| 7.2 | Historie + trend-triggers | haakje | **2** — signaleren op de afgeleide |
| 7.4 | MC-prognosedrempels | haakje | **3** — kleine ingreep, groot effect |
| 7.3 | Data-actualiteit + staleness | haakje | 4 |
| 7.5 | Statusmodel + escalatie + push | haakje | 5 |
| 7.6 | LCM/restlevensduur + planningsborging | haakje | 6 |
| 7.8 | Doel-indicatoren | haakje | 7 |
| 7.7 | Drempelbeheer (proces) | doorlopend | — |

---

## 8. Monte Carlo — prognose op de uitgangspunten

`runMC(n, params)` met n = 2.000 (dashboard-widget) tot 50.000 runs (simulatiepagina). Per run wordt één jaar gesimuleerd:

| Grootheid | Verdeling |
|---|---|
| Verzuim | Normaal(μ = verzuimparameter, σ = 1,6), afgekapt op ≥ 0 |
| Onderhoudskosten | Normaal(P×Q × kostenindex, σ = 4 %) |
| Storingen per asset | Poisson(storingen/jr × storingsfactor × werkzaamhedenopslag × degradatiefactor uitgesteld onderhoud) |
| Hersteltijd per storing | `assets.hw_mttr` of `assets.sw_mttr` × U(0,6–1,4) |
| Planningsimpact | Extra fte-vraag en meerkosten uit conflicten en capaciteitsoverschrijdingen × U(0,7–1,3) |

Uitkomsten: kans op FTE-tekort, kans op budgetoverschrijding (kosten + boete + planningsimpact > budget), kans dat een asset dat nú binnen norm valt eronder zakt; P10/P50/P90 voor FTE-gat, budgetgat en contractboete; histogram van een samengestelde risicoscore (blauw < P50, oranje P50–P90, rood > P90).

---

## 9. Simulatie — "alle parameters inzichtelijk" (principe P4)

Vijf sliders (verzuim %, formatie Δ%, kostenindex, budget Δ%, storingsfactor) vormen samen `SIM`; zolang die actief is toont de topbar de badge *Simulatiemodus actief* en rekent de héle driehoek (triggers, tegels, impact, MC) met de simulatiewaarden. Tabel *basis vs simulatie* toont de verschuiving in kritiek/aandacht-aantallen. Knoppen: *Config-scenario overnemen* (sim.\*-factoren uit config.html) en *Terug naar basis*.

---

## 10. Datamodel en persistentie

```
DB = {
  meta: { versie, peildatum },
  params: { kostenIndex },                    // lokale basisparameter
  config: { …156 sleutels… },                 // config.html-regels (plat)
  configBron: '…',                            // herkomstlabel
  richtlijnen: [ {id, naam, oms} ],
  functies: [ {id, naam, doel, systemen[], benodigdFte, actueelFte,
               assets[], onderhoudEur, richtlijnen[]} ],
  assets:   [ {id, naam, cmdb, type, besch, storingenJr, locatie, weging,
               fw, conditie, uitstelMnd, redundant} ],
  ketens:   [ {id, naam, bedrijfsfunctie, doel, norm, locatie, schakelTypes[]} ], // generiek (taakanalyse)
  amRegels: { maxUitstel{FW1..FW5}, degrPer6Mnd, conditieDrempel, spofFw },
  // gereserveerd voor de tijdas (hoofdstuk 7):
  historie:      [ {peildatum, kerngrootheden…} ],        // § 7.2
  bronPeildata:  { assets, formatie, financien, config },  // § 7.3
  triggerStatus: [ {sleutel, status, sinds, motivatie} ],  // § 7.5
  doelen:        [ {id, naam, indicator, norm, actueel} ], // § 7.8
  financien:{ budgetJr },
  impact:   { fteOpslagConflict, storingsOpslag, fteKostenJr,
              piekOpslagPct, shiftKostenPctMnd },
  capgrens: { GPO, CIV, VWM, PPO, Regio }
}
```

- **Opslag:** localStorage-sleutel `bidash_wvm_v3`; migratielogica (`migreerDB`) vult ontbrekende blokken (config/impact/capgrens/amRegels/ketens/storingsRegels) en ISO 55001-assetvelden aan bij laden van oudere staten.
- **Uitwisseling:** topbar-knoppen ⭳ Export / ⭱ Import (volledige DB als JSON) — geschikt als datasetleverantie richting andere omgevingen.
- **De planningstool** bewaart zijn eigen staat via zijn eigen autosave (aparte sleutels, zelfde origin) en zijn eigen export/import; het dashboard slaat daar niets van op (P2).
- **Leeg startmodel:** `DEFAULT_DB` bevat géén demo-inhoud — `functies`, `assets` en `ketens` zijn leeg en `budgetJr` is 0. De regels (config, impactregels, `amRegels`, `storingsRegels`, `capgrens`) en de wettelijke richtlijnen staan wel klaar. Data komt binnen via de NDW-import en storingsmeldingen-import (pagina Assetmanagement), de Databronnen-pagina of een volledige JSON-import. De knop *Leeg model* op Databronnen (`legModel()`) wist alle actuele data maar laat de regels staan — bedoeld om schoon te testen met eigen data.

---

## 11. Pagina-overzicht (functionele dekking)

| Pagina | Inhoud |
|---|---|
| **Dashboard** | Vijf domeintegels met RAG-status, kernwaarde en databron-chips; de interactieve driehoek (klikbaar, kleurt mee, met MC-kanspercentages); risico's gegroepeerd per verantwoordelijke |
| **Rule engine** | Config.html-koppeling (import/browseropslag/reset) met per parameter de doorwerking; impactregels; capaciteitsgrenzen; P×Q-tabel per bedrijfsfunctie; asset-normen (afgeleid, met bronvermelding) en wegingen; richtlijnen met ATW-parameters |
| **Trigger engine** | KPI-strook (kritiek/aandacht/getoetst/binnen norm) en de volledige triggerlijst met toelichting, waarde, verantwoordelijke, impact-chips en afgeleid-badges |
| **Assetmanagement** | Bedienketens met schakelschema (beschikbaarheid, FW, conditie, n+1, uitstel per schakel) en line of sight naar functies en doelen; what-if doorrekening; NDW-import van areaalgegevens (MSI/DRIP per wegnummer); storingsmeldingen-import met doorrekening volgens § 4.7; AM-register met bewerkbare FW/conditie/uitstel/redundantie |
| **Integrale planning** | De originele planningstool (iframe) + brugstatus + capaciteitskaart |
| **Databronnen** | Actuele data bewerkbaar: assets (beschikbaarheid, storingen), formatie (actueel), financiën (budget, kostenindex); planningsverwijzing |
| **Simulatie** | Sliders, basis-vs-simulatievergelijking, Monte Carlo met kansen, P-waarden en histogram |

---

## 12. Koppelvlakken (samengevat)

| Koppelvlak | Richting | Formaat / mechanisme |
|---|---|---|
| config.html → rule engine | in | `vwl_scenario_config.json` (vwl-scenario-envelop) of localStorage `vwl-scenarios` |
| NDW open data → assetregister | in | MSI-snapshot (TMIS VMS-XML) en DRIP-publicatie (DATEX II v3-XML), ook gezipt; import op de pagina Assetmanagement, aggregatie per wegnummer (= corridor-token), beheervelden blijven bij herimport behouden |
| Storingsbron → assetregister | in | Storingsmeldingen als CSV (foutcode, omschrijving, asset, type, wegnummer, richting, hm, strook, datum; optioneel context en duur); doorgerekend volgens de storingsregels (§ 4.7) naar beschikbaarheid/prestatie/storingen per weg |
| Primavera P6 → planningstool | in | P6 XML (Project/WBS/Activity/Relationship/ActivityCodes), via de eigen import van de tool |
| Planningstool → trigger engine | in (read-only) | `iframe.contentWindow`: IPL_MODEL, ipl_eff, IPL_WBS_DIENST, IPL_SHIFT, IPL_CONFIG.fte (via tool-functies) |
| Primavera-export → capaciteitsbrug | in | P6 APIBusinessObjects-XML met `ResourceAssignment`; FTE per activiteit (`PlannedUnitsPerTime`) gekoppeld op `ActivityObjectId = regel.id`, aangehouden in `DB.p6Capaciteit` |
| Dashboard ↔ omgeving | in/uit | Volledige DB als JSON (export/import) |
| Planningstool ↔ omgeving | in/uit | Eigen staat-export/-import en P6-export van de tool zelf |

---

## 13. Beveiliging, beperkingen en beheer

- **Lokaal:** alle verwerking gebeurt in de browser; er verlaat niets het apparaat.
- **Origin-afhankelijkheid:** browseropslag (dashboard-DB, tool-autosave, config.html-scenario's) is per origin. Bij verplaatsing van het bestand reist opgeslagen staat niet mee — gebruik daarvoor de JSON-exports.
- **Opslaglimiet:** localStorage ± 5 MB; de DB is klein, de tool-autosave kan bij zeer grote planningen tegen de grens lopen (de tool meldt dit zelf).
- **Corridorherkenning** is naamgebaseerd (wegnummers/tunnelnamen in activiteitnamen); een Primavera ActivityCode voor locatie zou dit robuuster maken (zie hoofdstuk 14).
- **Updatepad planningstool:** nieuwe versie = het IPL_EMBED-blok vervangen door de nieuwe file (JSON-gecodeerd, `</script` → `<\/script`); de brug blijft werken zolang `IPL_MODEL`, `ipl_eff`, `IPL_WBS_DIENST` en `ipl_dashTaakFteRollen` bestaan.
- **Geverifieerd gedrag (testdekking tijdens de bouw):** embed-integriteit (byte-vergelijking), triggerlogica per meldingstype, impactketen conflict→4 domeinen, capaciteitsaggregatie en -grenzen, config-import met normverschuiving, MC-scenario's (basis/stress/herstel), alle renderers.

---

## 14. Doorontwikkelrichtingen

De **primaire roadmap is hoofdstuk 7** (vroegtijdig signaleren), in de prioriteitsvolgorde van § 7.9. Daarnaast blijven de volgende richtingen staan:

1. **Locatie via ActivityCodes** — corridor-/VC-koppeling op Primavera-codes i.p.v. naamherkenning (versterkt ook § 7.6, planningsborging van vervangingen).
2. **CMDB-koppeling** — periodieke import van areaalgegevens per bron; voorwaarde voor de actualiteitsnormen van § 7.3. Eerste stap gerealiseerd: NDW-XML-import voor MSI en DRIP's (pagina Assetmanagement, geaggregeerd per wegnummer); volgende stap is beschikbaarheids-/storingsdata per CMDB.
3. **Formatie per dienst** — capaciteitsgrenzen voeden vanuit een formatiebron; voedt tevens de kruisdatums van § 7.1.
4. **Rapportage-export** — triggerset + impact als managementrapportage in RWS-huisstijl; wordt het pushkanaal van § 7.5.
5. **Meerdere scenario's naast elkaar** — opgeslagen SIM-sets vergelijken.

---

*Einde architectuurdocument.*
