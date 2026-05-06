import 'dotenv/config';
import { createServer } from 'http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { validateDeckAgainstInventory } from '../src/shared/cards';
import type {
  ClientToServerEvents,
  DeckSubmission,
  ServerToClientEvents,
} from '../src/shared/types';
import {
  AuthError,
  bearerToken,
  initAuthDb,
  loginUser,
  logoutToken,
  registerUser,
  userForToken,
} from './auth';
import {
  addBytes,
  claimDailyBytes,
  ensureStartingInventory,
  getInventory,
  getOwnedActions,
  getOwnedProtocols,
  initInventoryDb,
  keepInventoryDbAlive,
  openPack,
} from './inventory';
import {
  createGame,
  endTurn,
  forfeitGame,
  pigeonStep,
  playCard,
  skipPlay,
  viewFor,
} from './game';
import type { GameState } from './game';

const BYTE_BUNDLES: Record<string, number> = {
  byte: 10,
  kilobyte: 60,
  megabyte: 200,
  gigabyte: 500,
  terabyte: 1200,
};

const DAILY_CLAIM_BYTES = 8;
const BYTE_SHOP_DISCOUNT_CODE = 'NICKISTHEGOAT';

interface RoomPlayer {
  socketId: string;
  userId: string;
  name: string;
  deck: DeckSubmission | null;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  game: GameState | null;
  pigeonTimer: NodeJS.Timeout | null;
  rewardsApplied: boolean;
}

const rooms = new Map<string, Room>();
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});
app.get('/health/db', async (_req, res) => {
  try {
    await keepInventoryDbAlive();
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});


function sendError(res: express.Response, err: unknown) {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

async function requireUser(req: express.Request) {
  const token = bearerToken(req.header('authorization'));
  if (!token) throw new AuthError(401, 'Login required');
  const user = await userForToken(token);
  if (!user) throw new AuthError(401, 'Invalid or expired session');
  await ensureStartingInventory(user.id);
  return { token, user };
}

app.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new AuthError(400, 'Username and password are required');
    }
    const result = await registerUser(username, password);
    await ensureStartingInventory(result.user.id);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new AuthError(400, 'Username and password are required');
    }
    const result = await loginUser(username, password);
    await ensureStartingInventory(result.user.id);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    res.json({ user });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const token = bearerToken(req.header('authorization'));
    if (token) await logoutToken(token);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/inventory', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    res.json(await getInventory(user.id));
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/inventory/pack', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    const result = await openPack(user.id);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/byte-shop/daily-claim', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    const bytes = await claimDailyBytes(user.id, DAILY_CLAIM_BYTES);
    res.json({ bytes, granted: DAILY_CLAIM_BYTES });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/byte-shop/checkout', async (req, res) => {
  try {
    const { user } = await requireUser(req);
    const bundleId = typeof req.body?.bundleId === 'string' ? req.body.bundleId : '';
    const discountCode =
      typeof req.body?.discountCode === 'string' ? req.body.discountCode.trim().toUpperCase() : '';
    const granted = BYTE_BUNDLES[bundleId];
    if (!granted) throw new AuthError(400, 'Unknown byte bundle');
    if (discountCode !== BYTE_SHOP_DISCOUNT_CODE) {
      throw new AuthError(400, 'Valid discount code required for demo checkout');
    }
    const bytes = await addBytes(user.id, granted);
    res.json({ bytes, granted });
  } catch (err) {
    sendError(res, err);
  }
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

function broadcastLobby(room: Room) {
  io.to(room.code).emit('lobby_update', {
    players: room.players.map((p) => ({ name: p.name, ready: p.deck !== null })),
  });
}

function broadcastState(room: Room) {
  if (!room.game) return;
  for (let i = 0; i < room.players.length; i++) {
    const p = room.players[i];
    io.to(p.socketId).emit('state_update', viewFor(room.game, i as 0 | 1));
  }
}

