import {
  ACTION_BY_ID,
  ACTION_CARDS,
  HAND_LIMIT,
  PACKET_CARD,
  PROTOCOL_BY_ID,
  cardName,
  isSecret,
} from '../src/shared/cards';
import type {
  DeckSubmission,
  GameState,
  PlayerState,
  PlayerView,
  Phase,
} from '../src/shared/types';

const VIRUS_DECK_TROJAN = 'virus_trojan';
const VIRUS_DECK_ROGUE = 'virus_rogue';
const VIRUS_HAND_IPSPOOF = 'virus_ipspoof';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(submission: DeckSubmission): string[] {
  const cards = [...submission.actionCardIds];
  for (let i = 0; i < 10; i++) cards.push(PACKET_CARD.id);
  return shuffle(cards);
}

function makePlayer(
  id: string,
  userId: string | null,
  name: string,
  submission: DeckSubmission,
): PlayerState {
  const proto = PROTOCOL_BY_ID[submission.protocolId];
  return {
    id,
    userId,
    name,
    protocolId: submission.protocolId,
    hp: proto.hp,
    maxHp: proto.hp,
    atk: proto.atk,
    deck: buildDeck(submission),
    hand: [],
    discard: [],
    blockTurnsRemaining: 0,
    pendingMultiplierUses: 0,
    lastPlayedCardId: null,
    ddosArmed: false,
    skipNextAction: false,
    blockNextHitTurns: 0,
    deflectNextHitTurns: 0,
    skipDrawTurns: 0,
    bonusDrawTurns: 0,
    authorizeCertTurns: 0,
    delayedDamageNextStart: 0,
    pingOfDeathTurnsLeft: 0,
    pingOfDeathPending: 0,
    ipSpoofInHand: false,
    vsCodeBonus: false,
    tmuxBonus: false,
    wiresharkActive: false,
  };
}

export function createGame(
  roomCode: string,
  p0: { id: string; userId: string | null; name: string; deck: DeckSubmission },
  p1: { id: string; userId: string | null; name: string; deck: DeckSubmission },
): GameState {
  const player0 = makePlayer(p0.id, p0.userId, p0.name, p0.deck);
  const player1 = makePlayer(p1.id, p1.userId, p1.name, p1.deck);
  const firstPlayerIdx = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
  const state: GameState = {
    roomCode,
    players: [player0, player1],
    firstPlayerIdx,
    activePlayerIdx: firstPlayerIdx,
    turn: 1,
    phase: 'start',
    log: [`Game start. ${[player0, player1][firstPlayerIdx].name} goes first.`],
    winner: null,
    ipoacExtraPlayPending: false,
    pigeonActive: false,
    forfeitedIdx: null,
    bytesAwarded: null,
  };
  for (let i = 0; i < 3; i++) drawCard(state, firstPlayerIdx);
  for (let i = 0; i < 4; i++) drawCard(state, (1 - firstPlayerIdx) as 0 | 1);
  applyStartPhase(state);
  return state;
}

function refreshIpSpoofFlag(player: PlayerState) {
  player.ipSpoofInHand = player.hand.includes(VIRUS_HAND_IPSPOOF);
}

function drawCard(state: GameState, playerIdx: 0 | 1): string | null {
  const player = state.players[playerIdx];
  if (player.deck.length === 0) {
    if (player.discard.length === 0) return null;
    player.deck = shuffle(player.discard);
    player.discard = [];
  }
  const c = player.deck.shift()!;

  if (c === VIRUS_DECK_TROJAN) {
    const dmg = Math.floor(computeDamage(state, 1 - playerIdx, 0.5));
    applyDamage(state, playerIdx, dmg);
    logMsg(state, `${player.name} drew a Trojan virus and takes ${dmg} DMG.`);
    return null;
  }
  if (c === VIRUS_DECK_ROGUE) {
    const dmg = Math.floor(computeDamage(state, 1 - playerIdx, 2.0));
    applyDamage(state, playerIdx, dmg);
    logMsg(state, `${player.name} drew a Rogue Certificate virus and takes ${dmg} DMG.`);
    return null;
  }

  if (player.hand.length >= HAND_LIMIT) {
    player.discard.push(c);
    logMsg(state, `${player.name} burns a card (hand full).`);
    return null;
  }
  player.hand.push(c);
  refreshIpSpoofFlag(player);
  return c;
}

