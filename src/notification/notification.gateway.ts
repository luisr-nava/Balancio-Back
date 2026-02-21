import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private users = new Map<string, string>(); // userId -> socketId

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        console.log('❌ No token provided');
        client.disconnect();
        return;
      }

      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as any;

      const userId = payload.sub;

      if (!userId) {
        console.log('❌ Token sin userId');
        client.disconnect();
        return;
      }

      client.join(userId);

      console.log(`✅ Usuario autenticado por socket: ${userId}`);
    } catch (error) {
      console.log('❌ Token inválido');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.users.entries()) {
      if (socketId === client.id) {
        this.users.delete(userId);
        break;
      }
    }
  }

  sendNotification(userId: string, payload: any) {
    this.server.to(userId).emit('notification', payload);
  }
}
