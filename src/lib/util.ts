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

export const createPipelineRun = async (
  name: string,
  taskType: string,
  context: Context<'issue_comment.created'> | Context<'issues.opened'>,
  extraParams: Array<Record<string, unknown>> = []
): Promise<{ response: IncomingMessage; body: object }> => {
  const params = [
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
    } else {
      context.log.error(
        'Encountered error when trying to verify Probot Secret in namespace.'
      );
    }
  }
};

export const createTokenSecret = async (context: any) => {
  try {
    const res = await useApi(k8s.CoreV1Api).createNamespacedSecret(
      getNamespace(),
      await createSecretPayload(context)
    );
    if (res.response.statusCode == 201)
      context.log.info('Probot secret created successfully.');
    else context.log.info('Probot secret creation failed.');
  } catch (e) {
    context.log.error('Encountered error when trying to create Secret.');
  }
};

const createSecretPayload = async (context: any) => {
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

// TODO: converge update/patch?
export const updateTokenSecret = async (
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
    try {
      await useApi(k8s.CoreV1Api).patchNamespacedSecret(
        secretName,
        namespace,
        await createSecretPayload(context)
      );
      context.log.info('GH Token patched.');
    } catch (e) {
      context.log.error(
        `Encountered Error GH Token was not successfully patched. Error: ${e}`
      );
    }
  }
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
