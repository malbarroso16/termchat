import React from 'react';
import { Box, Text } from 'ink';

const COMMANDS: Array<{ cmd: string; desc: string }> = [
  { cmd: '/join #<channel>',       desc: 'Switch to a channel by name' },
  { cmd: '/leave',                 desc: 'Leave the active channel' },
  { cmd: '/create #<name> [desc]', desc: 'Create a new channel' },
  { cmd: '/nick <newname>',        desc: 'Change your display name' },
  { cmd: '/dm @<user> <message>',  desc: 'Direct message (coming soon)' },
  { cmd: '/logout',                desc: 'Sign out and clear saved session' },
  { cmd: '/help',                  desc: 'Toggle this help panel' },
];

// ASCII-only keys — avoids ambiguous-width Unicode arrows desynchronising
// the terminal cursor and bleeding text across rows on Windows Terminal
const NAV: Array<{ key: string; desc: string }> = [
  { key: 'Up / Down', desc: 'Switch channels (when input is empty)' },
  { key: 'Esc',       desc: 'Clear input or close help' },
  { key: 'Ctrl+C',    desc: 'Quit TermChat' },
];

// padEnd works correctly here because every entry is pure ASCII
const CMD_COL = 26;
const KEY_COL = 14;

export function HelpPane() {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="cyan">Commands</Text>

      <Box flexDirection="column" marginTop={1}>
        {COMMANDS.map(({ cmd, desc }) => (
          <Text key={cmd} wrap="truncate">
            <Text color="green">{cmd.padEnd(CMD_COL)}</Text>
            <Text dimColor>{desc}</Text>
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text bold color="cyan">Navigation</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {NAV.map(({ key, desc }) => (
          <Text key={key} wrap="truncate">
            <Text color="green">{key.padEnd(KEY_COL)}</Text>
            <Text dimColor>{desc}</Text>
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Esc or type /help to close</Text>
      </Box>
    </Box>
  );
}
