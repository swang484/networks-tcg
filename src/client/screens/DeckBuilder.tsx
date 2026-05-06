import {
  ACTION_BY_ID,
  ACTION_CARDS,
  ACTION_CARD_LIMIT,
  PROTOCOLS,
  validateDeck,
} from '../../shared/cards';
import type { DeckSubmission, InventoryView } from '../../shared/types';
import { type KeyboardEvent, useMemo, useState } from 'react';

const MAX_COPIES_PER_ACTION = 3;

interface Props {
  initialDeck: DeckSubmission;
  inventory: InventoryView | null;
  onSave: (protocolId: string, actionCardIds: string[]) => void;
  onCancel: () => void;
  error: string | null;
}

function countsFromDeck(deck: DeckSubmission): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of deck.actionCardIds) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export default function DeckBuilder({
  initialDeck,
  inventory,
  onSave,
  onCancel,
  error,
}: Props) {
  const ownedProtocols = useMemo(() => {
    const m = new Map<string, number>();
    inventory?.protocols.forEach((p) => m.set(p.id, p.count));
    return m;
  }, [inventory]);

  const ownedActions = useMemo(() => {
    const m = new Map<string, number>();
    inventory?.actionCards.forEach((c) => m.set(c.id, c.count));
    return m;
  }, [inventory]);

  const [protocolId, setProtocolId] = useState<string>(initialDeck.protocolId);
  const [counts, setCounts] = useState<Record<string, number>>(() => countsFromDeck(initialDeck));

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );

  const validationErr = useMemo(() => {
    const ids: string[] = [];
    for (const [id, n] of Object.entries(counts)) {
      for (let i = 0; i < n; i++) ids.push(id);
    }
    const general = validateDeck(ids);
    if (general) return general;
    if (!ownedProtocols.has(protocolId)) return `You don't own ${protocolId}`;
    for (const [id, n] of Object.entries(counts)) {
      const owned = ownedActions.get(id) ?? 0;
      if (n > owned) return `${ACTION_BY_ID[id]?.name ?? id}: have ${owned}, want ${n}`;
    }
    return null;
  }, [counts, protocolId, ownedProtocols, ownedActions]);

  const setCount = (id: string, delta: number) => {
    setCounts((c) => {
      const cap = Math.min(ACTION_CARD_LIMIT, ownedActions.get(id) ?? 0);
      const next = Math.max(0, (c[id] ?? 0) + delta);
      const others = Object.entries(c)
        .filter(([k]) => k !== id)
        .reduce((a, b) => a + b[1], 0);

      if (delta > 0 && next > cap) return c;
      if (others + next > 20) return c;

      return { ...c, [id]: next };
    });
  };

  const handleActionKey = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setCount(id, +1);
  };

  const clearAll = () => {
    setCounts({});
  };

  const save = () => {
    const ids: string[] = [];
    for (const [id, n] of Object.entries(counts)) {
      for (let i = 0; i < n; i++) ids.push(id);
    }
    onSave(protocolId, ids);
  };

  return (
    <div className="screen deck-builder">
      <header className="deck-builder-header">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Back to main menu
        </button>
        <h2>Deck Builder</h2>
        <button type="button" disabled={validationErr !== null} onClick={save}>
          Save
        </button>
      </header>

      {!inventory && <p>Loading inventory...</p>}

      <div className="deck-builder-status">
        <span>Action cards: {total}/20</span>
        <span>10 Packet cards will be added automatically.</span>
        <button
          type="button"
          className="clear-deck-button"
          disabled={total === 0}
          onClick={clearAll}
        >
          Clear all
        </button>
        {validationErr && <p className="error">{validationErr}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <section className="deck-builder-section">
        <h3>Protocols</h3>
        <div className="builder-card-grid protocol-builder-grid">
          {PROTOCOLS.map((p) => {
            const owned = ownedProtocols.has(p.id);
            const selected = protocolId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`builder-card protocol-builder-card ${selected ? 'selected' : ''}`}
                style={{ opacity: owned ? 1 : 0.4 }}
                aria-pressed={selected}
                disabled={!owned}
                onClick={() => setProtocolId(p.id)}
              >
                {owned && (
                  <>
                    <span className="proto-aura" aria-hidden="true" />
                    <span className="proto-ring" aria-hidden="true" />
                  </>
                )}
                <span className="proto-badge">PROTOCOL</span>
                <span className={`rarity-pill rarity-${p.rarity}`}>{p.rarity}</span>
                <span className="builder-card-kicker">Protocol</span>
                <strong className="builder-card-title">{p.name}</strong>
                <span className="builder-card-stat">HP {p.hp}</span>
                <span className="builder-card-stat">ATK {p.atk}</span>
                <span className="builder-card-text scrollable-card-text">{p.ability}</span>
                {!owned && <span className="builder-card-foot">Locked</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="deck-builder-section">
        <div className="deck-section-title">
          <h3>Actions</h3>
          <span>Click a card to add it. Use - to remove copies.</span>
        </div>
        <div className="builder-card-grid action-builder-grid">
          {ACTION_CARDS.map((c) => {
            const owned = ownedActions.get(c.id) ?? 0;
            const count = counts[c.id] ?? 0;
            const atCopyLimit = count >= Math.min(MAX_COPIES_PER_ACTION, owned);
            const atDeckLimit = total >= 20;
            const canAdd = owned > 0 && !atCopyLimit && !atDeckLimit;
            return (
              <div
                key={c.id}
                className={`builder-card action-builder-card ${count > 0 ? 'in-deck' : ''} ${
                  canAdd ? '' : 'add-disabled'
                }`}
                style={{ opacity: owned > 0 ? 1 : 0.4 }}
                role="button"
                tabIndex={owned > 0 ? 0 : -1}
                aria-label={`Add ${c.name} to deck`}
                onClick={() => setCount(c.id, +1)}
                onKeyDown={(event) => handleActionKey(event, c.id)}
              >
                <div className="action-card-toolbar">
                  <span className="copy-badge">x{count}</span>
                  <button
                    type="button"
                    className="remove-copy-button"
                    disabled={count === 0}
                    aria-label={`Remove ${c.name} from deck`}
                    onKeyDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCount(c.id, -1);
                    }}
                  >
                    -
                  </button>
                </div>
                <span className={`rarity-pill rarity-${c.rarity}`}>{c.rarity}</span>
                <span className="builder-card-kicker">Action</span>
                <strong className="builder-card-title">{c.name}</strong>
                <span className="builder-card-text scrollable-card-text">{c.description}</span>
                <span className="builder-card-foot">
                  {owned === 0
                    ? 'Not owned'
                    : atCopyLimit
                    ? 'Max copies'
                    : atDeckLimit
                    ? 'Deck full'
                    : `Add copy (${owned - count} left)`}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
