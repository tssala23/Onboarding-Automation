import parse from '@operate-first/probot-issue-form';
import { Context } from 'probot';
import { comments } from '../lib/comments';

export const handleDisplayPayload = async (
  context: Context<'issue_comment.created'>
) => {
  const data = await parse(context);

  let msg: string;
  if (data) {
    const payload = JSON.stringify(data, null, 2);
    msg = comments.DISPLAY_PAYLOAD(payload.toString());
  } else {
    msg = comments.DISPLAY_PAYLOAD_FAIL;
  }
  await context.octokit.issues.createComment(context.issue({ body: msg }));
};
