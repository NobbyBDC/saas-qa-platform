import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'] },
  namespace: '/runs',
})
export class RunsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`WS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`WS client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:run')
  handleSubscribeRun(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`run:${data.runId}`);
    return { event: 'subscribed', data: { runId: data.runId } };
  }

  @SubscribeMessage('subscribe:project')
  handleSubscribeProject(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`project:${data.projectId}`);
    return { event: 'subscribed', data: { projectId: data.projectId } };
  }

  emitRunUpdate(runId: string, payload: unknown) {
    this.server.to(`run:${runId}`).emit('run:update', payload);
  }

  emitStageUpdate(runId: string, payload: unknown) {
    this.server.to(`run:${runId}`).emit('stage:update', payload);
  }

  emitRunCompleted(projectId: string, runId: string, payload: unknown) {
    this.server.to(`project:${projectId}`).emit('run:completed', { runId, ...payload as object });
    this.server.to(`run:${runId}`).emit('run:completed', { runId, ...payload as object });
  }
}
