import type { ActionCardDef, ProtocolCard, Rarity } from './types';

export const PROTOCOLS: ProtocolCard[] = [
  { id: 'IP', name: 'IP', rarity: 'common', hp: 50, atk: 10, ability: 'Deal +1 DMG on each attack' },
  { id: 'TCP', name: 'TCP', title: 'Reliable Connection', rarity: 'legendary', hp: 60, atk: 8, ability: 'All attacks deal an extra +1 DMG' },
  { id: 'UDP', name: 'UDP', title: 'Fast Transfer', rarity: 'epic', hp: 40, atk: 12, ability: '20% chance for action to fail, 20% chance for action to activate twice' },
  { id: 'IPoAC', name: 'IPoAC', title: 'Homing Pigeon', rarity: 'legendary', hp: 35, atk: 15, ability: 'Draw 2 and play 2 cards each turn' },
  { id: 'DNS', name: 'DNS', title: 'Hostname Resolution', rarity: 'epic', hp: 55, atk: 9, ability: "Know what cards are in your opponent's hand at all times" },
  { id: 'HTTP', name: 'HTTP', rarity: 'rare', hp: 40, atk: 10, ability: 'Draw an extra action card per turn' },
  { id: 'TLS', name: 'TLS', title: 'Cryptographic Encryption', rarity: 'rare', hp: 50, atk: 10, ability: 'Reduce all incoming DMG by 2' },
  { id: 'BGP', name: 'BGP', title: 'Inter-domain Routing', rarity: 'rare', hp: 60, atk: 8, ability: 'Heal 2 HP each turn' },
  { id: 'RIP', name: 'RIP', title: 'Intra-domain Routing', rarity: 'epic', hp: 50, atk: 10, ability: 'Gain 1 ATK each turn' },
];

export const PACKET_CARD: ActionCardDef = {
  id: 'packet',
  name: 'Packet',
  rarity: 'base',
  description: 'Deals 100% DMG',
};

export const ACTION_CARDS: ActionCardDef[] = [
  { id: 'fin', name: 'FIN', rarity: 'common', description: 'Discard 2 cards, deal 150% DMG' },
  { id: 'syn', name: 'SYN', rarity: 'common', description: 'Draw 1 card, heal 3 HP' },
  { id: 'bottleneck', name: 'Bottleneck', rarity: 'common', description: "Don't draw a card next turn, but draw an extra 2 cards in 2 turns" },
  { id: 'ethernet', name: 'Ethernet', rarity: 'common', description: 'Block next instance of incoming DMG' },
  { id: 'rst', name: 'RST', rarity: 'common', description: '50% chance of healing 5 HP, 50% chance of dealing 1 DMG' },
  { id: 'advertise_prefix', name: 'Advertise Prefix', rarity: 'common', description: 'Deal 50% DMG this turn, and 70% DMG at the start of next turn' },
  { id: 'authorize_certificate', name: 'Authorize Certificate', rarity: 'common', description: 'For the next 3 turns, deal 20% DMG' },
  { id: 'out_of_order_byte', name: 'Out-of-order byte', rarity: 'common', description: "Steal a random card from opponent's hand and add it to your deck" },
  { id: 'ping', name: 'Ping', rarity: 'common', description: 'Deal 20% DMG and draw 1 card' },
  { id: 'ack', name: 'ACK', rarity: 'common', description: 'Deal 20% DMG, heal 3 HP' },
  { id: 'connection_teardown', name: 'Connection Teardown', rarity: 'common', description: "Discard one action from your and your opponents' hands" },
  { id: 'next_hop', name: 'Next Hop', rarity: 'common', description: 'Draw 1 card' },
  { id: 'handshake', name: 'Handshake', rarity: 'common', description: 'Heal 5 HP' },
  { id: 'trojan', name: 'Trojan', rarity: 'common', secret: true, description: "[Secret] Places virus in opponent's deck, if they draw it take 50% DMG" },

  { id: 'zero_window_probing', name: 'Zero-Window Probing', rarity: 'rare', description: "Steal a random card from opponent's hand and add it to your hand" },
  { id: 'retransmit', name: 'Retransmit', rarity: 'rare', description: 'Play the action card you played last turn' },
  { id: 'drop_packet', name: 'Drop packet', rarity: 'rare', description: "Cancel opponent's next action" },
  { id: 'timeout', name: 'Timeout', rarity: 'rare', description: 'Block incoming DMG for the next two opponent turns' },
  { id: 'validate_checksum', name: 'Validate checksum', rarity: 'rare', description: 'Do nothing this turn, but play your next card an extra two times' },
  { id: 'ip_spoof', name: 'IP Spoof', rarity: 'rare', secret: true, description: "[Secret] Places virus in opponent's hand, at the end of every turn if it's still in their hand deal 50% DMG" },
  { id: 'vscode', name: 'VSCode', rarity: 'rare', devtools: true, description: '[Devtools] If you lose the game, gain 3 bytes instead of 1' },
  { id: 'tmux', name: 'tmux', rarity: 'rare', devtools: true, description: '[Devtools] If you win the game, gain 4 bytes instead of 2' },
  { id: 'rogue_certificate', name: 'Rogue Certificate', rarity: 'rare', secret: true, description: "[Secret] Places virus in opponent's deck, if they draw it they take 200% DMG" },

  { id: 'routing_table', name: 'Routing table', rarity: 'epic', description: 'Discard your hand, each card discarded has a 50% chance to deal 100% DMG' },
  { id: 'edstem', name: 'EdStem', rarity: 'epic', description: 'Draw your entire deck' },
  { id: 'ddos', name: 'DDoS', rarity: 'epic', secret: true, description: '[Secret] Do nothing this turn, but at start of next do 250% DMG' },
  { id: 'ping_of_death', name: 'Ping of Death', rarity: 'epic', secret: true, description: '[Secret] Skip your next two turns, then deal 400% DMG' },
  { id: 'route_hijack', name: 'Route Hijack', rarity: 'epic', secret: true, description: '[Secret] The next time your opponent attacks, DMG is blocked and 50% of DMG gets deflected back onto the opponent' },
  { id: 'wireshark', name: 'Wireshark', rarity: 'epic', devtools: true, description: '[Devtools] Spend 10 bytes. If you win the game, receive 20 bytes, if you lose, receive 0.' },

  { id: 'nick_demarinis', name: 'Nick DeMarinis', rarity: 'legendary', description: 'If deck is empty, wins the game' },
  { id: 'pigeon_delivery', name: 'Pigeon delivery', rarity: 'legendary', description: 'Play random cards against you or your opponent until game ends' },
  { id: 'claude_code', name: 'Claude Code', rarity: 'legendary', devtools: true, description: '[Devtools] Spend 20 bytes to win the game instantly' },
];

