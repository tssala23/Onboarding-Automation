import { useCounter } from '@operate-first/probot-metrics';

export const numberOfInstallTotal = useCounter({
  name: 'num_of_install_total',
  help: 'Total number of installs received',
  labelNames: [],
});

export const numberOfUninstallTotal = useCounter({
  name: 'num_of_uninstall_total',
  help: 'Total number of uninstalls received',
  labelNames: [],
});

export const numberOfActionsTotal = useCounter({
  name: 'num_of_actions_total',
  help: 'Total number of actions received',
  labelNames: ['install', 'action'],
});

export const operationsTriggered = useCounter({
  name: 'operations_triggered',
  help: 'Metrics for action triggered by the operator with respect to the kubernetes operations.',
  labelNames: ['install', 'operation', 'status', 'method'],
});