function logMsg(state: GameState, msg: string) {
  state.log.push(msg);
  if (state.log.length > 200) state.log.shift();
}

function logSecret(state: GameState, playerName: string, ownerLine: string) {
  state.log.push(`__SECRET__|${playerName}|${ownerLine}`);
  if (state.log.length > 200) state.log.shift();
}

function applyStartPhase(state: GameState) {
  if (state.winner !== null) return;
  const active = state.players[state.activePlayerIdx];
  const proto = active.protocolId;

  if (active.blockNextHitTurns > 0) active.blockNextHitTurns -= 1;
  if (active.deflectNextHitTurns > 0) active.deflectNextHitTurns -= 1;

  if (active.delayedDamageNextStart > 0) {
    const dmg = Math.floor(active.delayedDamageNextStart);
    applyDamage(state, state.activePlayerIdx, dmg);
    logMsg(state, `${active.name} takes ${dmg} delayed DMG.`);
    active.delayedDamageNextStart = 0;
    if (state.winner !== null) return;
  }

  let drawCount = 1;
  if (proto === 'HTTP') drawCount += 1;
  if (proto === 'IPoAC') drawCount += 1;
  if (active.skipDrawTurns > 0) {
    drawCount = 0;
    active.skipDrawTurns -= 1;
    logMsg(state, `${active.name} skips drawing (Bottleneck).`);
  }
  if (active.bonusDrawTurns > 0) {
    drawCount += 2;
    active.bonusDrawTurns -= 1;
    logMsg(state, `${active.name} draws 2 extra (Bottleneck).`);
  }
  for (let i = 0; i < drawCount; i++) drawCard(state, state.activePlayerIdx);

  if (proto === 'BGP') {
    active.hp = Math.min(active.maxHp, active.hp + 2);
    logMsg(state, `${active.name} (BGP) heals 2 HP.`);
  }
  if (proto === 'RIP') {
    active.atk += 1;
    logMsg(state, `${active.name} (RIP) gains 1 ATK.`);
  }

  if (active.ddosArmed) {
    const dmg = Math.floor(computeDamage(state, state.activePlayerIdx, 2.5));
    applyDamage(state, 1 - state.activePlayerIdx, dmg);
    active.ddosArmed = false;
    logMsg(state, `${active.name}'s DDoS hits for ${dmg}.`);
    if (state.winner !== null) return;
  }

  if (active.pingOfDeathTurnsLeft > 0) {
    active.pingOfDeathTurnsLeft -= 1;
    if (active.pingOfDeathTurnsLeft === 0 && active.pingOfDeathPending > 0) {
      const dmg = Math.floor(computeDamage(state, state.activePlayerIdx, active.pingOfDeathPending));
      applyDamage(state, 1 - state.activePlayerIdx, dmg);
      logMsg(state, `${active.name}'s Ping of Death detonates for ${dmg}.`);
      active.pingOfDeathPending = 0;
      if (state.winner !== null) return;
    } else {
      logMsg(state, `${active.name} is charging Ping of Death and skips this turn.`);
      const opponentIdx = (1 - state.activePlayerIdx) as 0 | 1;
      const opp = state.players[opponentIdx];
      if (opp.blockTurnsRemaining > 0) opp.blockTurnsRemaining -= 1;
      state.activePlayerIdx = opponentIdx;
      state.turn += 1;
      state.phase = 'start';
      applyStartPhase(state);
      return;
    }
  }

  state.phase = 'play';
  state.ipoacExtraPlayPending = proto === 'IPoAC';
}

function computeDamage(state: GameState, attackerIdx: number, percent: number): number {
  const attacker = state.players[attackerIdx];
  const defender = state.players[1 - attackerIdx];
  let dmg = attacker.atk * percent;
  if (attacker.protocolId === 'IP') dmg += 1;
  if (attacker.protocolId === 'TCP') dmg += 1;
  if (defender.protocolId === 'TLS') dmg = Math.max(0, dmg - 2);
  if (defender.blockTurnsRemaining > 0) dmg = 0;
  if (defender.blockNextHitTurns > 0) dmg = 0;
  return dmg;
}

