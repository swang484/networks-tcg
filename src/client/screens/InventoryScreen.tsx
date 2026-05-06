import { useMemo } from 'react';
import { ACTION_BY_ID, PROTOCOLS } from '../../shared/cards';
import type { InventoryView, Rarity } from '../../shared/types';

interface Props {
  inventory: InventoryView | null;
  error: string | null;
  onBack: () => void;
}

const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common', 'base'];

function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

export default function InventoryScreen({
  inventory,
  error,
  onBack,
}: Props) {
  const protocolMap = useMemo(() => {
    const m = new Map<string, number>();
    inventory?.protocols.forEach((p) => m.set(p.id, p.count));
    return m;
  }, [inventory]);

  const actionMap = useMemo(() => {
    const m = new Map<string, number>();
    inventory?.actionCards.forEach((c) => m.set(c.id, c.count));
    return m;
  }, [inventory]);

  const sortedActions = useMemo(() => {
    return Object.values(ACTION_BY_ID)
      .filter((c) => c.id !== 'packet')
      .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name));
  }, []);

  const totals = useMemo(() => {
    if (!inventory) return null;
    const protoOwned = inventory.protocols.filter((p) => p.count > 0).length;
    const actionOwned = inventory.actionCards.filter((c) => c.id !== 'packet' && c.count > 0).length;
    return { protoOwned, actionOwned };
  }, [inventory]);

  return (
    <div className="screen inventory-screen">
      <header className="inventory-header">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back
        </button>
        <div className="inventory-title">
          <span className="screen-kicker">Collection</span>
          <h2>Inventory</h2>
        </div>
        <div className="inventory-bytes-pill">
          <span className="screen-kicker">Bytes</span>
          <strong>{inventory ? inventory.bytes : '—'}</strong>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {!inventory && !error && <p>Loading inventory...</p>}

      {inventory && totals && (
        <div className="inventory-stats">
          <div className="stat-card">
            <span className="screen-kicker">Protocols owned</span>
            <strong>{totals.protoOwned} / {PROTOCOLS.length}</strong>
          </div>
          <div className="stat-card">
            <span className="screen-kicker">Action cards owned</span>
            <strong>{totals.actionOwned} / {sortedActions.length}</strong>
          </div>
          <div className="stat-card">
            <span className="screen-kicker">Bytes</span>
            <strong>{inventory.bytes}</strong>
          </div>
        </div>
      )}

      {inventory && (
        <>
          <section className="inventory-section">
            <div className="deck-section-title">
              <h3>Protocols</h3>
              <span>HP / ATK / passive ability</span>
            </div>
            <div className="builder-card-grid protocol-builder-grid">
              {PROTOCOLS.map((p) => {
                const owned = (protocolMap.get(p.id) ?? 0) > 0;
                return (
                  <div
                    key={p.id}
                    className={`builder-card protocol-builder-card inventory-card ${
                      owned ? '' : 'locked'
                    }`}
                    style={{ opacity: owned ? 1 : 0.4 }}
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
                    {p.title && <span className="builder-card-text">{p.title}</span>}
                    <span className="builder-card-stat">HP {p.hp}</span>
                    <span className="builder-card-stat">ATK {p.atk}</span>
                    <span className="builder-card-text scrollable-card-text">{p.ability}</span>
                    <span className="builder-card-foot">
                      {owned ? 'Owned' : 'Locked'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="inventory-section">
            <div className="deck-section-title">
              <h3>Action cards</h3>
              <span>Each card capped at 3 copies per deck.</span>
            </div>
            <div className="builder-card-grid action-builder-grid">
              {sortedActions.map((c) => {
                const owned = actionMap.get(c.id) ?? 0;
                return (
                  <div
                    key={c.id}
                    className={`builder-card action-builder-card inventory-card ${
                      owned > 0 ? '' : 'locked'
                    }`}
                    style={{ opacity: owned > 0 ? 1 : 0.4 }}
                  >
                    <div className="action-card-toolbar">
                      <span className="copy-badge">{owned} / 3</span>
                    </div>
                    <span className={`rarity-pill rarity-${c.rarity}`}>{c.rarity}</span>
                    <span className="builder-card-kicker">Action</span>
                    <strong className="builder-card-title">{c.name}</strong>
                    <span className="builder-card-text scrollable-card-text">{c.description}</span>
                    <span className="builder-card-foot">
                      {owned > 0 ? `${owned} owned` : 'Not owned'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
