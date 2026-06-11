import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from './config';
import type { Channel, Message } from './api';

const SERVER_URL = process.env.TERMCHAT_SERVER ?? 'http://localhost:3000';

export interface ChatState {
  channels: Channel[];
  activeChannelId: number | null;
  messages: Record<number, Message[]>;
  onlineUsers: Record<number, number[]>;
  systemMessages: string[];
  connected: boolean;
  reconnecting: boolean;
}

const initialState: ChatState = {
  channels: [],
  activeChannelId: null,
  messages: {},
  onlineUsers: {},
  systemMessages: [],
  connected: false,
  reconnecting: false,
};

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<ChatState>(initialState);

  const addSystemMessage = (msg: string) => {
    setState((prev) => ({
      ...prev,
      systemMessages: [...prev.systemMessages.slice(-99), msg],
    }));
  };

  useEffect(() => {
    const token = config.getToken();
    if (!token) return;

    const socket = io(`${SERVER_URL}/chat`, {
      auth: { token: `Bearer ${token}` },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState((prev) => ({ ...prev, connected: true, reconnecting: false }));
      addSystemMessage('Connected to TermChat server.');
    });

    socket.on('disconnect', (reason) => {
      setState((prev) => ({ ...prev, connected: false }));
      addSystemMessage(`Disconnected: ${reason}. Attempting to reconnect...`);
    });

    socket.on('connect_error', () => {
      setState((prev) => ({ ...prev, reconnecting: true }));
    });

    socket.on('initial_state', (data: { channels: Channel[] }) => {
      setState((prev) => ({ ...prev, channels: data.channels }));
    });

    socket.on(
      'message_history',
      (data: { channelId: number; messages: Message[] }) => {
        setState((prev) => ({
          ...prev,
          activeChannelId: data.channelId,
          messages: { ...prev.messages, [data.channelId]: data.messages },
        }));
      },
    );

    socket.on('new_message', (message: Message) => {
      setState((prev) => {
        const existing = prev.messages[message.channelId] ?? [];
        return {
          ...prev,
          messages: {
            ...prev.messages,
            [message.channelId]: [...existing, message],
          },
        };
      });
    });

    socket.on(
      'message_edited',
      (data: { messageId: number; content: string; editedAt: string }) => {
        setState((prev) => {
          const updated = { ...prev.messages };
          for (const channelId in updated) {
            updated[channelId] = updated[channelId].map((m) =>
              m.id === data.messageId
                ? { ...m, content: data.content, editedAt: data.editedAt }
                : m,
            );
          }
          return { ...prev, messages: updated };
        });
      },
    );

    socket.on('message_deleted', (data: { messageId: number }) => {
      setState((prev) => {
        const updated = { ...prev.messages };
        for (const channelId in updated) {
          updated[channelId] = updated[channelId].map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  content: '[message deleted]',
                  deletedAt: new Date().toISOString(),
                }
              : m,
          );
        }
        return { ...prev, messages: updated };
      });
    });

    socket.on(
      'user_joined',
      (data: { userId: number; username: string; channelId: number }) => {
        setState((prev) => {
          const channelName =
            prev.channels.find((ch) => ch.id === data.channelId)?.name ??
            String(data.channelId);
          return {
            ...prev,
            systemMessages: [
              ...prev.systemMessages.slice(-99),
              `${data.username} joined #${channelName}`,
            ],
            onlineUsers: {
              ...prev.onlineUsers,
              [data.channelId]: [
                ...(prev.onlineUsers[data.channelId] ?? []).filter((id) => id !== data.userId),
                data.userId,
              ],
            },
          };
        });
      },
    );

    socket.on(
      'user_left',
      (data: { userId: number; username: string; channelId: number }) => {
        setState((prev) => {
          const channelName =
            prev.channels.find((ch) => ch.id === data.channelId)?.name ??
            String(data.channelId);
          return {
            ...prev,
            systemMessages: [
              ...prev.systemMessages.slice(-99),
              `${data.username} left #${channelName}`,
            ],
            onlineUsers: {
              ...prev.onlineUsers,
              [data.channelId]: (prev.onlineUsers[data.channelId] ?? []).filter(
                (id) => id !== data.userId,
              ),
            },
          };
        });
      },
    );

    socket.on(
      'name_changed',
      (data: { userId: number; oldName: string; newName: string }) => {
        addSystemMessage(`${data.oldName} is now known as ${data.newName}`);
      },
    );

    socket.on('error_rate_limit', (data: { message: string }) => {
      addSystemMessage(`[rate limit] ${data.message}`);
    });

    socket.on('error_unauthorized', (data: { message: string }) => {
      addSystemMessage(`[error] ${data.message}`);
    });

    socket.on('command_error', (data: { message: string }) => {
      addSystemMessage(`[command error] ${data.message}`);
    });

    socket.on(
      'presence_update',
      (data: { channelId: number; onlineUserIds: number[] }) => {
        setState((prev) => ({
          ...prev,
          onlineUsers: {
            ...prev.onlineUsers,
            [data.channelId]: data.onlineUserIds,
          },
        }));
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinChannel = (channelId: number) => {
    socketRef.current?.emit('channel_join', { channelId });
  };

  const sendMessage = (channelId: number, content: string) => {
    socketRef.current?.emit('send_message', { channelId, content });
  };

  const leaveChannel = (channelId: number) => {
    socketRef.current?.emit('channel_leave', { channelId });
  };

  const removeChannel = (channelId: number) => {
    setState((prev) => ({
      ...prev,
      channels: prev.channels.filter((ch) => ch.id !== channelId),
      activeChannelId: prev.activeChannelId === channelId ? null : prev.activeChannelId,
    }));
  };

  const addChannel = (channel: Channel) => {
    setState((prev) => {
      if (prev.channels.some((ch) => ch.id === channel.id)) return prev;
      return { ...prev, channels: [...prev.channels, channel] };
    });
  };

  const disconnectSocket = () => {
    socketRef.current?.disconnect();
  };

  return { state, joinChannel, sendMessage, leaveChannel, removeChannel, addChannel, disconnectSocket };
}