function applyDamage(state: GameState, targetIdx: number, dmg: number) {
  const target = state.players[targetIdx];
  if (target.deflectNextHitTurns > 0 && dmg > 0) {
    target.deflectNextHitTurns = 0;
    target.blockNextHitTurns = 0;
    const reflected = Math.floor(dmg * 0.5);
    const attackerIdx = (1 - targetIdx) as 0 | 1;
    const attacker = state.players[attackerIdx];
    attacker.hp = Math.max(0, attacker.hp - reflected);
    logMsg(state, `${target.name} deflects! ${attacker.name} takes ${reflected} DMG.`);
    if (attacker.hp <= 0) {
      state.winner = targetIdx;
      logMsg(state, `${attacker.name} has been defeated.`);
    }
    return;
  }
  if (target.blockNextHitTurns > 0 && dmg > 0) {
    target.blockNextHitTurns = 0;
    logMsg(state, `${target.name} blocks the hit (Ethernet).`);
    return;
  }
  target.hp = Math.max(0, target.hp - dmg);
  if (target.hp <= 0) {
    state.winner = (1 - targetIdx);
    logMsg(state, `${target.name} has been defeated.`);
  }
}

function discardRandom(player: PlayerState): string | null {
  if (player.hand.length === 0) return null;
  const idx = Math.floor(Math.random() * player.hand.length);
  const [card] = player.hand.splice(idx, 1);
  player.discard.push(card);
  refreshIpSpoofFlag(player);
  return card;
}

function discardSpecific(player: PlayerState, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const c = discardRandom(player);
    if (!c) break;
    out.push(c);
  }
  return out;
}

function insertRandom(deck: string[], cardId: string) {
  const idx = Math.floor(Math.random() * (deck.length + 1));
  deck.splice(idx, 0, cardId);
}