async function applyGameEndRewards(room: Room) {
  if (!room.game || room.game.winner === null || room.rewardsApplied) return;
  room.rewardsApplied = true;
  const winnerIdx = room.game.winner;
  const loserIdx = 1 - winnerIdx;
  const winnerPlayer = room.game.players[winnerIdx];
  const loserPlayer = room.game.players[loserIdx];
  const forfeited = room.game.forfeitedIdx;

  const winnerBase = winnerPlayer.tmuxBonus ? 4 : 2;
  const loserBase = loserPlayer.vsCodeBonus ? 3 : 1;

  let winnerExtra = 0;
  let loserExtra = 0;
  if (winnerPlayer.wiresharkActive) winnerExtra += 20 - 10;
  if (loserPlayer.wiresharkActive) loserExtra -= 10;

  const winnerTotal = winnerBase + winnerExtra;
  let loserTotal = loserBase + loserExtra;
  if (forfeited === loserIdx) loserTotal = 0;

  room.game.bytesAwarded = { winner: winnerTotal, loser: loserTotal };

  try {
    if (forfeited === winnerIdx) {
      // shouldn't happen; defensive
    } else if (forfeited === loserIdx) {
      if (room.players[winnerIdx]?.userId) {
        await addBytes(room.players[winnerIdx].userId, winnerTotal);
      }
    } else {
      if (room.players[winnerIdx]?.userId) {
        await addBytes(room.players[winnerIdx].userId, winnerTotal);
      }
      if (room.players[loserIdx]?.userId) {
        await addBytes(room.players[loserIdx].userId, loserTotal);
      }
    }
  } catch (e) {
    console.error('reward error', e);
  }
}

function startPigeonTimer(room: Room) {
  if (room.pigeonTimer || !room.game?.pigeonActive) return;
  room.pigeonTimer = setInterval(() => {
    if (!room.game) return;
    if (room.game.winner !== null) {
      stopPigeonTimer(room);
      void applyGameEndRewards(room).then(() => broadcastState(room));
      return;
    }
    pigeonStep(room.game);
    broadcastState(room);
    if (room.game.winner !== null) {
      stopPigeonTimer(room);
      void applyGameEndRewards(room).then(() => broadcastState(room));
    }
  }, 1000);
}

function stopPigeonTimer(room: Room) {
  if (room.pigeonTimer) {
    clearInterval(room.pigeonTimer);
    room.pigeonTimer = null;
  }
}

function advanceTurnIfReady(room: Room, playerIdx: 0 | 1) {
  if (!room.game || room.game.winner !== null || room.game.phase !== 'end') return;
  const err = endTurn(room.game, playerIdx);
  if (err) {
    io.to(room.players[playerIdx]?.socketId).emit('error_msg', err);
    return;
  }
  broadcastState(room);
  if (room.game.pigeonActive) startPigeonTimer(room);
  if (room.game.winner !== null) {
    void applyGameEndRewards(room).then(() => broadcastState(room));
  }
}

function findRoomBySocket(socketId: string): { room: Room; index: number } | null {
  for (const room of rooms.values()) {
    const idx = room.players.findIndex((p) => p.socketId === socketId);
    if (idx !== -1) return { room, index: idx };
  }
  return null;
}

function removePlayerFromRoom(socketId: string, notifyOpponent: boolean) {
  const found = findRoomBySocket(socketId);
  if (!found) return;
  const { room } = found;
  io.sockets.sockets.get(socketId)?.leave(room.code);
  room.players = room.players.filter((p) => p.socketId !== socketId);
  if (room.players.length === 0) {
    stopPigeonTimer(room);
    rooms.delete(room.code);
    return;
  }
  if (notifyOpponent) {
    io.to(room.code).emit('error_msg', 'Opponent disconnected');
  }
  broadcastLobby(room);
}

