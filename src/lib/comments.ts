import { cmdHandlerMap } from './commands';

export const comments = {
  FORM_TASK_FAILED_NO_LABELS: (issue_url: string) =>
    'Automation PR workflow failed. One or more required GH labels not ' +
    'found. Automation PR workflow requires the labels: ' +
    '[script:\\*], [task-type:\\*], and [repo:\\*]. ' +
    'Please double check the issue template corresponding with this issue:' +
    `${issue_url}.\n Ensure all required labels are present. Then try again.`,

  DISPLAY_PAYLOAD: (payload: string) =>
    'The payload that will be generated using this form will be: \n' +
    '```json\n' +
    payload +
    '\n' +
    '```',

  DISPLAY_PAYLOAD_FAIL: 'Could not create payload, invalid issue form.',

  FORM_TASK_CREATION_FAIL:
    'Automation procedure failed, Robozome failed to successfully submit TaskRun job to OCP namespace.',

  FORM_TASK_CREATION_SUCCESS: 'Thanks for submitting onboarding request!',

  UNRECOGNIZED_COMMAND: `Unrecognized robozome command, valid commands: ${Object.keys(
    cmdHandlerMap
  )}`,
};
