import { useEffect, useRef, useState } from 'react';
import { ACTION_BY_ID, PACK_COST, PROTOCOL_BY_ID } from '../../shared/cards';
import type { PackResult } from '../../shared/types';

interface Props {
  bytes: number | null;
  packBusy: boolean;
  packResult: PackResult | null;
  error: string | null;
  onOpenPack: () => void;
  onBack: () => void;
  onClearResult: () => void;
}

const HOPS = ['CLIENT', 'ROUTER', 'GATEWAY', 'DNS', 'SERVER'];
const TRANSMIT_DURATION_MS = 3000;

export default function GachaScreen({
  bytes,
  packBusy,
  packResult,
  error,
  onOpenPack,
  onBack,
  onClearResult,
}: Props) {
  // 'idle': awaiting click. 'animating': showing hop animation, may or may not have result yet. 'revealing': cards are flippable.
  const [stage, setStage] = useState<'idle' | 'animating' | 'revealing'>('idle');
  const [animationStartedAt, setAnimationStartedAt] = useState<number | null>(null);
  const [animationElapsedMs, setAnimationElapsedMs] = useState(0);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const rafRef = useRef<number | null>(null);
  const packResultRef = useRef(packResult);
  packResultRef.current = packResult;

  // drive the animation via rAF — keeps state changes minimal but visible
  useEffect(() => {
    if (stage !== 'animating' || animationStartedAt === null) {
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - animationStartedAt;
      setAnimationElapsedMs(elapsed);
      if (elapsed >= TRANSMIT_DURATION_MS && packResultRef.current) {
        // animation finished AND we have the result → reveal
        const result = packResultRef.current;
        setStage('revealing');
        setFlipped(new Array(result.cards.length).fill(false));
        return;
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [stage, animationStartedAt]);

  // when packResult arrives, if animation finished already, reveal now
  useEffect(() => {
    if (
      stage === 'animating' &&
      packResult &&
      animationStartedAt !== null &&
      Date.now() - animationStartedAt >= TRANSMIT_DURATION_MS
    ) {
      setStage('revealing');
      setFlipped(new Array(packResult.cards.length).fill(false));
    }
  }, [packResult, stage, animationStartedAt]);

  // reset only when packResult transitions from non-null → null (e.g. "Open another")
  const prevPackResultRef = useRef(packResult);
  useEffect(() => {
    const prev = prevPackResultRef.current;
    prevPackResultRef.current = packResult;
    if (prev && !packResult) {
      setStage('idle');
      setAnimationStartedAt(null);
      setAnimationElapsedMs(0);
      setFlipped([]);
    }
  }, [packResult]);

  const startOpen = () => {
    if (!bytes || bytes < PACK_COST || packBusy) return;
    setAnimationStartedAt(Date.now());
    setAnimationElapsedMs(0);
    setStage('animating');
    onOpenPack();
  };

  const flip = (i: number) => {
    setFlipped((f) => {
      if (f[i]) return f;
      const next = [...f];
      next[i] = true;
      return next;
    });
  };

  const flipAll = () => {
    if (!packResult) return;
    setFlipped(new Array(packResult.cards.length).fill(true));
  };

  const allFlipped =
    packResult !== null &&
    flipped.length === packResult.cards.length &&
    flipped.every((v) => v);
  const canOpen = bytes !== null && bytes >= PACK_COST && !packBusy && stage === 'idle';

  // Compute which hop is currently active based on elapsed time
  const hopProgress = Math.min(1, animationElapsedMs / TRANSMIT_DURATION_MS);
  const activeHop = Math.min(HOPS.length - 1, Math.floor(hopProgress * HOPS.length));
  const packetX = hopProgress * 100;

  return (
    <div className="screen gacha-screen">
      <div className="gacha-header">
        <span className="screen-kicker">Network Payload</span>
        <h2>Open a payload</h2>
        <p>
          Bytes: <strong>{bytes ?? '—'}</strong> · Cost: {PACK_COST}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {stage === 'idle' && (
        <div className="gacha-prompt menu-panel">
          <p>A 5-card payload is queued for transmission. Click each card to reveal.</p>
          <div className="actions">
            <button onClick={onBack} disabled={packBusy} className="secondary-button">
              Back
            </button>
            <button
              disabled={!canOpen}
              onClick={startOpen}
              className="primary-button"
            >
              {packBusy ? 'Opening...' : `Open payload (${PACK_COST} bytes)`}
            </button>
          </div>
        </div>
      )}

      {stage === 'animating' && (
        <div className="transmit-stage" aria-label="Transmitting payload">
          <div className="transmit-track">
            <div className="transmit-line">
              <div
                className="transmit-line-fill"
                style={{ width: `${packetX}%` }}
              />
              <div
                className="packet-traveller"
                style={{ left: `${packetX}%` }}
                aria-hidden="true"
              >
                <span className="packet-glyph">📦</span>
              </div>
            </div>
            {HOPS.map((label, i) => (
              <div
                key={label}
                className={`hop-node ${i <= activeHop ? 'reached' : ''} ${
                  i === activeHop ? 'current' : ''
                }`}
              >
                <span className="hop-dot" />
                <span className="hop-label">{label}</span>
              </div>
            ))}
          </div>
          <p className="transmit-status">
            {hopProgress < 0.05
              ? 'Establishing route...'
              : hopProgress < 0.95
                ? `Hop ${activeHop + 1} / ${HOPS.length} — ${HOPS[activeHop]}`
                : packResult
                  ? 'ACK received. Decoding payload...'
                  : 'Awaiting server ACK...'}
          </p>
          <div className="binary-rain" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} style={{ '--i': i } as React.CSSProperties}>
                {Math.random() < 0.5 ? '0' : '1'}
              </span>
            ))}
          </div>
        </div>
      )}

      {stage === 'revealing' && packResult && (
        <>
          <div className="gacha-cards">
            {packResult.cards.map((entry, i) => {
              const def =
                entry.cardKind === 'protocol'
                  ? PROTOCOL_BY_ID[entry.cardId]
                  : ACTION_BY_ID[entry.cardId];
              const name = def?.name ?? entry.cardId;
              const rarity = def?.rarity ?? 'common';
              const isFlipped = flipped[i];
              const isProtocol = entry.cardKind === 'protocol';
              const proto = isProtocol ? PROTOCOL_BY_ID[entry.cardId] : null;
              const action = !isProtocol ? ACTION_BY_ID[entry.cardId] : null;
              const description = isProtocol
                ? proto?.ability ?? ''
                : action?.description ?? '';
              const subtitle = isProtocol && proto?.title ? proto.title : null;
              return (
                <button
                  key={i}
                  className={`gacha-card ${isFlipped ? 'flipped' : ''} rarity-${rarity} ${
                    isProtocol ? 'is-protocol' : 'is-action'
                  }`}
                  style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}
                  onClick={() => flip(i)}
                  type="button"
                  aria-label={isFlipped ? `${name} (${rarity})` : 'Hidden card — click to reveal'}
                >
                  <span className="gacha-card-inner">
                    <span className="gacha-card-back">
                      <span className="back-grid" />
                      <span className="back-label">PKT</span>
                    </span>
                    <span className="gacha-card-front">
                      {isProtocol && (
                        <>
                          <span className="proto-aura" aria-hidden="true" />
                          <span className="proto-ring" aria-hidden="true" />
                          <span className="proto-badge">PROTOCOL</span>
                        </>
                      )}
                      <strong className="card-name">{name}</strong>
                      {subtitle && <em className="card-subtitle">{subtitle}</em>}
                      <small className="card-meta">
                        {entry.cardKind} · {rarity}
                      </small>
                      {isProtocol && proto && (
                        <div className="proto-stats">
                          <span className="stat-pill hp">HP {proto.hp}</span>
                          <span className="stat-pill atk">ATK {proto.atk}</span>
                        </div>
                      )}
                      <span className="card-desc">{description}</span>
                      {entry.duplicate && (
                        <em className="dup">duplicate +{entry.bytesRefunded} byte</em>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="gacha-bytes">Bytes after: {packResult.bytes}</p>
          <div className="actions">
            {!allFlipped && (
              <button onClick={flipAll} className="secondary-button">
                Reveal all
              </button>
            )}
            {allFlipped && (
              <>
                <button
                  className="primary-button"
                  onClick={() => {
                    onClearResult();
                  }}
                  disabled={bytes === null || bytes < PACK_COST || packBusy}
                >
                  Open another
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    onClearResult();
                    onBack();
                  }}
                >
                  Back
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
