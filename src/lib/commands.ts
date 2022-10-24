import { issueCommentFromContext } from './util';
import { handleIssueForm } from '../eventHandlers/handleIssueForm';

export const cmdDefault = async (context: any) => {
  const msg = `Unrecognized robozome command, valid commands: ${Object.keys(
    cmdHandlerMap
  )}`;
  await issueCommentFromContext(context, msg);
  context.log.info(msg);
  return;
};

// Add more commands below, create method of form cmdNAME
// Add the command to cmdHandlerMap

const cmdRetry = async (context: any) => {
  return await handleIssueForm(context);
};

// Commands should map to EventHandlers
export const cmdHandlerMap: {
  [id: string]: (context: any) => void;
} = {
  retry: cmdRetry,
};
