import {installDvmLiveSnapshotPatch} from './live-snapshot.js?v=20261008-1000';
import {installDvmImportProgressBridge} from './import-progress-bridge.js?v=20261008-1000';
import {installDvmAnalysisRebuildPerformance} from './dvm-analysis-rebuild-performance.js?v=20261008-1000';
import {installDvmCombiPerformance} from './dvm-combi-performance.js?v=20261008-1000';
import {installTrafficScenarioDefaults} from './traffic-scenario-defaults.js?v=20261008-1000';
import {installNdwLoader} from './ndw-loader.js?v=20261008-1000';
import {installDripOpenFromHistory} from './drip-open-from-history.js?v=20261008-1000';
import {installFaultHubExtensionLoader} from './fault-hub-extension-loader.js?v=20261008-1000';
import {installOpenFaultParentUi} from './open-fault-parent-ui.js?v=20261008-1000';
export * from './signal-forecast-original.js?v=20261008-1000';
export * from './live-filter.js?v=20261008-1000';

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
installOpenFaultParentUi(globalThis);
