import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useSocket } from '../useSocket';
import { ChannelPane } from './ChannelPane';
import { MessagePane } from './MessagePane';
import { InputPane } from './InputPane';
import { HelpPane } from './HelpPane';
import { api } from '../api';
import { config } from '../config';

const HINTS = '/help  •  /join #ch  /leave  /create #ch  /logout  •  ↑↓ channels  •  Ctrl+C quit';

interface Props {
  onLogout: () => void;
}

export function ChatScreen({ onLogout }: Props) {
  const { state, joinChannel, sendMessage, leaveChannel, removeChannel, addChannel, disconnectSocket } = useSocket();
  const [inputBuffer, setInputBuffer] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Auto-join first channel once connected
  useEffect(() => {
    if (state.connected && state.channels.length > 0 && !state.activeChannelId) {
      joinChannel(state.channels[0].id);
    }
  }, [state.connected, state.channels.length]);

  // Auto-clear status bar after 4 s
  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(null), 4000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  // Esc closes help overlay (InputPane also clears buffer, both are fine)
  useInput((_, key) => {
    if (helpOpen && key.escape) setHelpOpen(false);
  });

  // ↑/↓ navigate channels — only fires when input is empty and help is closed
  useInput((_, key) => {
    if (inputBuffer !== '' || helpOpen || state.channels.length === 0) return;
    const idx = state.channels.findIndex((ch) => ch.id === state.activeChannelId);
    if (key.upArrow) {
      const next = Math.max(0, idx - 1);
      if (next !== idx) joinChannel(state.channels[next].id);
    } else if (key.downArrow) {
      const next = Math.min(state.channels.length - 1, idx + 1);
      if (next !== idx) joinChannel(state.channels[next].id);
    }
  });

  const handleSubmit = (text: string) => {
    setStatusMsg(null);

    // /help — toggle help overlay (must come before the general setHelpOpen(false))
    if (text === '/help') {
      setHelpOpen((prev) => !prev);
      return;
    }

    setHelpOpen(false); // close help when any other command/message is submitted

    // /join [#]<name>
    if (text.startsWith('/join ')) {
      const name = text.slice(6).trim().replace(/^#/, '');
      if (!name) {
        setStatusMsg({ text: 'Usage: /join <channel-name>', error: true });
        return;
      }
      const local = state.channels.find((ch) => ch.name === name);
      if (local) {
        joinChannel(local.id);
        return;
      }
      // Channel not in local list — fetch from server and retry
      api
        .getChannels()
        .then((channels) => {
          const found = channels.find((ch) => ch.name === name);
          if (found) joinChannel(found.id);
          else setStatusMsg({ text: `Channel "#${name}" not found.`, error: true });
        })
        .catch(() => setStatusMsg({ text: 'Failed to fetch channels.', error: true }));
      return;
    }

    // /leave
    if (text === '/leave' || text.startsWith('/leave ')) {
      if (state.activeChannelId) {
        leaveChannel(state.activeChannelId);
        removeChannel(state.activeChannelId);
      }
      return;
    }

    // /create [#]<name> [description...]
    if (text.startsWith('/create ')) {
      const args = text.slice(8).trim();
      const spaceIdx = args.indexOf(' ');
      const rawName = spaceIdx === -1 ? args : args.slice(0, spaceIdx);
      const name = rawName.replace(/^#/, '');
      const description = spaceIdx === -1 ? undefined : args.slice(spaceIdx + 1).trim() || undefined;
      if (!name) {
        setStatusMsg({ text: 'Usage: /create <name> [description]', error: true });
        return;
      }
      api
        .createChannel(name, description)
        .then((ch) => {
          addChannel(ch);
          setStatusMsg({ text: `Channel #${ch.name} created.`, error: false });
          joinChannel(ch.id);
        })
        .catch((err: any) => {
          const raw = err?.response?.data?.message;
          const msg = !err?.response
            ? 'Cannot connect to server.'
            : Array.isArray(raw)
            ? raw.join(', ')
            : String(raw ?? 'Failed to create channel.');
          setStatusMsg({ text: msg, error: true });
        });
      return;
    }

    // /logout
    if (text === '/logout') {
      disconnectSocket();
      config.clear();
      onLogout();
      return;
    }

    // Everything else (regular messages and other slash commands like /nick, /dm)
    // gets forwarded to the server via send_message
    if (state.activeChannelId) {
      sendMessage(state.activeChannelId, text);
    }
  };

  const activeChannel = state.channels.find((ch) => ch.id === state.activeChannelId) ?? null;
  const activeMessages = state.activeChannelId
    ? (state.messages[state.activeChannelId] ?? [])
    : [];
  const username = config.getUsername() ?? '?';
  const statusLabel = state.reconnecting
    ? 'reconnecting…'
    : state.connected
    ? 'connected'
    : 'offline';
  const statusColor = state.reconnecting ? 'yellow' : state.connected ? 'green' : 'red';

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="cyan">
      {/* Title bar */}
      <Box paddingX={1} borderStyle="single" borderColor="cyan" justifyContent="space-between">
        <Text bold color="cyan">
          TermChat
          {activeChannel ? <Text color="white">  •  #{activeChannel.name}</Text> : null}
        </Text>
        <Text>
          <Text dimColor>{username}  •  </Text>
          <Text color={statusColor}>{statusLabel}</Text>
        </Text>
      </Box>

      {/* Main content */}
      {helpOpen ? (
        <HelpPane />
      ) : (
        <Box flexDirection="row" flexGrow={1}>
          <ChannelPane
            channels={state.channels}
            activeChannelId={state.activeChannelId}
            onlineUsers={state.onlineUsers}
            onSelect={joinChannel}
          />
          <MessagePane
            messages={activeMessages}
            systemMessages={state.systemMessages}
            channelName={activeChannel?.name ?? null}
          />
        </Box>
      )}

      {/* Input */}
      <InputPane
        value={inputBuffer}
        onChange={setInputBuffer}
        onSubmit={handleSubmit}
        connected={state.connected}
        reconnecting={state.reconnecting}
      />

      {/* Hints / status bar — shows errors/confirmations for 4 s, then hints */}
      <Box paddingX={1}>
        {statusMsg ? (
          <Text color={statusMsg.error ? 'red' : 'green'}>
            {statusMsg.error ? '✖' : '✔'} {statusMsg.text}
          </Text>
        ) : (
          <Text dimColor>{HINTS}</Text>
        )}
      </Box>
    </Box>
  );
}
