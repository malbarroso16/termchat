import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

@Injectable()
export class WsGuard implements CanActivate {
  private readonly logger = new Logger(WsGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const rawToken: string | undefined = client.handshake.auth?.token;

    if (!rawToken) {
      this.logger.warn(`Socket ${client.id} rejected — no token`);
      client.emit('error_unauthorized', { message: 'No token provided' });
      client.disconnect();
      return false;
    }

    const token = rawToken.replace('Bearer ', '');

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      client.data.user = payload;
      return true;
    } catch (err) {
      this.logger.warn(
        `Socket ${client.id} rejected — invalid token: ${(err as Error).message}`,
      );
      client.emit('error_unauthorized', { message: 'Invalid or expired token' });
      client.disconnect();
      return false;
    }
  }

  verifyClient(client: Socket): boolean {
    const rawToken: string | undefined = client.handshake.auth?.token;
    if (!rawToken) return false;
    try {
      const payload = this.jwtService.verify(rawToken.replace('Bearer ', ''), {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      client.data.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
