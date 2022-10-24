import {
  APIS,
  getNamespace,
  getTokenSecretName,
  useApi,
} from '@operate-first/probot-kubernetes';
import { operationsTriggered } from './counters';
import { IncomingMessage } from 'http';

export const issueCommentFromContext = async (context: any, msg: string) => {
  context.octokit.issues.createComment(
    context.issue({
      body: msg,
    })
  );
};

export const createTaskRun = async (
  name: string,
  taskType: string,
  context: any,
  extraParams: Array<Record<string, unknown>> = []
): Promise<{ response: IncomingMessage; body: object }> => {
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

  const res = await useApi(APIS.CustomObjectsApi).createNamespacedCustomObject(
    'tekton.dev',
    'v1beta1',
    getNamespace(),
    'taskruns',
    taskRunpayload
  );

  return res;
};

// Simple callback wrapper - executes an async operation and based on the result it inc() operationsTriggered counted
export const wrapOperationWithMetrics = async (
  callback: Promise<any>,
  labels: any
) => {
  const response = await callback
    .then(() => ({
      status: 'Succeeded',
    }))
    .catch(() => ({
      status: 'Failed',
    }));

  const optick = (status: string) => {
    operationsTriggered
      .labels({
        ...labels,
        status,
        operation: 'k8s',
      })
      .inc();
  };

  optick(response.status);
};
