/**
 * server.ts — Custom HTTP server
 *
 * Wraps Next.js inside an Express server and attaches Socket.io to the same
 * port. This allows us to run both the Next.js app and the real-time WebSocket
 * server on a single process without any proxy config.
 *
 * Start with:   npx tsx server.ts          (dev)
 *               NODE_ENV=production npx tsx server.ts  (prod)
 */

import { createServer } from "http";
import express from "express";
import next from "next";
import { Server as SocketServer, Socket } from "socket.io";
import * as jose from "jose";
import { prisma } from "./lib/prisma";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "default_super_secret_key_for_development"
);

// ── Bootstrap Next.js ────────────────────────────────────────────────────────

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  // ── Socket.io server ───────────────────────────────────────────────────────

  const io = new SocketServer(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Allow the client to reconnect automatically
    transports: ["websocket", "polling"],
  });

  // ── Auth middleware ─────────────────────────────────────────────────────────
  // Validates the JWT token passed in socket.handshake.auth.token

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const { payload } = await jose.jwtVerify(token, secret);
      // Attach user info to socket for use in event handlers
      (socket as any).userId = payload.userId as string;
      (socket as any).userName = payload.name as string;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────

  io.on("connection", (socket: Socket) => {
    const userId: string = (socket as any).userId;
    const userName: string = (socket as any).userName;

    console.log(`[socket] connected  uid=${userId}`);

    // ── join-expense ─────────────────────────────────────────────────────────
    // Client joins the room for a specific expense.
    // Room name: "expense:<expenseId>"

    socket.on("join-expense", (expenseId: string) => {
      if (!expenseId || typeof expenseId !== "string") return;
      socket.join(`expense:${expenseId}`);
      console.log(`[socket] uid=${userId} joined expense:${expenseId}`);
    });

    // ── leave-expense ────────────────────────────────────────────────────────

    socket.on("leave-expense", (expenseId: string) => {
      if (!expenseId || typeof expenseId !== "string") return;
      socket.leave(`expense:${expenseId}`);
    });

    // ── send-comment ─────────────────────────────────────────────────────────
    // Client sends a new comment. Server:
    //   1. Validates inputs
    //   2. Persists to DB via Prisma
    //   3. Broadcasts the full comment to the expense room

    socket.on(
      "send-comment",
      async ({
        expenseId,
        content,
      }: {
        expenseId: string;
        content: string;
      }) => {
        if (!expenseId || !content?.trim()) {
          socket.emit("error", { message: "expenseId and content are required" });
          return;
        }

        try {
          // Verify the expense exists
          const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
            select: { id: true },
          });
          if (!expense) {
            socket.emit("error", { message: "Expense not found" });
            return;
          }

          // Save to database
          const comment = await prisma.expenseComment.create({
            data: {
              expenseId,
              userId,
              content: content.trim(),
            },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          });

          // Broadcast the new comment to everyone in the room (including sender)
          io.to(`expense:${expenseId}`).emit("new-comment", {
            id: comment.id,
            expenseId: comment.expenseId,
            userId: comment.userId,
            content: comment.content,
            createdAt: comment.createdAt.toISOString(),
            user: comment.user,
          });

          console.log(
            `[socket] comment saved  uid=${userId} expense=${expenseId}`
          );
        } catch (err) {
          console.error("[socket] send-comment error:", err);
          socket.emit("error", { message: "Failed to save comment" });
        }
      }
    );

    // ── disconnect ───────────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      console.log(`[socket] disconnected uid=${userId}`);
    });
  });

  // ── Route all HTTP requests through Next.js ────────────────────────────────

  expressApp.all("*", (req: express.Request, res: express.Response) => {
    handle(req, res);
  });

  // ── Start ──────────────────────────────────────────────────────────────────

  httpServer.listen(port, () => {
    console.log(`\n▲ Spreetail (Next.js + Socket.io) ready`);
    console.log(`  Local:   http://${hostname}:${port}`);
    console.log(`  Mode:    ${dev ? "development" : "production"}\n`);
  });
});
