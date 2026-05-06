export type Phase = 'start' | 'play' | 'action' | 'end';

export type Rarity = 'base' | 'common' | 'rare' | 'epic' | 'legendary';

export interface ProtocolCard {
  id: string;
  name: string;
  title?: string;
  rarity: Rarity;
  hp: number;
  atk: number;
  ability: string;
}

export interface ActionCardDef {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  secret?: boolean;
  devtools?: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface InventoryView {
  protocols: { id: string; count: number }[];
  actionCards: { id: string; count: number }[];
  bytes: number;
}

export interface PackResultEntry {
  cardKind: 'protocol' | 'action';
  cardId: string;
  duplicate: boolean;
  bytesRefunded: number;
}

export interface PackResult {
  cards: PackResultEntry[];
  bytes: number;
}

export interface PlayerState {
  id: string;
  userId: string | null;
  name: string;
  protocolId: string;
  hp: number;
  maxHp: number;
  atk: number;
  deck: string[];
  hand: string[];
  discard: string[];
  blockTurnsRemaining: number;
  pendingMultiplierUses: number;
  lastPlayedCardId: string | null;
  ddosArmed: boolean;
  skipNextAction: boolean;
  blockNextHitTurns: number;
  deflectNextHitTurns: number;
  skipDrawTurns: number;
  bonusDrawTurns: number;
  authorizeCertTurns: number;
  delayedDamageNextStart: number;
  pingOfDeathTurnsLeft: number;
  pingOfDeathPending: number;
  ipSpoofInHand: boolean;
  vsCodeBonus: boolean;
  tmuxBonus: boolean;
  wiresharkActive: boolean;
}

export interface GameState {
  roomCode: string;
  players: [PlayerState, PlayerState];
  firstPlayerIdx: 0 | 1;
  activePlayerIdx: 0 | 1;
  turn: number;
  phase: Phase;
  log: string[];
  winner: number | null;
  ipoacExtraPlayPending: boolean;
  pigeonActive: boolean;
  forfeitedIdx: 0 | 1 | null;
  bytesAwarded: { winner: number; loser: number } | null;
}

export interface DeckSubmission {
  protocolId: string;
  actionCardIds: string[];
}

export interface OpponentView {
  id: string;
  name: string;
  protocolId: string;
  hp: number;
  maxHp: number;
  atk: number;
  handCount: number;
  deckCount: number;
  discardCount: number;
  visibleHand: string[] | null;
}

export interface PlayerView {
  you: PlayerState;
  opponent: OpponentView;
  yourIndex: 0 | 1;
  turn: number;
  phase: Phase;
  activePlayerIdx: 0 | 1;
  log: string[];
  winner: number | null;
  roomCode: string;
  pigeonActive: boolean;
  bytesAwarded: { winner: number; loser: number } | null;
}

export interface ServerToClientEvents {
  joined: (data: { roomCode: string; playerIndex: 0 | 1 }) => void;
  lobby_update: (data: { players: { name: string; ready: boolean }[] }) => void;
  state_update: (view: PlayerView) => void;
  error_msg: (msg: string) => void;
}

export interface ClientToServerEvents {
  create_or_join: (data: { roomCode: string; authToken: string }) => void;
  leave_room: () => void;
  submit_deck: (data: DeckSubmission) => void;
  draw: () => void;
  play_card: (data: { cardId: string }) => void;
  skip_play: () => void;
  end_turn: () => void;
  forfeit: () => void;
}
