import parse from '@operate-first/probot-issue-form';
import { createTaskRun, issueCommentFromContext } from '../lib/util';

export const handleIssueForm = async (context: any) => {
  try {
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
      await issueCommentFromContext(context, msg);
      context.log.error(msg);
    }

    const payload = JSON.stringify(JSON.stringify(data));

    const res = await createTaskRun('robozome-onboarding', taskType, context, [
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

    if (res.response.statusCode != 201) {
      const msg =
        'OCP response when creating TaskRun returned with a non successful response.';
      context.log.error(msg);
    }

    const msg = 'Thanks for submitting onboarding request!';
    await issueCommentFromContext(context, msg);
  } catch (e) {
    const msg =
      'Automation procedure failed, Robozome failed to successfully submit TaskRun job to OCP namespace.';
    await issueCommentFromContext(context, msg);
    context.log.error(msg);
    throw e;
  }
};
