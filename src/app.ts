import { Probot } from 'probot';
import { Router } from 'express';
import { exposeMetrics } from '@operate-first/probot-metrics';
import {
  createTokenSecret,
  deleteTokenSecret,
} from '@operate-first/probot-kubernetes';
import {
  numberOfInstallTotal,
  numberOfUninstallTotal,
  numberOfActionsTotal,
} from './lib/counters';

import { wrapOperationWithMetrics } from './lib/util';
import { handleIssueForm } from './eventHandlers/handleIssueForm';
import { handleCommands, parseCommands } from './eventHandlers/handleCommand';

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

  app.on('issues.reopened', async (context: any) => {
    wrapOperationWithMetrics(handleIssueForm(context), {
      install: context.payload.installation.id,
      method: 'handleIssueForm',
    });
  });

  app.on('issues.opened', async (context: any) => {
    wrapOperationWithMetrics(handleIssueForm(context), {
      install: context.payload.installation.id,
      method: 'handleIssueForm',
    });
  });

  app.on('issue_comment.created', async (context: any) => {
    const comment: string = context.payload.comment.body.trim();
    const commands: string[] = parseCommands(comment);

    if (commands.length > 0)
      wrapOperationWithMetrics(handleCommands(context, commands), {
        install: context.payload.installation.id,
        method: 'handleCommands',
      });
  });
};
