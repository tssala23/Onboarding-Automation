import parse from '@operate-first/probot-issue-form';
import { APIS, getNamespace, getTokenSecretName, useApi } from '@operate-first/probot-kubernetes';
import { operationsTriggered } from './counters'

export const logAndComment = async (context: any, msg: string) => {
  context.log.info(msg);
  return context.octokit.issues.createComment(
    context.issue({
      body: msg,
    })
  );
};

export const handleIssueOpen = async (context: any) => {
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
    context.log.info(
      'Issue was not created using Issue form template (the YAML ones)'
    );
  }
};

export const createTaskRun = (
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
export const wrapOperationWithMetrics = (callback: Promise<any>, labels: any) => {
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


