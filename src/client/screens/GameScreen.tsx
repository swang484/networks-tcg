import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ACTION_BY_ID, PROTOCOL_BY_ID } from '../../shared/cards';
import type { PlayerView } from '../../shared/types';

interface Props {
  view: PlayerView;
  onPlayCard: (cardId: string) => void;
  onSkipPlay: () => void;
  onMainMenu: () => void;
  onForfeit: () => void;
}

type CombatTextKind = 'damage' | 'heal';
type CombatTextTarget = 'you' | 'opponent';

interface CombatTextEvent {
  id: number;
  target: CombatTextTarget;
  kind: CombatTextKind;
  text: string;
}

function hpPercent(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (hp / maxHp) * 100));
}

export default function GameScreen({ view, onPlayCard, onSkipPlay, onMainMenu, onForfeit }: Props) {
  const [combatTexts, setCombatTexts] = useState<CombatTextEvent[]>([]);
  const [flash, setFlash] = useState<Partial<Record<CombatTextTarget, CombatTextKind>>>({});
  const previousViewRef = useRef<PlayerView | null>(null);
  const combatTextIdRef = useRef(0);
  const yourTurn = view.activePlayerIdx === view.yourIndex;
  const youProto = PROTOCOL_BY_ID[view.you.protocolId];
  const oppProto = PROTOCOL_BY_ID[view.opponent.protocolId];
  const canPlayCards = yourTurn && view.phase === 'play' && view.winner === null;
  const canSkipPlay = canPlayCards && view.you.hand.length === 0;
  const opponentHandStyle = { '--card-count': view.opponent.handCount } as CSSProperties;
  const playerHandStyle = { '--card-count': view.you.hand.length } as CSSProperties;
  const latestLogIndex = view.log.slice(-18).length - 1;
  const tracePrefix = (entry: string) => {
    if (entry.includes('Game start') || entry.includes('wins')) return 'SYS';
    if (entry.includes(view.you.name)) return 'TX';
    if (entry.includes(view.opponent.name)) return 'RX';
    return 'SYS';
  };

  useEffect(() => {
    const previous = previousViewRef.current;
    previousViewRef.current = view;

    if (!previous) return;

    const changes: Array<{
      target: CombatTextTarget;
      previousHp: number;
      currentHp: number;
    }> = [
      { target: 'you', previousHp: previous.you.hp, currentHp: view.you.hp },
      {
        target: 'opponent',
        previousHp: previous.opponent.hp,
        currentHp: view.opponent.hp,
      },
    ];

    const newTexts: CombatTextEvent[] = [];
    const nextFlash: Partial<Record<CombatTextTarget, CombatTextKind>> = {};

    for (const change of changes) {
      const delta = change.currentHp - change.previousHp;
      if (delta === 0) continue;

      const kind: CombatTextKind = delta < 0 ? 'damage' : 'heal';
      newTexts.push({
        id: combatTextIdRef.current++,
        target: change.target,
        kind,
        text: delta < 0 ? `${delta}` : `+${delta}`,
      });
      nextFlash[change.target] = kind;
    }

    if (newTexts.length === 0) return;

    setCombatTexts((current) => [...current, ...newTexts]);
    setFlash((current) => ({ ...current, ...nextFlash }));

    window.setTimeout(() => {
      const ids = new Set(newTexts.map((event) => event.id));
      setCombatTexts((current) => current.filter((event) => !ids.has(event.id)));
    }, 900);

    window.setTimeout(() => {
      setFlash((current) => {
        const next = { ...current };
        for (const event of newTexts) {
          delete next[event.target];
        }
        return next;
      });
    }, 420);
  }, [view]);

  const renderCombatText = (target: CombatTextTarget) => (
    <div className="combat-text-layer" aria-hidden="true">
      {combatTexts
        .filter((event) => event.target === target)
        .map((event) => (
          <span key={event.id} className={`combat-text ${event.kind}`}>
            {event.text}
          </span>
        ))}
    </div>
  );

  return (
    <div className="screen game">
      <div className="battle-layout">
        <aside className="battle-side battle-decks">
          <h3>Decks</h3>
          <div className="deck-panel">
            <h4>{view.opponent.name}</h4>
            <p>Deck: {view.opponent.deckCount}</p>
            <p>Cards in hand: {view.opponent.handCount}</p>
            <p>Discard pile: {view.opponent.discardCount}</p>
          </div>
          <div className="deck-panel">
            <h4>{view.you.name}</h4>
            <p>Deck: {view.you.deck.length}</p>
            <p>Cards in hand: {view.you.hand.length}</p>
            <p>Discard pile: {view.you.discard.length}</p>
          </div>
        </aside>

        <main className="battle-arena">
          <div className="battle-status">
            <span>Turn {view.turn}</span>
            <span>SOCKET: {yourTurn ? 'local send window open' : 'waiting for remote packet'}</span>
          </div>

          <section className="arena-row opponent-zone">
            <div className="action-hand opponent-hand" style={opponentHandStyle}>
              {view.opponent.visibleHand
                ? view.opponent.visibleHand.map((cid, i) => {
                    const c = ACTION_BY_ID[cid];
                    return (
                      <div
                        key={`${cid}-${i}`}
                        className="action-card playable-card enemy-visible-card"
                        style={{
                          '--card-index': i,
                          '--card-z': i + 1,
                        } as CSSProperties}
                      >
                        <strong>{c?.name ?? cid}</strong>
                        <span>{c?.description ?? ''}</span>
                      </div>
                    );
                  })
                : Array.from({ length: view.opponent.handCount }).map((_, i) => (
                    <div
                      key={i}
                      className="action-card card-back"
                      style={{
                        '--card-index': i,
                        '--card-z': i + 1,
                      } as CSSProperties}
                    />
                  ))}
            </div>
            <div
              className={`protocol-card enemy-card ${flash.opponent ?? ''} ${
                !yourTurn && view.winner === null ? 'active' : ''
              } proto-${view.opponent.protocolId.toLowerCase()}`}
            >
              <span className="proto-aura" aria-hidden="true" />
              <span className="proto-ring" aria-hidden="true" />
              <span className="proto-corner tl" aria-hidden="true" />
              <span className="proto-corner tr" aria-hidden="true" />
              <span className="proto-corner bl" aria-hidden="true" />
              <span className="proto-corner br" aria-hidden="true" />
              {renderCombatText('opponent')}
              <span className="card-owner">{view.opponent.name}</span>
              <h2>{oppProto.name}</h2>
              <p className="hp-readout">HP {view.opponent.hp}/{view.opponent.maxHp}</p>
              <div className="hp-bar" aria-hidden="true">
                <div
                  className="hp-fill"
                  style={{ width: `${hpPercent(view.opponent.hp, view.opponent.maxHp)}%` }}
                />
              </div>
              <p className="atk-readout">ATK {view.opponent.atk}</p>
            </div>
          </section>

          <section className="arena-row player-zone">
            <div
              className={`protocol-card player-card ${flash.you ?? ''} ${
                yourTurn && view.winner === null ? 'active' : ''
              } proto-${view.you.protocolId.toLowerCase()}`}
            >
              <span className="proto-aura" aria-hidden="true" />
              <span className="proto-ring" aria-hidden="true" />
              <span className="proto-corner tl" aria-hidden="true" />
              <span className="proto-corner tr" aria-hidden="true" />
              <span className="proto-corner bl" aria-hidden="true" />
              <span className="proto-corner br" aria-hidden="true" />
              {renderCombatText('you')}
              <span className="card-owner">{view.you.name} — you</span>
              <h2>{youProto.name}</h2>
              <p className="hp-readout">HP {view.you.hp}/{view.you.maxHp}</p>
              <div className="hp-bar" aria-hidden="true">
                <div
                  className="hp-fill"
                  style={{ width: `${hpPercent(view.you.hp, view.you.maxHp)}%` }}
                />
              </div>
              <p className="atk-readout">ATK {view.you.atk}</p>
            </div>

            <div className="action-hand player-hand" style={playerHandStyle}>
              {view.you.hand.length === 0 && <p className="empty-hand">(empty)</p>}
              {view.you.hand.map((cid, i) => {
                const c = ACTION_BY_ID[cid];
                return (
                  <button
                    key={`${cid}-${i}`}
                    disabled={!canPlayCards}
                    onClick={() => onPlayCard(cid)}
                    className="action-card playable-card"
                    style={{
                      '--card-index': i,
                      '--card-z': i + 1,
                    } as CSSProperties}
                  >
                    <strong>{c?.name ?? cid}</strong>
                    <span>{c?.description ?? ''}</span>
                  </button>
                );
              })}
            </div>

            <div className="actions">
              {canSkipPlay && (
                <button onClick={onSkipPlay}>Skip play</button>
              )}
              {view.winner === null && (
                <button
                  className="forfeit-btn"
                  onClick={() => {
                    if (window.confirm('Forfeit the match? Opponent wins. You get 0 bytes.')) {
                      onForfeit();
                    }
                  }}
                >
                  Forfeit
                </button>
              )}
            </div>
          </section>
        </main>

        <aside className="battle-side battle-log">
          <h3>Packet Trace</h3>
          <ul>
            {view.log.slice(-18).map((l, i) => (
              <li key={`${i}-${l}`} className={i === latestLogIndex ? 'latest' : ''}>
                <span className="trace-prefix">{tracePrefix(l)}</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {view.winner !== null && (
        <div className="winner">
          <div className={`winner-card ${view.winner === view.yourIndex ? 'won' : 'lost'}`}>
            <span className="screen-kicker">
              {view.winner === view.yourIndex ? 'Connection Established' : 'Connection Reset'}
            </span>
            <h2>{view.winner === view.yourIndex ? 'You win!' : 'You lose.'}</h2>
            {view.bytesAwarded && (
              <p className="winner-bytes">
                +
                {view.winner === view.yourIndex
                  ? view.bytesAwarded.winner
                  : view.bytesAwarded.loser}
                {' '}bytes
              </p>
            )}
            <button className="primary-button" onClick={onMainMenu}>
              Main menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}