export const ALL_ACTION_CARDS: ActionCardDef[] = [PACKET_CARD, ...ACTION_CARDS];

export const PROTOCOL_BY_ID: Record<string, ProtocolCard> = Object.fromEntries(
  PROTOCOLS.map((p) => [p.id, p]),
);

export const ACTION_BY_ID: Record<string, ActionCardDef> = Object.fromEntries(
  ALL_ACTION_CARDS.map((c) => [c.id, c]),
);

export function cardName(id: string): string {
  return ACTION_BY_ID[id]?.name ?? id;
}

export function isSecret(id: string): boolean {
  return ACTION_BY_ID[id]?.secret === true;
}

export const RARITY_RATES: Record<Exclude<Rarity, 'base'>, number> = {
  legendary: 0.01,
  epic: 0.10,
  rare: 0.25,
  common: 0.64,
};

export const PACK_COST = 10;
export const STARTING_BYTES = 25;
export const PACK_SIZE = 5;
export const HAND_LIMIT = 7;
export const ACTION_CARD_LIMIT = 3;
export const PROTOCOL_COPY_LIMIT = 1;

export function actionsByRarity(rarity: Exclude<Rarity, 'base'>): ActionCardDef[] {
  return ACTION_CARDS.filter((c) => c.rarity === rarity);
}

export function protocolsByRarity(rarity: Exclude<Rarity, 'base'>): ProtocolCard[] {
  return PROTOCOLS.filter((p) => p.rarity === rarity);
}

export function defaultStartingActionCards(): { id: string; count: number }[] {
  return ACTION_CARDS.filter((c) => c.rarity === 'common').map((c) => ({ id: c.id, count: 2 }));
}

export function validateDeck(actionCardIds: string[]): string | null {
  if (actionCardIds.length !== 20) return 'Deck must have exactly 20 action cards';
  const counts: Record<string, number> = {};
  for (const id of actionCardIds) {
    if (!ACTION_CARDS.find((c) => c.id === id)) return `Unknown card: ${id}`;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  const max = Math.max(...Object.values(counts));
  if (max > ACTION_CARD_LIMIT) return `Deck can include at most ${ACTION_CARD_LIMIT} copies of each action card`;
  return null;
}

export function validateDeckAgainstInventory(
  protocolId: string,
  actionCardIds: string[],
  ownedProtocols: Map<string, number>,
  ownedActions: Map<string, number>,
): string | null {
  const general = validateDeck(actionCardIds);
  if (general) return general;
  if (!PROTOCOL_BY_ID[protocolId]) return `Unknown protocol: ${protocolId}`;
  if (!ownedProtocols.has(protocolId) || (ownedProtocols.get(protocolId) ?? 0) < 1) {
    return `You don't own protocol ${PROTOCOL_BY_ID[protocolId].name}`;
  }
  const counts: Record<string, number> = {};
  for (const id of actionCardIds) counts[id] = (counts[id] ?? 0) + 1;
  for (const [id, n] of Object.entries(counts)) {
    const owned = ownedActions.get(id) ?? 0;
    if (owned < n) {
      return `You only own ${owned} of ${ACTION_BY_ID[id]?.name ?? id}; deck requires ${n}`;
    }
  }
  return null;
}
