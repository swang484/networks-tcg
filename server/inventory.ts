import pg from 'pg';
import {
  ACTION_CARDS,
  ACTION_CARD_LIMIT,
  PACK_COST,
  PACK_SIZE,
  PROTOCOLS,
  PROTOCOL_COPY_LIMIT,
  RARITY_RATES,
  STARTING_BYTES,
  actionsByRarity,
  defaultStartingActionCards,
  protocolsByRarity,
} from '../src/shared/cards';
import type {
  InventoryView,
  PackResult,
  PackResultEntry,
  Rarity,
} from '../src/shared/types';
import { AuthError } from './auth';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

function requirePool() {
  if (!pool) throw new AuthError(503, 'DATABASE_URL is not configured');
  return pool;
}

export async function initInventoryDb() {
  if (!pool) return;
  await pool.query(`
    create table if not exists user_bytes (
      user_id text primary key references users(id) on delete cascade,
      bytes integer not null default 0
    );

    create table if not exists user_daily_claims (
      user_id text primary key references users(id) on delete cascade,
      last_claim_date date not null
    );

    create table if not exists user_protocols (
      user_id text not null references users(id) on delete cascade,
      protocol_id text not null,
      count integer not null default 0,
      primary key (user_id, protocol_id)
    );

    create table if not exists user_actions (
      user_id text not null references users(id) on delete cascade,
      action_id text not null,
      count integer not null default 0,
      primary key (user_id, action_id)
    );
  `);
}

export async function ensureStartingInventory(userId: string) {
  const db = requirePool();
  const existing = await db.query('select user_id from user_bytes where user_id = $1', [userId]);
  if (existing.rowCount) return;
  await db.query('insert into user_bytes (user_id, bytes) values ($1, $2)', [userId, STARTING_BYTES]);
  await db.query(
    'insert into user_protocols (user_id, protocol_id, count) values ($1, $2, $3)',
    [userId, 'IP', 1],
  );
  for (const { id, count } of defaultStartingActionCards()) {
    await db.query(
      'insert into user_actions (user_id, action_id, count) values ($1, $2, $3)',
      [userId, id, count],
    );
  }
}

export async function getBytes(userId: string): Promise<number> {
  const db = requirePool();
  const r = await db.query<{ bytes: number }>(
    'select bytes from user_bytes where user_id = $1',
    [userId],
  );
  return r.rows[0]?.bytes ?? 0;
}

export async function addBytes(userId: string, delta: number): Promise<number> {
  const db = requirePool();
  const r = await db.query<{ bytes: number }>(
    `update user_bytes set bytes = bytes + $2 where user_id = $1 returning bytes`,
    [userId, delta],
  );
  if (r.rowCount === 0) {
    await db.query('insert into user_bytes (user_id, bytes) values ($1, $2)', [userId, Math.max(0, delta)]);
    return Math.max(0, delta);
  }
  return r.rows[0].bytes;
}

export async function claimDailyBytes(userId: string, amount: number): Promise<number> {
  const db = requirePool();
  const today = await db.query<{ today: string }>('select current_date::text as today');
  const claimDate = today.rows[0].today;
  const r = await db.query(
    `insert into user_daily_claims (user_id, last_claim_date)
     values ($1, $2)
     on conflict (user_id) do update
       set last_claim_date = excluded.last_claim_date
       where user_daily_claims.last_claim_date < excluded.last_claim_date
     returning user_id`,
    [userId, claimDate],
  );
  if (r.rowCount === 0) throw new AuthError(400, 'Daily claim already used');
  return addBytes(userId, amount);
}

async function spendBytes(userId: string, amount: number): Promise<number> {
  const db = requirePool();
  const r = await db.query<{ bytes: number }>(
    `update user_bytes set bytes = bytes - $2
     where user_id = $1 and bytes >= $2
     returning bytes`,
    [userId, amount],
  );
  if (r.rowCount === 0) throw new AuthError(400, 'Not enough bytes');
  return r.rows[0].bytes;
}

export async function getOwnedProtocols(userId: string): Promise<Map<string, number>> {
  const db = requirePool();
  const r = await db.query<{ protocol_id: string; count: number }>(
    'select protocol_id, count from user_protocols where user_id = $1 and count > 0',
    [userId],
  );
  return new Map(r.rows.map((x) => [x.protocol_id, x.count]));
}

