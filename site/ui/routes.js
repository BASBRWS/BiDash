import '../core/load-progress.js';

export const GROUPS=[
 {id:'overview',label:'Overzicht',icon:'◈',desc:'Dienstverlening, capaciteit en risico’s in samenhang.',items:[['overview','Integraal overzicht','native','overview']]},
 {id:'assets',label:'Assetmanagement',icon:'▦',desc:'Eén register, open storingen en de gevolgen op de weg.',items:[['assets','Assetregister','native','assets'],['faults','Open storingen','native','faults'],['roads','Wegdelen','dvm','wegdelen'],['signalForecast','Signaalgeverprognose & WIS','dvm','prognose'],['lifecycle','Levensduur & DRIP','dvm','drips'],['chains','Bedienketens','bi','am']]},
 {id:'services',label:'Dienstverlening',icon:'◎',desc:'Van assetuitval naar dienstverlening, verkeerskosten en verantwoording.',items:[['services','Dienstimpact','dvm','overzicht'],['costs','Verkeerskosten','native','costs'],['area','Gebied & knelpunten','dvm','gebied'],['region','Regio','dvm','rapport'],['calculation','Rekenverslag','dvm','berekening'],['memos','Memo’s & verdieping','dvm','wegdeelverslag']]},
 {id:'planning',label:'Planning',icon:'▤',desc:'Tijdlijn, afhankelijkheden en capaciteit uit jouw plannings-XML.',items:[['planning','Tijdlijn','planning','s16'],['planningDash','Planningsdashboard','planning','s11'],['planningBudget','Project & budget','planning','s17'],['planningViews','Dashboardbeheer','planning','s19']]},
 {id:'organisation',label:'Formatie & contracten',icon:'◇',desc:'Beschikbare mensen, bedrijfsfuncties, contracten en budget.',items:[['organisation','Formatie & functies','native','organisation'],['vwm','VWM-formatiemodel','bi','vwm'],['civ','CIV-formatiemodel','bi','civ'],['contracts','Contracten & budget','bi','dash'],['businessData','Bedrijfsgegevens','bi','data']]},
 {id:'rules',label:'Regels & signalen',icon:'⚑',desc:'Eén eigenaar per regel en expliciete koppelingen tussen diensten en functies.',items:[['signals','Signalen','native','signals'],['rules','Dienstkoppelingen','native','rules'],['impactRules','Impactregels','dvm','regels'],['businessRules','Organisatieregels','bi','rules']]},
 {id:'scenarios',label:'Scenario’s',icon:'↗',desc:'Onzekerheid en toekomstverwachting gescheiden van de actuele situatie.',items:[['scenarios','Simulaties kiezen','native','scenarios'],['businessMC','Formatie & contracten','bi','sim']]},
 {id:'data',label:'Data & export',icon:'⇅',desc:'Lokale bestanden laden, bronbeheer, kwaliteitscontrole en selectieve back-ups.',items:[['data','Laden & exporteren','native','data'],['sources','DVM-bronbeheer','dvm','datasets'],['quality','Kwaliteit','native','quality']]}
];
export const ROUTES=Object.fromEntries(GROUPS.flatMap(g=>g.items.map(([id,label,engine,target])=>[id,{id,label,engine,target,group:g.id}])));
ROUTES.faultCalculation={id:'faultCalculation',label:'Storingsdoorrekening',engine:'dvm',target:'storingen',group:'assets'};
export function resolveRoute(id){return ROUTES[id]||ROUTES.overview;}
