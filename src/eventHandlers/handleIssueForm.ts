import parse from '@operate-first/probot-issue-form';
import { createPipelineRun, IssueFormPipelineParams } from '../lib/util';
import { Context } from 'probot';
import { comments } from '../lib/comments';
import { HttpError } from '@kubernetes/client-node';

export const handleIssueForm = async (
  context: Context<'issue_comment.created'> | Context<'issues.opened'>
) => {
  try {
    const data = await parse(context);
    const issue: string = context.payload.issue.html_url;
    const labels: string[] | undefined = context.payload.issue.labels?.map(
      (label) => {
        return label.name;
      }
    );

    if (!labels) {
      const msg: string = comments.FORM_TASK_FAILED_NO_LABELS(issue);
      context.log.error(msg);
      return;
    }

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
      const msg: string = comments.FORM_TASK_FAILED_NO_LABELS(issue);
      await context.octokit.issues.createComment(context.issue({ body: msg }));

      context.log.error(msg);
    }

    // TODO: Add validation for label configs
    // Does repo exist in this org? the task-type? etc.

    const payload = JSON.stringify(JSON.stringify(data));

    const params: IssueFormPipelineParams = {
      SOURCE_REPO: context.payload.repository.name,
      TARGET_REPO: targetRepo,
      ISSUE_NUMBER: context.payload.issue.number,
      PAYLOAD: payload,
      TASK_TYPE: taskType,
      SCRIPT_PATH: scriptPath,
    };

    const res = await createPipelineRun('robozome-onboarding', params, context);

    if (res.response.statusCode != 201) {
      context.log.error(
        'OCP response when creating TaskRun did not return with HTTP 201.'
      );
    }

    const msg = comments.FORM_TASK_CREATION_SUCCESS;
    await context.octokit.issues.createComment(context.issue({ body: msg }));
  } catch (e) {
    const msg = comments.FORM_TASK_CREATION_FAIL;
    await context.octokit.issues.createComment(context.issue({ body: msg }));

    if (e instanceof HttpError && e.body.reason == 'Unauthorized') {
      context.log.error(
        `Encountered error when trying to create PipelineRun. Reason: ${e.body.reason}. ` +
          'Please ensure probot has sufficient access to k8s cluster.'
      );
    } else {
      context.log.error(msg, e);
      throw e;
    }
  }
};
