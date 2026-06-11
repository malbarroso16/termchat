#!/usr/bin/env node
'use strict';

const { io } = require('socket.io-client');
const axios = require('axios');

const SERVER = process.env.TERMCHAT_SERVER ?? 'http://localhost:3000';
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.error('Usage: node ws-ratelimit-test.js <JWT>');
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

  let rateLimitReceived = false;
  let messagesSent = 0;
  const BURST = 8;

  socket.on('connect', () => {
    console.log('[+] Connected as', socket.id);
    socket.emit('channel_join', { channelId });
  });

  socket.on('connect_error', (err) => {
    console.error('[-] Connect error:', err.message);
    process.exit(1);
  });

  socket.on('message_history', () => {
    console.log(`[>] Firing ${BURST} rapid messages (limit is 5/s)...`);
    for (let i = 0; i < BURST; i++) {
      socket.emit('send_message', { channelId, content: `burst message ${i + 1}` });
      messagesSent++;
    }
  });

  socket.on('new_message', (msg) => {
    console.log(`[+] new_message: ${msg.content}`);
  });

  socket.on('error_rate_limit', (data) => {
    rateLimitReceived = true;
    console.log(`[✓] error_rate_limit received: ${data.message}`);
  });

  socket.on('error_unauthorized', (err) => {
    console.error('[-] error_unauthorized:', err.message);
    process.exit(1);
  });

  setTimeout(() => {
    if (rateLimitReceived) {
      console.log('[✓] Rate-limit test PASSED.');
      process.exit(0);
    } else {
      console.error(`[-] Rate-limit test FAILED: sent ${messagesSent} messages but never received error_rate_limit.`);
      process.exit(1);
    }
  }, 5000);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