io.on('connection', (socket) => {
  socket.on('create_or_join', async ({ roomCode, authToken }) => {
    const user = await userForToken(authToken).catch((err) => {
      console.error(err);
      return null;
    });
    if (!user) {
      socket.emit('error_msg', 'Login required');
      return;
    }
    await ensureStartingInventory(user.id).catch(() => undefined);

    const code = roomCode.trim();
    if (!code) {
      socket.emit('error_msg', 'Room code required');
      return;
    }
    let room = rooms.get(code);
    if (!room) {
      room = { code, players: [], game: null, pigeonTimer: null, rewardsApplied: false };
      rooms.set(code, room);
    }
    if (room.players.length >= 2) {
      socket.emit('error_msg', 'Room is full');
      return;
    }
    const idx = room.players.length as 0 | 1;
    room.players.push({ socketId: socket.id, userId: user.id, name: user.username, deck: null });
    socket.join(code);
    socket.emit('joined', { roomCode: code, playerIndex: idx });
    broadcastLobby(room);
  });

  socket.on('submit_deck', async (submission) => {
    const found = findRoomBySocket(socket.id);
    if (!found) {
      socket.emit('error_msg', 'Not in a room');
      return;
    }
    const { room, index } = found;
    const player = room.players[index];
    try {
      const [protos, actions] = await Promise.all([
        getOwnedProtocols(player.userId),
        getOwnedActions(player.userId),
      ]);
      const err = validateDeckAgainstInventory(
        submission.protocolId,
        submission.actionCardIds,
        protos,
        actions,
      );
      if (err) {
        socket.emit('error_msg', err);
        return;
      }
    } catch (e) {
      sendErrorSocket(socket, e);
      return;
    }
    player.deck = submission;
    broadcastLobby(room);
    if (room.players.length === 2 && room.players.every((p) => p.deck)) {
      room.rewardsApplied = false;
      room.game = createGame(
        room.code,
        { id: room.players[0].socketId, userId: room.players[0].userId, name: room.players[0].name, deck: room.players[0].deck! },
        { id: room.players[1].socketId, userId: room.players[1].userId, name: room.players[1].name, deck: room.players[1].deck! },
      );
      broadcastState(room);
    }
  });

  socket.on('play_card', ({ cardId }) => {
    const found = findRoomBySocket(socket.id);
    if (!found || !found.room.game) return;
    const playerIdx = found.index as 0 | 1;
    const err = playCard(found.room.game, playerIdx, cardId);
    if (err) socket.emit('error_msg', err);
    broadcastState(found.room);
    if (found.room.game.pigeonActive) startPigeonTimer(found.room);
    if (!err) {
      setTimeout(() => advanceTurnIfReady(found.room, playerIdx), 0);
    }
    if (found.room.game.winner !== null) {
      void applyGameEndRewards(found.room).then(() => broadcastState(found.room));
    }
  });

  socket.on('skip_play', () => {
    const found = findRoomBySocket(socket.id);
    if (!found || !found.room.game) return;
    const playerIdx = found.index as 0 | 1;
    const err = skipPlay(found.room.game, playerIdx);
    if (err) socket.emit('error_msg', err);
    broadcastState(found.room);
    if (!err) {
      setTimeout(() => advanceTurnIfReady(found.room, playerIdx), 0);
    }
  });

  socket.on('end_turn', () => {
    const found = findRoomBySocket(socket.id);
    if (!found || !found.room.game) return;
    const err = endTurn(found.room.game, found.index as 0 | 1);
    if (err) socket.emit('error_msg', err);
    broadcastState(found.room);
  });

  socket.on('forfeit', () => {
    const found = findRoomBySocket(socket.id);
    if (!found || !found.room.game) return;
    const playerIdx = found.index as 0 | 1;
    const err = forfeitGame(found.room.game, playerIdx);
    if (err) {
      socket.emit('error_msg', err);
      return;
    }
    stopPigeonTimer(found.room);
    void applyGameEndRewards(found.room).then(() => broadcastState(found.room));
  });

  socket.on('leave_room', () => {
    const found = findRoomBySocket(socket.id);
    if (found) stopPigeonTimer(found.room);
    removePlayerFromRoom(socket.id, false);
  });

  socket.on('disconnect', () => {
    const found = findRoomBySocket(socket.id);
    if (found) {
      stopPigeonTimer(found.room);
      if (found.room.game && found.room.game.winner === null) {
        forfeitGame(found.room.game, found.index as 0 | 1);
        void applyGameEndRewards(found.room).then(() => broadcastState(found.room));
      }
    }
    removePlayerFromRoom(socket.id, true);
  });
});

function sendErrorSocket(socket: { emit: (e: string, msg: string) => void }, err: unknown) {
  if (err instanceof AuthError) {
    socket.emit('error_msg', err.message);
    return;
  }
  console.error(err);
  socket.emit('error_msg', 'Server error');
}

await initAuthDb();
await initInventoryDb();

httpServer.listen(PORT, () => {
  console.log(`Game server listening on :${PORT}`);
});