function executeCardEffect(state: GameState, playerIdx: 0 | 1, cardId: string): void {
  const player = state.players[playerIdx];
  const oppIdx = (1 - playerIdx) as 0 | 1;
  const opponent = state.players[oppIdx];

  switch (cardId) {
    case 'packet': {
      const dmg = Math.floor(computeDamage(state, playerIdx, 1.0));
      applyDamage(state, oppIdx, dmg);
      logMsg(state, `${player.name} plays Packet for ${dmg} DMG.`);
      break;
    }
    case 'fin': {
      discardSpecific(player, 2);
      const dmg = Math.floor(computeDamage(state, playerIdx, 1.5));
      applyDamage(state, oppIdx, dmg);
      logMsg(state, `${player.name} plays FIN: discards 2, deals ${dmg} DMG.`);
      break;
    }
    case 'syn': {
      drawCard(state, playerIdx);
      player.hp = Math.min(player.maxHp, player.hp + 3);
      logMsg(state, `${player.name} plays SYN: draws and heals 3.`);
      break;
    }
    case 'bottleneck': {
      player.skipDrawTurns += 1;
      player.bonusDrawTurns += 1;
      logMsg(state, `${player.name} plays Bottleneck.`);
      break;
    }
    case 'ethernet': {
      player.blockNextHitTurns = 1;
      logMsg(state, `${player.name} plays Ethernet (block next hit, expires after opponent's turn).`);
      break;
    }
    case 'rst': {
      if (Math.random() < 0.5) {
        player.hp = Math.min(player.maxHp, player.hp + 5);
        logMsg(state, `${player.name} plays RST and heals 5.`);
      } else {
        applyDamage(state, playerIdx, 1);
        logMsg(state, `${player.name} plays RST and takes 1 DMG.`);
      }
      break;
    }
    case 'advertise_prefix': {
      const dmg = Math.floor(computeDamage(state, playerIdx, 0.5));
      applyDamage(state, oppIdx, dmg);
      opponent.delayedDamageNextStart += Math.floor(player.atk * 0.7);
      logMsg(state, `${player.name} plays Advertise Prefix for ${dmg} DMG (more next turn).`);
      break;
    }
    case 'authorize_certificate': {
      player.authorizeCertTurns += 3;
      logMsg(state, `${player.name} plays Authorize Certificate (20% DMG for 3 turns).`);
      break;
    }
    case 'out_of_order_byte': {
      if (opponent.hand.length === 0) {
        logMsg(state, `${player.name} plays Out-of-order byte but opponent's hand is empty.`);
        break;
      }
      const idx = Math.floor(Math.random() * opponent.hand.length);
      const [stolen] = opponent.hand.splice(idx, 1);
      refreshIpSpoofFlag(opponent);
      insertRandom(player.deck, stolen);
      logMsg(state, `${player.name} plays Out-of-order byte and steals a card into their deck.`);
      break;
    }
    case 'ping': {
      const dmg = Math.floor(computeDamage(state, playerIdx, 0.2));
      applyDamage(state, oppIdx, dmg);
      drawCard(state, playerIdx);
      logMsg(state, `${player.name} plays Ping for ${dmg} DMG and draws.`);
      break;
    }
    case 'ack': {
      const dmg = Math.floor(computeDamage(state, playerIdx, 0.2));
      applyDamage(state, oppIdx, dmg);
      player.hp = Math.min(player.maxHp, player.hp + 3);
      logMsg(state, `${player.name} plays ACK for ${dmg} DMG and heals 3.`);
      break;
    }
    case 'connection_teardown': {
      const a = discardRandom(player);
      const b = discardRandom(opponent);
      logMsg(
        state,
        `Connection Teardown: ${player.name} discards ${a ? cardName(a) : 'nothing'}, ${opponent.name} discards ${b ? cardName(b) : 'nothing'}.`,
      );
      break;
    }
    case 'next_hop': {
      drawCard(state, playerIdx);
      logMsg(state, `${player.name} plays Next Hop and draws.`);
      break;
    }
    case 'handshake': {
      player.hp = Math.min(player.maxHp, player.hp + 5);
      logMsg(state, `${player.name} plays Handshake and heals 5.`);
      break;
    }
    case 'trojan': {
      insertRandom(opponent.deck, VIRUS_DECK_TROJAN);
      logSecret(state, player.name, `${player.name} plays Trojan (virus into opponent deck).`);
      break;
    }
    case 'zero_window_probing': {
      if (opponent.hand.length === 0) {
        logMsg(state, `${player.name} plays Zero-Window Probing but opponent's hand is empty.`);
        break;
      }
      const idx = Math.floor(Math.random() * opponent.hand.length);
      const [stolen] = opponent.hand.splice(idx, 1);
      refreshIpSpoofFlag(opponent);
      if (player.hand.length >= HAND_LIMIT) {
        player.discard.push(stolen);
        logMsg(state, `${player.name} steals a card but burns it (hand full).`);
      } else {
        player.hand.push(stolen);
        refreshIpSpoofFlag(player);
        logMsg(state, `${player.name} plays Zero-Window Probing and steals a card.`);
      }
      break;
    }
    case 'retransmit': {
      const last = player.lastPlayedCardId;
      if (last && last !== 'retransmit') {
        logMsg(state, `${player.name} retransmits ${cardName(last)}.`);
        executeCardEffect(state, playerIdx, last);
      } else {
        logMsg(state, `${player.name} retransmits nothing.`);
      }
      break;
    }
    case 'drop_packet': {
      opponent.skipNextAction = true;
      logMsg(state, `${player.name} plays Drop packet (cancels opponent's next action).`);
      break;
    }
    case 'timeout': {
      player.blockTurnsRemaining = 2;
      logMsg(state, `${player.name} plays Timeout (blocks two turns).`);
      break;
    }
    case 'validate_checksum': {
      player.pendingMultiplierUses = 1;
      logMsg(state, `${player.name} plays Validate checksum (next card x3).`);
      break;
    }
    case 'ip_spoof': {
      if (opponent.hand.length < HAND_LIMIT) {
        opponent.hand.push(VIRUS_HAND_IPSPOOF);
        refreshIpSpoofFlag(opponent);
      }
      logSecret(state, player.name, `${player.name} plays IP Spoof (virus into opponent hand).`);
      break;
    }
    case 'vscode': {
      player.vsCodeBonus = true;
      logMsg(state, `${player.name} plays VSCode (loss bonus armed).`);
      break;
    }
    case 'tmux': {
      player.tmuxBonus = true;
      logMsg(state, `${player.name} plays tmux (win bonus armed).`);
      break;
    }
    case 'rogue_certificate': {
      insertRandom(opponent.deck, VIRUS_DECK_ROGUE);
      logSecret(state, player.name, `${player.name} plays Rogue Certificate (virus into opponent deck).`);
      break;
    }
    case 'routing_table': {
      const hand = [...player.hand];
      player.hand = [];
      let totalDmg = 0;
      for (const c of hand) {
        player.discard.push(c);
        if (Math.random() < 0.5) {
          totalDmg += Math.floor(computeDamage(state, playerIdx, 1.0));
        }
      }
      refreshIpSpoofFlag(player);
      if (totalDmg > 0) applyDamage(state, oppIdx, totalDmg);
      logMsg(state, `${player.name} plays Routing table: discards ${hand.length}, deals ${totalDmg} DMG.`);
      break;
    }
    case 'edstem': {
      const drawn = player.deck.length;
      while (player.deck.length > 0) drawCard(state, playerIdx);
      logMsg(state, `${player.name} plays EdStem and draws ${drawn} cards.`);
      break;
    }
    case 'ddos': {
      player.ddosArmed = true;
      logSecret(state, player.name, `${player.name} arms DDoS for next turn.`);
      break;
    }
    case 'ping_of_death': {
      player.pingOfDeathTurnsLeft = 2;
      player.pingOfDeathPending = 4.0;
      logSecret(state, player.name, `${player.name} charges Ping of Death.`);
      break;
    }
    case 'route_hijack': {
      player.deflectNextHitTurns = 1;
      player.blockNextHitTurns = 1;
      logSecret(state, player.name, `${player.name} prepares Route Hijack (block + deflect).`);
      break;
    }
    case 'wireshark': {
      player.wiresharkActive = true;
      logMsg(state, `${player.name} plays Wireshark (high-stakes wager).`);
      break;
    }
    case 'nick_demarinis': {
      if (player.deck.length === 0) {
        state.winner = playerIdx;
        logMsg(state, `${player.name} plays Nick DeMarinis on empty deck — they win!`);
      } else {
        logMsg(state, `${player.name} plays Nick DeMarinis but deck is not empty.`);
      }
      break;
    }
    case 'pigeon_delivery': {
      state.pigeonActive = true;
      logMsg(state, `${player.name} unleashes Pigeon delivery! Random cards rain down.`);
      break;
    }
    case 'claude_code': {
      state.winner = playerIdx;
      logMsg(state, `${player.name} invokes Claude Code and wins instantly.`);
      break;
    }
    default:
      logMsg(state, `${player.name} plays unknown card ${cardId}.`);
  }
}

