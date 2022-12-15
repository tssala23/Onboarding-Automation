import {
  APIS,
  getNamespace,
  getTokenSecretName,
  useApi,
} from '@operate-first/probot-kubernetes';
import { operationsTriggered } from './counters';
import { IncomingMessage } from 'http';
import { Context } from 'probot';

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

export declare type IssueFormPipelineParams = {
  SOURCE_REPO: string;
  TARGET_REPO: string;
  ISSUE_NUMBER: string;
  PAYLOAD: string;
  TASK_TYPE: string;
  SCRIPT_PATH: string;
  WORKING_DIR: string;
  WORKING_BRANCH_PREFIX: string;
  APP_USER_ID: string;
  APP_SLUG: string;
};

export const createPipelineRun = async (
  name: string,
  issuePipeline: IssueFormPipelineParams,
  context: Context<'issue_comment.created'> | Context<'issues.opened'>
): Promise<{ response: IncomingMessage; body: object }> => {
  const params = [
    {
      name: 'SOURCE_REPO',
      value: issuePipeline.SOURCE_REPO,
    },
    {
      name: 'TARGET_REPO',
      value: issuePipeline.TARGET_REPO,
    },
    {
      name: 'ISSUE_NUMBER',
      value: issuePipeline.ISSUE_NUMBER,
    },
    {
      name: 'PAYLOAD',
      value: issuePipeline.PAYLOAD,
    },
    {
      name: 'TASK_TYPE',
      value: issuePipeline.TASK_TYPE,
    },
    {
      name: 'SCRIPT_PATH',
      value: issuePipeline.SCRIPT_PATH,
    },
    {
      name: 'SECRET_NAME',
      value: getTokenSecretName(context),
    },
    {
      name: 'WORKING_DIR',
      value: issuePipeline.WORKING_DIR,
    },
    {
      name: 'WORKING_BRANCH_PREFIX',
      value: issuePipeline.WORKING_BRANCH_PREFIX,
    },
    {
      name: 'APP_USER_ID',
      value: issuePipeline.APP_USER_ID,
    },
    {
      name: 'APP_SLUG',
      value: issuePipeline.APP_SLUG,
    },
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
