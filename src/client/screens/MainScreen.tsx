interface Props {
  username: string | null;
  bytes: string;
  roomCode: string;
  savedDeckLabel: string;
  onRoomCodeChange: (roomCode: string) => void;
  onAuth: () => void;
  onInventory: () => void;
  onGacha: () => void;
  onByteShop: () => void;
  onLogout: () => void;
  onBuildDeck: () => void;
  onBattle: () => void;
  error: string | null;
}
export default function MainScreen({
  username,
  bytes,
  roomCode,
  savedDeckLabel,
  onRoomCodeChange,
  onAuth,
  onInventory,
  onGacha,
  onByteShop,
  onLogout,
  onBuildDeck,
  onBattle,
  error,
}: Props) {
  const canBattle = username !== null && roomCode.trim().length > 0;
  return (
    <div className="screen main-menu-screen">
      <header className="main-menu-header">
        <div>
          <span className="screen-kicker">Computer Networks</span>
          <h1>Networks Card Game</h1>
        </div>
        {username ? (
          <div className="main-account-pill">
            <span>
              Logged in as <strong>{username}</strong> ({bytes})
            </span>
            <button type="button" className="secondary-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <button type="button" className="primary-button" onClick={onAuth}>
            Login / Create account
          </button>
        )}
      </header>
      <div className="main-menu-layout">
        <section className="menu-panel battle-entry-panel">
          <div className="panel-heading">
            <span className="screen-kicker">Live Battle</span>
            <h2>Enter Room Code</h2>
          </div>
          <label className="room-code-field">
            <span>Game code</span>
            <input
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value)}
              placeholder="e.g. TCP123"
            />
          </label>
          <button
            type="button"
            className="battle-button"
            disabled={!canBattle}
            onClick={onBattle}
          >
            Battle
          </button>
          {!username && <p className="menu-note">Login required for battle.</p>}
          {error && <p className="error">{error}</p>}
        </section>
        <aside className="main-menu-stack">
          <section className="menu-panel deck-loadout-panel">
            <span className="screen-kicker">Default Deck</span>
            <h2>{savedDeckLabel}</h2>
            <div className="deck-preview-cards" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <button type="button" onClick={onBuildDeck}>
              Build deck
            </button>
          </section>
          <section className="menu-panel account-panel">
            <span className="screen-kicker">Collection</span>
            <h2>{username ? 'Inventory' : 'Account'}</h2>
            {username ? (
              <>
                <button type="button" onClick={onInventory}>
                  Inventory
                </button>
                <button type="button" onClick={onGacha}>
                  Open payload
                </button>
              </>
            ) : (
              <button type="button" onClick={onAuth}>
                Login / Create account
              </button>
            )}
            <button type="button" className="byte-shop-button" onClick={onByteShop}>
              Byte shop
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