export function playCard(state: GameState, playerIdx: 0 | 1, cardId: string): string | null {
  if (state.winner !== null) return 'Game over';
  if (state.activePlayerIdx !== playerIdx) return 'Not your turn';
  if (state.phase !== 'play') return 'Not play phase';
  const player = state.players[playerIdx];
  const handIdx = player.hand.indexOf(cardId);
  if (handIdx === -1) return 'Card not in hand';

  player.hand.splice(handIdx, 1);
  player.discard.push(cardId);
  refreshIpSpoofFlag(player);

  state.phase = 'action';

  if (player.skipNextAction) {
    player.skipNextAction = false;
    logMsg(state, `${player.name}'s ${cardName(cardId)} was dropped by opponent.`);
    player.lastPlayedCardId = cardId;
    state.phase = 'end';
    return null;
  }

  let plays = 1;
  if (player.pendingMultiplierUses > 0 && cardId !== 'validate_checksum') {
    plays += 2;
    player.pendingMultiplierUses = 0;
  }

  if (player.protocolId === 'UDP') {
    const roll = Math.random();
    if (roll < 0.2) {
      logMsg(state, `${player.name}'s UDP action fails (${cardName(cardId)}).`);
      plays = 0;
    } else if (roll < 0.4) {
      logMsg(state, `${player.name}'s UDP action activates twice (${cardName(cardId)}).`);
      plays += 1;
    }
  }

  for (let i = 0; i < plays; i++) {
    if (state.winner !== null) break;
    executeCardEffect(state, playerIdx, cardId);
  }

  if (player.authorizeCertTurns > 0 && state.winner === null) {
    const dmg = Math.floor(computeDamage(state, playerIdx, 0.2));
    applyDamage(state, (1 - playerIdx) as 0 | 1, dmg);
    logMsg(state, `${player.name}'s Authorize Certificate ticks for ${dmg} DMG.`);
    player.authorizeCertTurns -= 1;
  }

  player.lastPlayedCardId = cardId;
  state.phase = 'end';
  return null;
}