export async function getOwnedActions(userId: string): Promise<Map<string, number>> {
  const db = requirePool();
  const r = await db.query<{ action_id: string; count: number }>(
    'select action_id, count from user_actions where user_id = $1 and count > 0',
    [userId],
  );
  return new Map(r.rows.map((x) => [x.action_id, x.count]));
}

export async function getInventory(userId: string): Promise<InventoryView> {
  const [bytes, protocols, actions] = await Promise.all([
    getBytes(userId),
    getOwnedProtocols(userId),
    getOwnedActions(userId),
  ]);
  return {
    bytes,
    protocols: [...protocols.entries()].map(([id, count]) => ({ id, count })),
    actionCards: [...actions.entries()].map(([id, count]) => ({ id, count })),
  };
}

async function addProtocolCopy(userId: string, protocolId: string): Promise<{ duplicate: boolean }> {
  const db = requirePool();
  const r = await db.query<{ count: number }>(
    'select count from user_protocols where user_id = $1 and protocol_id = $2',
    [userId, protocolId],
  );
  const current = r.rows[0]?.count ?? 0;
  if (current >= PROTOCOL_COPY_LIMIT) return { duplicate: true };
  if (r.rowCount) {
    await db.query(
      'update user_protocols set count = count + 1 where user_id = $1 and protocol_id = $2',
      [userId, protocolId],
    );
  } else {
    await db.query(
      'insert into user_protocols (user_id, protocol_id, count) values ($1, $2, 1)',
      [userId, protocolId],
    );
  }
  return { duplicate: false };
}

async function addActionCopy(userId: string, actionId: string): Promise<{ duplicate: boolean }> {
  const db = requirePool();
  const r = await db.query<{ count: number }>(
    'select count from user_actions where user_id = $1 and action_id = $2',
    [userId, actionId],
  );
  const current = r.rows[0]?.count ?? 0;
  if (current >= ACTION_CARD_LIMIT) return { duplicate: true };
  if (r.rowCount) {
    await db.query(
      'update user_actions set count = count + 1 where user_id = $1 and action_id = $2',
      [userId, actionId],
    );
  } else {
    await db.query(
      'insert into user_actions (user_id, action_id, count) values ($1, $2, 1)',
      [userId, actionId],
    );
  }
  return { duplicate: false };
}

function rollRarity(): Exclude<Rarity, 'base'> {
  const r = Math.random();
  let acc = 0;
  for (const rarity of ['legendary', 'epic', 'rare', 'common'] as const) {
    acc += RARITY_RATES[rarity];
    if (r < acc) return rarity;
  }
  return 'common';
}

export async function openPack(userId: string): Promise<PackResult> {
  await spendBytes(userId, PACK_COST);
  const cards: PackResultEntry[] = [];
  let refunds = 0;
  for (let i = 0; i < PACK_SIZE; i++) {
    const isProtocol = Math.random() < 0.2;
    const rarity = rollRarity();
    if (isProtocol) {
      const pool = protocolsByRarity(rarity);
      if (pool.length === 0) {
        const fallback = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
        const { duplicate } = await addProtocolCopy(userId, fallback.id);
        const refund = duplicate ? 1 : 0;
        if (duplicate) refunds += refund;
        cards.push({ cardKind: 'protocol', cardId: fallback.id, duplicate, bytesRefunded: refund });
        continue;
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const { duplicate } = await addProtocolCopy(userId, pick.id);
      const refund = duplicate ? 1 : 0;
      if (duplicate) refunds += refund;
      cards.push({ cardKind: 'protocol', cardId: pick.id, duplicate, bytesRefunded: refund });
    } else {
      const pool = actionsByRarity(rarity);
      const fallbackPool = pool.length > 0 ? pool : ACTION_CARDS;
      const pick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
      const { duplicate } = await addActionCopy(userId, pick.id);
      const refund = duplicate ? 1 : 0;
      if (duplicate) refunds += refund;
      cards.push({ cardKind: 'action', cardId: pick.id, duplicate, bytesRefunded: refund });
    }
  }
  if (refunds > 0) await addBytes(userId, refunds);
  const bytes = await getBytes(userId);
  return { cards, bytes };
}
