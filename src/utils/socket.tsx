import { createContext, useContext, useEffect, useState } from "react";
import { type Socket } from "socket.io-client";
import { io } from "socket.io-client";
import type { ConnectedUser, PhotoShare } from "@/pages/types";

interface ServerMessage {
  type: "welcome" | "user-joined" | "user-left" | "server-update" | "broadcast";
  message: string;
  timestamp: Date;
  clientId?: string;
  fromClient?: string;
  clientCount?: number;
  uid?: string;
  connectedUsers?: ConnectedUser[];
}

interface UsersList {
  users: ConnectedUser[];
  timestamp: Date;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  messages: ServerMessage[];
  sharedPhotos: PhotoShare[];
  connectedUsers: ConnectedUser[];
  currentUserUid: string | null;
  sendMessage: (message: string) => void;
  sharePhoto: (dataUrl: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  messages: [],
  sharedPhotos: [],
  connectedUsers: [],
  currentUserUid: null,
  sendMessage: () => ({}),
  sharePhoto: () => ({}),
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [sharedPhotos, setSharedPhotos] = useState<PhotoShare[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io({
      path: "/api/socketio",
    });

    newSocket.on("connect", () => {
      console.log("🔗 Connected to server");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      setIsConnected(false);
      setCurrentUserUid(null);
      setConnectedUsers([]);
    });

    newSocket.on("server-message", (data: ServerMessage) => {
      console.log("📨 Server message:", data);

      // Extract UID from welcome message
      if (data.type === "welcome" && data.uid) {
        setCurrentUserUid(data.uid);
      }

      setMessages((prev) => [
        ...prev,
        { ...data, timestamp: new Date(data.timestamp) },
      ]);
    });

    newSocket.on("photo-received", (data: PhotoShare) => {
      console.log("📷 Photo received:", data);
      setSharedPhotos((prev) => [
        ...prev,
        { ...data, timestamp: new Date(data.timestamp) },
      ]);
    });

    newSocket.on("users-list", (data: UsersList) => {
      console.log("👥 Users list updated:", data);
      setConnectedUsers(
        data.users.map((user) => ({
          ...user,
          connectedAt: new Date(user.connectedAt),
        })),
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = (message: string) => {
    if (socket) {
      socket.emit("client-message", { message });
    }
  };

  const sharePhoto = (dataUrl: string) => {
    if (socket) {
      socket.emit("share-photo", { dataUrl });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        messages,
        sharedPhotos,
        connectedUsers,
        currentUserUid,
        sendMessage,
        sharePhoto,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
