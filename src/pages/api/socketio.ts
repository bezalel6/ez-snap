import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as ServerIO, Socket } from 'socket.io';
import type { Server as NetServer } from 'http';
import type { Socket as NetSocket } from 'net';

interface SocketServer extends NetServer {
  io?: ServerIO | undefined;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NetSocket & {
    server: SocketServer;
  };
}

interface PhotoData {
  dataUrl: string;
  [key: string]: unknown;
}

interface ClientMessage {
  message: string;
  [key: string]: unknown;
}

interface ConnectedUser {
  clientId: string;
  sessionId: string;
  connectedAt: Date;
}

const ioHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    console.log('🚀 Starting Socket.IO server...');
    
    const io = new ServerIO(res.socket.server, {
      path: '/api/socketio',
      addTrailingSlash: false,
    });
    
    res.socket.server.io = io;

    // Track connected users with session IDs
    const connectedUsers = new Map<string, ConnectedUser>();
    let sessionIdCounter = 1;

    // Helper function to generate session ID
    const generateSessionId = (): string => {
      return `user-${sessionIdCounter++}`;
    };

    // Server-initiated communication examples
    io.on('connection', (socket) => {
      const sessionId = generateSessionId();
      console.log(`✅ Client connected: ${socket.id} assigned session: ${sessionId}`);
      
      // Store connected user info
      connectedUsers.set(socket.id, {
        clientId: socket.id,
        sessionId: sessionId,
        connectedAt: new Date(),
      });

      // Welcome message to new client with their session ID
      socket.emit('server-message', {
        type: 'welcome',
        message: `Connected to EZ Snap server! Your session: ${sessionId}`,
        timestamp: new Date(),
        sessionId: sessionId,
      });

      // Send current connected users list to new client
      socket.emit('users-list', {
        users: Array.from(connectedUsers.values()),
        timestamp: new Date(),
      });

      // Notify all other clients about new connection
      socket.broadcast.emit('server-message', {
        type: 'user-joined',
        message: `${sessionId} joined the session`,
        timestamp: new Date(),
        clientId: socket.id,
        sessionId: sessionId,
      });

      // Broadcast updated users list to all clients
      io.emit('users-list', {
        users: Array.from(connectedUsers.values()),
        timestamp: new Date(),
      });

      // Handle photo sharing between clients
      socket.on('share-photo', (data: PhotoData) => {
        const userInfo = connectedUsers.get(socket.id);
        console.log('📷 Photo shared by:', userInfo?.sessionId);
        
        // Broadcast the photo to all other clients
        socket.broadcast.emit('photo-received', {
          ...data,
          fromClient: socket.id,
          fromSession: userInfo?.sessionId,
          timestamp: new Date(),
        });
      });

      // Handle client messages
      socket.on('client-message', (data: ClientMessage) => {
        const userInfo = connectedUsers.get(socket.id);
        console.log('💬 Message from:', userInfo?.sessionId, data);
        
        // Echo to all clients (including sender)
        io.emit('server-message', {
          type: 'broadcast',
          message: data.message,
          timestamp: new Date(),
          fromClient: socket.id,
          sessionId: userInfo?.sessionId,
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const userInfo = connectedUsers.get(socket.id);
        console.log(`❌ Client disconnected: ${userInfo?.sessionId}`);
        
        // Remove from connected users
        connectedUsers.delete(socket.id);
        
        // Notify remaining clients
        socket.broadcast.emit('server-message', {
          type: 'user-left',
          message: `${userInfo?.sessionId} left the session`,
          timestamp: new Date(),
          clientId: socket.id,
          sessionId: userInfo?.sessionId,
        });

        // Broadcast updated users list to remaining clients
        socket.broadcast.emit('users-list', {
          users: Array.from(connectedUsers.values()),
          timestamp: new Date(),
        });
      });
    });

    // Example: Server-initiated periodic updates
    setInterval(() => {
      io.emit('server-message', {
        type: 'server-update',
        message: `Server heartbeat - ${io.engine.clientsCount} users connected`,
        timestamp: new Date(),
        clientCount: io.engine.clientsCount,
        connectedUsers: Array.from(connectedUsers.values()),
      });
    }, 30000); // Every 30 seconds

    console.log('🔥 Socket.IO server setup complete');
  } else {
    console.log('⚡ Socket.IO server already running');
  }
  
  res.end();
};

export default ioHandler; 
