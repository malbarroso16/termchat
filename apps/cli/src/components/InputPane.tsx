import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  connected: boolean;
  reconnecting: boolean;
}

export function InputPane({ value, onChange, onSubmit, connected, reconnecting }: Props) {
  useInput((input, key) => {
    if (key.return) {
      const trimmed = value.trim();
      if (trimmed) onSubmit(trimmed);
      onChange('');
      return;
    }
    if (key.escape) {
      onChange('');
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  const promptColor = reconnecting ? 'yellow' : connected ? 'green' : 'red';
  const statusChar = reconnecting ? '~' : connected ? '>' : '!';

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color={promptColor} bold>{statusChar} </Text>
      <Text>{value}</Text>
      <Text color={promptColor}>▌</Text>
    </Box>
  );
}
