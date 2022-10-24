import { cmdDefault, cmdHandlerMap } from '../lib/commands';

/**
 * @param {string}  comment - Issue Comment Body.
 * @returns {string[]} - Returns an array of commands. E.g. [retry, cancel]
 */
export const parseCommands = (comment: string): string[] => {
  const regex = /\/robozome?\s(\w)+/g;
  const match = comment.match(regex);

  // No string matches of form "/robozome <command>"
  if (!match) return [];
  const commands: string[] = [];

  for (const m in match) {
    const split: string[] = match[m].split(' ');
    if (split.length != 2) return [];
    commands.push(split[1]);
  }

  return commands;
};

/**
 * Takes an issue comment creation context, looks for commands of form /
 * robozome <command> any where in the comment body.
 *
 * Executes all <command>'s.
 *
 * @param context
 * @param commands
 */
export const handleCommands = async (context: any, commands: string[]) => {
  for (const i in commands) {
    const cmd = commands[i];
    if (!cmdHandlerMap[cmd]) {
      await cmdDefault(context);
    } else {
      await cmdHandlerMap[cmd](context);
    }
  }
};
