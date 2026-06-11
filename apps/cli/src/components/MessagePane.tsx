import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '../api';

interface Props {
  messages: Message[];
  systemMessages: string[];
  channelName: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function MessagePane({ messages, systemMessages, channelName }: Props) {
  const recent = messages.slice(-20);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor="cyan"
      padding={0}
    >
      <Box paddingX={1}>
        <Text bold color="cyan">
          {channelName ? `#${channelName}` : 'TermChat'}
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {recent.map((msg) => {
          const deleted = !!msg.deletedAt;
          const edited = !!msg.editedAt && !deleted;
          return (
            <Box key={msg.id}>
              <Text dimColor>{formatTime(msg.createdAt)} </Text>
              <Text bold>{msg.user.username}: </Text>
              {deleted ? (
                <Text color="gray" italic>
                  [message deleted]
                </Text>
              ) : (
                <>
                  <Text>{msg.content}</Text>
                  {edited ? <Text dimColor> (edited)</Text> : null}
                </>
              )}
            </Box>
          );
        })}
        {systemMessages.slice(-5).map((m, i) => (
          <Text key={i} color="yellow" dimColor>
            *** {m}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
