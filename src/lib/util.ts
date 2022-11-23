import {
  APIS,
  getNamespace,
  getTokenSecretName,
  useApi,
} from '@operate-first/probot-kubernetes';
import { operationsTriggered } from './counters';
import { IncomingMessage } from 'http';
import { Context } from 'probot';
import * as k8s from '@kubernetes/client-node';
import { HttpError } from '@kubernetes/client-node';
import { InstallationAccessTokenAuthentication } from '@octokit/auth-app';

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

export const verifySecret = async (context: any) => {
  try {
    const secretName = getTokenSecretName(context);
    const namespace = getNamespace();

    const appSecret = await useApi(k8s.CoreV1Api).readNamespacedSecret(
      secretName,
      namespace
    );
    if (!appSecret) {
      await createTokenSecret(context);
    }

    // Ensure secret is upto date
    const expiry_date = new Date(
      appSecret.body?.metadata?.annotations?.expiresAt || 0
    );
    await updateTokenSecret(context, expiry_date, secretName, namespace);
  } catch (e) {
    if (e instanceof HttpError && e.body.reason == 'NotFound') {
      context.log.info('Did not find Probot Secret in namespace, creating...');
      await createTokenSecret(context);
    }
    if (e instanceof HttpError && e.body.reason == 'Unauthorized') {
      context.log.error(
        `Encountered error when trying to verify Probot Secret in namespace. Reason: ${e.body.reason}. ` +
          'Please ensure probot has sufficient access to k8s cluster.'
      );
    } else {
      context.log.error(
        `Encountered error when trying to verify Probot Secret in namespace.`
      );
      throw e;
    }
  }
};

// Use instead of probot-kubernetes implementation to add additional logging.
export const createTokenSecret = async (context: any) => {
  const res = await useApi(k8s.CoreV1Api).createNamespacedSecret(
    getNamespace(),
    await createSecretPayload(context)
  );
  if (res.response.statusCode == 201)
    context.log.info('Probot secret created successfully.');
  else context.log.info('Probot secret creation failed.');
};

// Use instead of probot-kubernetes implementation, as we want to be able to
// create secrets outside of "installation.created" event contexts.
const createSecretPayload = async (context: any): Promise<k8s.V1Secret> => {
  const appAuth = (await context.octokit.auth({
    type: 'installation',
  })) as InstallationAccessTokenAuthentication;
  const orgName = context.payload.organization.login;
  return {
    metadata: {
      name: getTokenSecretName(context),
      labels: {
        'app.kubernetes.io/created-by': 'probot',
      },
      annotations: {
        expiresAt: appAuth.expiresAt,
      },
    },
    stringData: {
      token: appAuth.token,
      orgName: orgName,
    },
  } as k8s.V1Secret;
};

// Use instead of probot-kubernetes implementation
// Add additional logging, and remove unneeded return
// Add additional headers for successful patch
const updateTokenSecret = async (
  context: any,
  expiry_date: Date,
  secretName: string,
  namespace: string
) => {
  const current_date = new Date();
  const expiration_threshold = 5 * 60000;
  const tokenExpired =
    expiry_date.getTime() < current_date.getTime() + expiration_threshold; // 5 minutes in milliseconds
  if (tokenExpired) {
    context.log.info('GH Token expired, updating...');
    const secret = await createSecretPayload(context);

    // To avoid: https://github.com/kubernetes-client/javascript/issues/862
    const opts = {
      headers: {
        'Content-Type': 'application/merge-patch+json',
      },
    };

    await useApi(k8s.CoreV1Api).patchNamespacedSecret(
      secretName,
      namespace,
      secret,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      opts
    );
    context.log.info('GH Token patched.');
  }
};
