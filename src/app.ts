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

import {
  wrapOperationWithMetrics,
  handleIssueOpen,
  logAndComment,
} from './lib/util';

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
};
