import {installDvmLiveSnapshotPatch} from './live-snapshot.js';
import {installDvmImportProgressBridge} from './import-progress-bridge.js';
import {installDvmAnalysisRebuildPerformance} from './dvm-analysis-rebuild-performance.js';
import {installDvmCombiPerformance} from './dvm-combi-performance.js';
import {installTrafficScenarioDefaults} from './traffic-scenario-defaults.js';
import {installNdwLoader} from './ndw-loader.js';
import {installDripOpenFromHistory} from './drip-open-from-history.js';
import {installFaultHubExtensionLoader} from './fault-hub-extension-loader.js';
export * from './signal-forecast-original.js';
export * from './live-filter.js';

// Eerst stabiliteit van de bron-specifieke import. De live-overzichtsfilters
// zijn tijdelijk niet actief: ze vergrootten de kolomset van de geheugenarme
// Excel-import en voegden tijdens live doorrekening extra synchronisatiewerk toe.
// De filtermodules blijven in de repository zodat ze later gecontroleerd kunnen
// worden teruggezet zonder de bronmomentopname of opgeslagen parameters te verliezen.
installDvmCombiPerformance(globalThis);
installDvmLiveSnapshotPatch(globalThis);
installDvmImportProgressBridge(globalThis);
installDvmAnalysisRebuildPerformance(globalThis);
installTrafficScenarioDefaults(globalThis);
installNdwLoader(globalThis);
installDripOpenFromHistory(globalThis);
installFaultHubExtensionLoader(globalThis);
