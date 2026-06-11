#!/usr/bin/env node
'use strict';

const { io } = require('socket.io-client');
const axios = require('axios');

const SERVER = process.env.TERMCHAT_SERVER ?? 'http://localhost:3000';
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.error('Usage: node ws-test.js <JWT>');
  process.exit(1);
}

async function getChannelId() {
  const res = await axios.get(`${SERVER}/channels`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.data.length) throw new Error('No channels found. Run sprint2.http first.');
  return res.data[0].id;
}

async function main() {
  const channelId = await getChannelId();
  console.log(`Using channelId=${channelId}`);

  const socket = io(`${SERVER}/chat`, {
    auth: { token: `Bearer ${TOKEN}` },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[+] Connected as', socket.id);
    socket.emit('channel_join', { channelId });
  });

  socket.on('connect_error', (err) => {
    console.error('[-] Connect error:', err.message);
    process.exit(1);
  });

  socket.on('initial_state', (data) => {
    console.log('[+] initial_state received, channels:', data.channels?.length ?? 0);
  });

  socket.on('message_history', (data) => {
    console.log(`[+] message_history for channelId=${data.channelId}, count=${data.messages?.length ?? 0}`);
    console.log('[>] Sending test message...');
    socket.emit('send_message', { channelId, content: 'Hello from ws-test!' });
  });

  socket.on('new_message', (msg) => {
    console.log(`[+] new_message: [${msg.user.username}] ${msg.content}`);
    console.log('[✓] Smoke test passed. Disconnecting.');
    socket.disconnect();
    process.exit(0);
  });

  socket.on('command_error', (err) => console.warn('[!] command_error:', err.message));
  socket.on('error_unauthorized', (err) => {
    console.error('[-] error_unauthorized:', err.message);
    process.exit(1);
  });

  setTimeout(() => {
    console.error('[-] Timeout: no response after 10s.');
    process.exit(1);
  }, 10000);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
