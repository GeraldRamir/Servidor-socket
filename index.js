const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();

/**
 * 🔹 CORS HTTP (Express)
 * No es crítico para Socket, pero ayuda
 */
app.use(
  cors({
    origin: [
      "https://tracking-app-kprs.vercel.app",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

const server = http.createServer(app);

/**
 * 🔹 SOCKET.IO CONFIG (LO MÁS IMPORTANTE)
 */
const io = new Server(server, {
  cors: {
    origin: [
      "https://tracking-app-kprs.vercel.app",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"], // 👈 CLAVE
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Track online users
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("user:check-presence", ({ userId }) => {
    const isOnline = onlineUsers.has(userId);
    socket.emit(
      isOnline ? `user:${userId}:online` : `user:${userId}:offline`
    );
  });

  socket.on("user:online", ({ userId }) => {
    console.log(`User ${userId} is online (Socket: ${socket.id})`);

    onlineUsers.set(userId, socket.id);
    socket.data.userId = userId;

    io.emit(`user:${userId}:online`);
    io.emit("user:status-change", { userId, status: "online" });
  });

  socket.on("admin:get-online-users", () => {
    socket.emit("admin:online-users", Array.from(onlineUsers.keys()));
  });

  socket.on("user:location", ({ userId, location }) => {
    io.emit("user:location-update", { userId, location });
  });

  socket.on("driver:route-started", ({ driverId, destinationId, clientId }) => {
    io.emit(`client:${clientId}:driver-approaching`, {
      driverId,
      destinationId,
    });
  });

  socket.on("driver:location-update", ({ driverId, location, activeRouteId }) => {
    io.emit(`route:${activeRouteId}:driver-location`, {
      driverId,
      location,
    });

    io.emit("user:location-update", {
      userId: driverId,
      location,
    });
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId;

    if (userId) {
      onlineUsers.delete(userId);

      io.emit(`user:${userId}:offline`);
      io.emit("user:status-change", { userId, status: "offline" });
    }

    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Socket server running on port ${PORT}`);
});
