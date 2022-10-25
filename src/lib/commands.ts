import { handleIssueForm } from '../eventHandlers/handleIssueForm';
import { Context } from 'probot';
import { comments } from './comments';

export const cmdDefault = async (context: Context<'issue_comment.created'>) => {
  const msg = comments.UNRECOGNIZED_COMMAND;
  await context.octokit.issues.createComment(context.issue({ body: msg }));
  context.log.info(msg);
  return;
};

// Add more commands below, create method of form cmdNAME
// Add the command to cmdHandlerMap

const cmdRetry = async (context: Context<'issue_comment.created'>) => {
  return await handleIssueForm(context);
};

// Commands should map to EventHandlers
export const cmdHandlerMap: {
  [id: string]: (context: Context<'issue_comment.created'>) => void;
} = {
  retry: cmdRetry,
};
