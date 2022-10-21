import { Probot } from 'probot';
import { Router } from 'express';
import { exposeMetrics, useCounter } from '@operate-first/probot-metrics';
import {
  APIS,
  createTokenSecret,
  deleteTokenSecret,
  getNamespace,
  getTokenSecretName,
  useApi,
} from '@operate-first/probot-kubernetes';
import parse from '@operate-first/probot-issue-form';

export default (
  app: Probot,
  {
    getRouter,
  }: { getRouter?: ((path?: string | undefined) => Router) | undefined }
) => {
  // Expose additional routes for /healthz and /metrics
  if (!getRouter) {
    app.log.error('Missing router.');
    return;
  }
  const router = getRouter();
  router.get('/healthz', (_, response) => response.status(200).send('OK'));
  exposeMetrics(router, '/metrics');

  // Register tracked metrics
  const numberOfInstallTotal = useCounter({
    name: 'num_of_install_total',
    help: 'Total number of installs received',
    labelNames: [],
  });
  const numberOfUninstallTotal = useCounter({
    name: 'num_of_uninstall_total',
    help: 'Total number of uninstalls received',
    labelNames: [],
  });
  const numberOfActionsTotal = useCounter({
    name: 'num_of_actions_total',
    help: 'Total number of actions received',
    labelNames: ['install', 'action'],
  });
  const operationsTriggered = useCounter({
    name: 'operations_triggered',
    help: 'Metrics for action triggered by the operator with respect to the kubernetes operations.',
    labelNames: ['install', 'operation', 'status', 'method'],
  });

  const createTaskRun = (
    name: string,
    taskType: string,
    context: any,
    extraParams: Array<Record<string, unknown>> = []
  ) => {
    const params = [
      {
        name: 'REPO_NAME',
        value: context.payload['repository']['name'],
      },
      {
        name: 'SECRET_NAME',
        value: getTokenSecretName(context),
      },
      ...extraParams,
    ];
    const taskRunpayload = {
      apiVersion: 'tekton.dev/v1beta1',
      kind: 'TaskRun',
      metadata: {
        generateName: name + '-',
      },
      spec: {
        taskRef: {
          name: `${name}-${taskType}`,
        },
        params,
      },
    };

    const createNamespace = useApi(
      APIS.CustomObjectsApi
    ).createNamespacedCustomObject(
      'tekton.dev',
      'v1beta1',
      getNamespace(),
      'taskruns',
      taskRunpayload
    );

    const metricLabels = {
      install: context.payload.installation.id,
      method: name,
    };

    wrapOperationWithMetrics(createNamespace, metricLabels);
  };

  // Simple callback wrapper - executes an async operation and based on the result it inc() operationsTriggered counted
  const wrapOperationWithMetrics = (callback: Promise<any>, labels: any) => {
    const response = callback
      .then(() => ({
        status: 'Succeeded',
      }))
      .catch(() => ({
        status: 'Failed',
      }));

    operationsTriggered
      .labels({
        ...labels,
        ...response,
        operation: 'k8s',
      })
      .inc();
  };

  app.onAny((context: any) => {
    // On any event inc() the counter
    numberOfActionsTotal
      .labels({
        install: context.payload.installation.id,
        action: context.payload.action,
      })
      .inc();
  });

  app.on('installation.created', async (context: any) => {
    numberOfInstallTotal.labels({}).inc();

    // Create secret holding the access token
    wrapOperationWithMetrics(createTokenSecret(context), {
      install: context.payload.installation.id,
      method: 'createSecret',
    });
  });

  app.on('installation.deleted', async (context: any) => {
    numberOfUninstallTotal.labels({}).inc();

    // Delete secret containing the token
    wrapOperationWithMetrics(deleteTokenSecret(context), {
      install: context.payload.installation.id,
      method: 'deleteSecret',
    });
  });

  app.on('issues.closed', async (context: any) => {
    context.log.info('issue closed');
  });

  app.on('issues.reopened', async (context: any) => {
    context.log.info('issue reopened');
    await handleIssueOpen(context);
  });

  app.on('issues.opened', async (context: any) => {
    context.log.info('issue opened');
    await handleIssueOpen(context);
  });

  app.on('issue_comment.created', async (context: any) => {
    // Simple slash command parser.
    // Parse comment for command "/robozome <arg>", only 1 arg supported
    // Body must only contain the robozome command.
    const comment: string = context.payload.comment.body.trim();
    const regex = /^[/]robozome?\s(\w)+$/g;
    const match = comment.match(regex);
    if (match) {
      const commandWithArgs: string[] = match[0].split(' ');
      if (commandWithArgs.length == 2) {
        switch (commandWithArgs[1]) {
          case 'retry':
            await handleIssueOpen(context);
            break;
          default:
            await logAndComment(
              context,
              'Unrecognized /robozome command, valid commands: [retry]'
            );
            break;
        }
      }
    }
  });

  const logAndComment = async (context: any, msg: string) => {
    context.log.info(msg);
    return context.octokit.issues.createComment(
      context.issue({
        body: msg,
      })
    );
  };

  const handleIssueOpen = async (context: any) => {
    try {
      context.log.info('issue opened');
      const data = await parse(context);

      const issue: string = context.payload.issue.html_url;

      const labels: string[] = context.payload.issue.labels.map(
        (label: typeof context.octokit.label) => {
          return label.name;
        }
      );

      const scriptPath: string = labels
        .filter((l) => l.includes('script'))[0]
        ?.split(':')[1];
      const taskType: string = labels
        .filter((l) => l.includes('task-type'))[0]
        ?.split(':')[1];
      const targetRepo: string = labels
        .filter((l) => l.includes('repo'))[0]
        ?.split(':')[1];

      if (!scriptPath || !taskType || !targetRepo) {
        const msg: string =
          'Automation PR workflow failed. One or more required GH labels not found. Automation PR ' +
          'workflow requires the labels: [script:\\*], [task-type:\\*], and [repo:\\*]. ' +
          `Please double check the issue template corresponding with this issue: ${issue}.\n` +
          'Ensure all required labels are present. Then try again.';
        await logAndComment(context, msg);
        return;
      }

      const payload = JSON.stringify(JSON.stringify(data));

      createTaskRun('robozome-onboarding', taskType, context, [
        {
          name: 'PAYLOAD',
          value: payload,
        },
        {
          name: 'ISSUE_URL',
          value: issue,
        },
        {
          name: 'SCRIPT_PATH',
          value: scriptPath,
        },
      ]);

      const issueComment = context.issue({
        body: 'Thanks for submitting onboarding request!',
      });
      return context.octokit.issues.createComment(issueComment);
    } catch {
      app.log.info(
        'Issue was not created using Issue form template (the YAML ones)'
      );
    }
  };
};
