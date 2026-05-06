import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import pg from 'pg';
import type { AuthUser } from '../src/shared/types';

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 7;

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface UserRow {
  id: string;
  username: string;
}

interface PasswordRow extends UserRow {
  password_hash: string;
  password_salt: string;
}

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

function requirePool() {
  if (!pool) {
    throw new AuthError(503, 'DATABASE_URL is not configured');
  }
  return pool;
}

function toUser(row: UserRow): AuthUser {
  return { id: row.id, username: row.username };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function validateCredentials(username: string, password: string) {
  if (!/^[a-z0-9_-]{3,20}$/.test(username)) {
    throw new AuthError(400, 'Username must be 3-20 letters, numbers, underscores, or dashes');
  }
  if (password.length < 6 || password.length > 72) {
    throw new AuthError(400, 'Password must be 6-72 characters');
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return { passwordHash: key.toString('hex'), passwordSalt: salt };
}

async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { passwordHash } = await hashPassword(password, salt);
  const actual = Buffer.from(passwordHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createSession(userId: string): Promise<string> {
  const db = requirePool();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  await db.query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + ($3 || ' days')::interval)`,
    [tokenHash, userId, SESSION_DAYS],
  );
  return token;
}

export async function initAuthDb() {
  if (!pool) {
    console.warn('DATABASE_URL is not configured; auth endpoints will return 503.');
    return;
  }

  await pool.query(`
    create table if not exists users (
      id text primary key,
      username text not null unique,
      password_hash text not null,
      password_salt text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists sessions (
      token_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    );
  `);
}

export async function registerUser(usernameInput: string, password: string) {
  const db = requirePool();
  const username = normalizeUsername(usernameInput);
  validateCredentials(username, password);

  const existing = await db.query('select id from users where username = $1', [username]);
  if (existing.rowCount) {
    throw new AuthError(409, 'Username is already taken');
  }

  const { passwordHash, passwordSalt } = await hashPassword(password);
  const id = randomBytes(16).toString('hex');
  const result = await db.query<UserRow>(
    `insert into users (id, username, password_hash, password_salt)
     values ($1, $2, $3, $4)
     returning id, username`,
    [id, username, passwordHash, passwordSalt],
  );
  const user = toUser(result.rows[0]);
  const token = await createSession(user.id);
  return { token, user };
}

export async function loginUser(usernameInput: string, password: string) {
  const db = requirePool();
  const username = normalizeUsername(usernameInput);
  const result = await db.query<PasswordRow>(
    'select id, username, password_hash, password_salt from users where username = $1',
    [username],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AuthError(401, 'Invalid username or password');
  }

  const ok = await verifyPassword(password, row.password_salt, row.password_hash);
  if (!ok) {
    throw new AuthError(401, 'Invalid username or password');
  }

  const user = toUser(row);
  const token = await createSession(user.id);
  return { token, user };
}

export async function userForToken(token: string): Promise<AuthUser | null> {
  const db = requirePool();
  await db.query('delete from sessions where expires_at <= now()');
  const result = await db.query<UserRow>(
    `select u.id, u.username
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export async function logoutToken(token: string) {
  const db = requirePool();
  await db.query('delete from sessions where token_hash = $1', [hashToken(token)]);
}

export function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}
