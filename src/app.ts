import { Context, Probot } from 'probot';
import { Router } from 'express';
import { exposeMetrics } from '@operate-first/probot-metrics';
import {
  deleteTokenSecret,
  createTokenSecret,
  updateTokenSecret,
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

  app.onAny(async (context) => {
    // On any event inc() the counter
    if ('installation' in context.payload && 'action' in context.payload) {
      numberOfActionsTotal
        .labels({
          install: context.payload.installation?.id,
          action: context.payload.action,
        })
        .inc();
    }
    try {
      await updateTokenSecret(context);
    } catch (e) {
      app.log.error('Failure updating token secret. Trying to create one.');
      await createTokenSecret(context);
    }
  });

  app.on(
    'installation.created',
    async (context: Context<'installation.created'>) => {
      numberOfInstallTotal.labels({}).inc();

      // Create secret holding the access token
      await wrapOperationWithMetrics(createTokenSecret(context), {
        install: context.payload.installation.id,
        method: 'createSecret',
      });
    }
  );

  app.on(
    'installation.deleted',
    async (context: Context<'installation.deleted'>) => {
      numberOfUninstallTotal.labels({}).inc();

      // Delete secret containing the token
      await wrapOperationWithMetrics(deleteTokenSecret(context), {
        install: context.payload.installation.id,
        method: 'deleteSecret',
      });
    }
  );

  app.on('issues.opened', async (context: Context<'issues.opened'>) => {
    await wrapOperationWithMetrics(handleIssueForm(context), {
      install: context.payload.installation?.id,
      method: 'handleIssueForm',
    });
  });

  app.on(
    'issue_comment.created',
    async (context: Context<'issue_comment.created'>) => {
      const comment: string = context.payload.comment.body.trim();
      const commands: string[] = parseCommands(comment);

      if (commands.length > 0)
        await wrapOperationWithMetrics(handleCommands(context, commands), {
          install: context.payload.installation?.id,
          method: 'handleCommands',
        });
    }
  );
};
