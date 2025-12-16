const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity (or configure specific domains)
        methods: ["GET", "POST"]
    }
});

// Track online users: Map<userId, socketId>
const onlineUsers = new Map();

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("user:check-presence", ({ userId }) => {
        const isOnline = onlineUsers.has(userId);
        if (isOnline) {
            socket.emit(`user:${userId}:online`);
        } else {
            socket.emit(`user:${userId}:offline`);
        }
    });

    socket.on("user:online", ({ userId }) => {
        console.log(`User ${userId} is online (Socket: ${socket.id})`);
        onlineUsers.set(userId, socket.id);
        socket.data.userId = userId;

        // Broadcast to everyone that this user is online
        io.emit(`user:${userId}:online`);
        io.emit("user:status-change", { userId, status: "online" });
    });

    socket.on("admin:get-online-users", () => {
        const users = Array.from(onlineUsers.keys());
        console.log("Admin requested online users:", users);
        socket.emit("admin:online-users", users);
    });

    socket.on("user:location", ({ userId, location }) => {
        console.log(`Received location from ${userId}:`, location);
        // Broadcast location update to admins (or everyone for now)
        io.emit("user:location-update", { userId, location });
    });

    // Route tracking events
    socket.on("driver:route-started", ({ driverId, destinationId, clientId }) => {
        console.log(`Driver ${driverId} started route to destination ${destinationId}`);
        // Notify the specific client
        io.emit(`client:${clientId}:driver-approaching`, { driverId, destinationId });
    });

    socket.on("driver:location-update", ({ driverId, location, activeRouteId }) => {
        // Broadcast driver's real-time location to all clients tracking this route
        io.emit(`route:${activeRouteId}:driver-location`, { driverId, location });

        // Also update the global admin map
        io.emit("user:location-update", { userId: driverId, location });
    });

    socket.on("disconnect", () => {
        const userId = socket.data.userId;
        if (userId) {
            console.log(`User ${userId} disconnected`);
            onlineUsers.delete(userId);

            // Broadcast to everyone that this user is offline
            io.emit(`user:${userId}:offline`);
            io.emit("user:status-change", { userId, status: "offline" });
        }
    });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`Socket server running on port ${PORT}`);
});
