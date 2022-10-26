import {
  APIS,
  getNamespace,
  getTokenSecretName,
  useApi,
} from '@operate-first/probot-kubernetes';
import { operationsTriggered } from './counters';
import { IncomingMessage } from 'http';
import { Context } from 'probot';

export const createPipelineRun = async (
  name: string,
  taskType: string,
  context: Context<'issue_comment.created'> | Context<'issues.opened'>,
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
    {
      name: 'TASK_TYPE',
      value: taskType,
    },
    ...extraParams,
  ];

  const pipelineRunpayload = {
    apiVersion: 'tekton.dev/v1beta1',
    kind: 'PipelineRun',
    metadata: {
      generateName: name + '-',
    },
    spec: {
      pipelineRef: {
        name: 'issue-form-pipeline',
      },
      params,
      workspaces: [
        {
          name: 'utility-scripts',
          configMap: {
            name: 'utility-scripts',
            defaultMode: 110,
          },
        },
        {
          name: 'shared-data',
          emptyDir: {},
        },
      ],
    },
  };

  return await useApi(APIS.CustomObjectsApi).createNamespacedCustomObject(
    'tekton.dev',
    'v1beta1',
    getNamespace(),
    'pipelineruns',
    pipelineRunpayload
  );
};

// Simple callback wrapper - executes an async operation and based on the result it inc() operationsTriggered counted
export const wrapOperationWithMetrics = async (
  callback: Promise<any>,
  labels: { install: number | undefined; method: string }
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