function applyEndOfTurnEffects(state: GameState, playerIdx: 0 | 1) {
  if (state.winner !== null) return;
  const player = state.players[playerIdx];
  if (player.ipSpoofInHand) {
    const dmg = Math.floor(computeDamage(state, (1 - playerIdx) as 0 | 1, 0.5));
    applyDamage(state, playerIdx, dmg);
    logMsg(state, `${player.name}'s IP Spoof virus ticks for ${dmg} DMG.`);
  }
}

export function endTurn(state: GameState, playerIdx: 0 | 1): string | null {
  if (state.winner !== null) return 'Game over';
  if (state.activePlayerIdx !== playerIdx) return 'Not your turn';

  if (state.ipoacExtraPlayPending && state.players[playerIdx].protocolId === 'IPoAC') {
    state.ipoacExtraPlayPending = false;
    if (state.players[playerIdx].hand.length > 0) {
      state.phase = 'play';
      logMsg(state, `${state.players[playerIdx].name} (IPoAC) plays a second card.`);
      return null;
    }
  }

  applyEndOfTurnEffects(state, playerIdx);
  if (state.winner !== null) return null;

  const opponentIdx = (1 - playerIdx) as 0 | 1;
  const opp = state.players[opponentIdx];
  if (opp.blockTurnsRemaining > 0) opp.blockTurnsRemaining -= 1;

  state.activePlayerIdx = opponentIdx;
  state.turn += 1;
  state.phase = 'start';
  applyStartPhase(state);
  return null;
}

export function skipPlay(state: GameState, playerIdx: 0 | 1): string | null {
  if (state.activePlayerIdx !== playerIdx) return 'Not your turn';
  if (state.phase !== 'play') return 'Not play phase';
  state.phase = 'end';
  logMsg(state, `${state.players[playerIdx].name} plays no card.`);
  return null;
}

export function forfeitGame(state: GameState, playerIdx: 0 | 1): string | null {
  if (state.winner !== null) return 'Game over';
  state.forfeitedIdx = playerIdx;
  state.winner = (1 - playerIdx) as 0 | 1;
  state.pigeonActive = false;
  logMsg(state, `${state.players[playerIdx].name} forfeits. ${state.players[1 - playerIdx].name} wins.`);
  return null;
}

export function pigeonStep(state: GameState): boolean {
  if (state.winner !== null || !state.pigeonActive) return false;
  const targetIdx = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
  const pool = ACTION_CARDS.filter((c) => c.id !== 'pigeon_delivery' && c.id !== 'claude_code');
  const pick = pool[Math.floor(Math.random() * pool.length)];
  logMsg(state, `Pigeon delivery: ${state.players[targetIdx].name} plays ${pick.name}.`);
  executeCardEffect(state, targetIdx, pick.id);
  return state.winner === null;
}

function projectLog(state: GameState, viewerIdx: 0 | 1): string[] {
  const viewerName = state.players[viewerIdx].name;
  return state.log.map((line) => {
    if (!line.startsWith('__SECRET__|')) return line;
    const parts = line.split('|');
    const ownerName = parts[1] ?? '';
    const ownerLine = parts.slice(2).join('|');
    if (ownerName === viewerName) return ownerLine;
    return `${ownerName} plays a hidden card.`;
  });
}

function projectHand(hand: string[]): string[] {
  return hand.map((c) => (ACTION_BY_ID[c] ? c : '__hidden__'));
}

export function viewFor(state: GameState, playerIdx: 0 | 1): PlayerView {
  const you = state.players[playerIdx];
  const opp = state.players[1 - playerIdx];
  const dnsVisible = you.protocolId === 'DNS';
  const visibleHand = dnsVisible ? projectHand(opp.hand) : null;
  return {
    you,
    opponent: {
      id: opp.id,
      name: opp.name,
      protocolId: opp.protocolId,
      hp: opp.hp,
      maxHp: opp.maxHp,
      atk: opp.atk,
      handCount: opp.hand.length,
      deckCount: opp.deck.length,
      discardCount: opp.discard.length,
      visibleHand,
    },
    yourIndex: playerIdx,
    turn: state.turn,
    phase: state.phase,
    activePlayerIdx: state.activePlayerIdx,
    log: projectLog(state, playerIdx),
    winner: state.winner,
    roomCode: state.roomCode,
    pigeonActive: state.pigeonActive,
    bytesAwarded: state.bytesAwarded,
  };
}

export function isSecretCard(id: string): boolean {
  return isSecret(id);
}

export type { GameState, Phase, PlayerView };
