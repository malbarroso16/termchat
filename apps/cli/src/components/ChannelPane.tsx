import React from 'react';
import { Box, Text } from 'ink';
import type { Channel } from '../api';

interface Props {
  channels: Channel[];
  activeChannelId: number | null;
  onlineUsers: Record<number, number[]>;
  onSelect: (channelId: number) => void;
}

export function ChannelPane({
  channels,
  activeChannelId,
  onlineUsers,
}: Props) {
  return (
    <Box
      flexDirection="column"
      width={22}
      borderStyle="single"
      borderColor="cyan"
      padding={0}
    >
      <Box paddingX={1}>
        <Text bold color="cyan">
          Channels
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {channels.length === 0 ? (
          <Text dimColor>No channels</Text>
        ) : (
          channels.map((ch) => {
            const online = onlineUsers[ch.id]?.length ?? 0;
            const isActive = ch.id === activeChannelId;
            const name = `#${ch.name}`.slice(0, 16).padEnd(16);
            return (
              <Box key={ch.id} justifyContent="space-between">
                <Text color={isActive ? 'green' : undefined} bold={isActive}>
                  {name}
                </Text>
                {online > 0 ? (
                  <Text color="yellow" dimColor={!isActive}>
                    {online}
                  </Text>
                ) : null}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
