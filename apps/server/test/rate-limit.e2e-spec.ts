import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { io, Socket } from 'socket.io-client';
import * as request from 'supertest';

jest.setTimeout(30000);

describe('Rate limiting E2E', () => {
  let app: INestApplication;
  let token: string;
  let channelId: number;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    httpServer = app.getHttpServer();

    const email = `ratelimit_${Date.now()}@test.dev`;
    await request(httpServer).post('/auth/register').send({
      email,
      username: `rl_user_${Date.now()}`,
      password: 'Password1!',
    });
    const loginRes = await request(httpServer).post('/auth/login').send({
      email,
      password: 'Password1!',
    });
    token = loginRes.body.accessToken;

    const chRes = await request(httpServer)
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `rl_chan_${Date.now()}`, description: 'rate limit test' });
    channelId = chRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('triggers error_rate_limit when 8 messages are sent in one second', (done) => {
    const address = httpServer.address() as { port: number };
    const socket: Socket = io(`http://localhost:${address.port}/chat`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
    });

    let rateLimitFired = false;

    socket.on('connect', () => {
      socket.emit('channel_join', { channelId });
    });

    socket.on('message_history', () => {
      for (let i = 0; i < 8; i++) {
        socket.emit('send_message', { channelId, content: `burst ${i}` });
      }
    });

    socket.on('error_rate_limit', () => {
      rateLimitFired = true;
      socket.disconnect();
      expect(rateLimitFired).toBe(true);
      done();
    });

    socket.on('connect_error', (err) => {
      socket.disconnect();
      done(err);
    });

    setTimeout(() => {
      if (!rateLimitFired) {
        socket.disconnect();
        done(new Error('error_rate_limit was not emitted after 8 burst messages'));
      }
    }, 8000);
  });
});
