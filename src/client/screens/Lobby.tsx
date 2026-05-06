interface Props {
  roomCode: string;
  players: { name: string; ready: boolean }[];
  playerIndex: 0 | 1 | null;
  savedDeckLabel: string;
  onReady: () => void;
  onMainMenu: () => void;
}

export default function Lobby({
  roomCode,
  players,
  playerIndex,
  savedDeckLabel,
  onReady,
  onMainMenu,
}: Props) {
  const you = playerIndex === null ? null : players[playerIndex];
  const isReady = you?.ready ?? false;
  const canReady = playerIndex !== null && !isReady;
  const slots = [players[0] ?? null, players[1] ?? null];

  return (
    <div className="screen lobby-screen">
      <header className="lobby-header">
        <button type="button" className="secondary-button" onClick={onMainMenu}>
          Main menu
        </button>
        <div>
          <span className="screen-kicker">Waiting for Battle</span>
          <h2>Room {roomCode}</h2>
        </div>
        <button type="button" className="primary-button" disabled={!canReady} onClick={onReady}>
          {isReady ? 'Ready' : 'Ready up'}
        </button>
      </header>

      <div className="lobby-layout">
        <section className="lobby-table">
          {slots.map((player, index) => {
            const isYou = playerIndex === index;
            return (
              <article
                key={index}
                className={`lobby-player-card ${player ? '' : 'empty'} ${
                  player?.ready ? 'ready' : ''
                } ${isYou ? 'you' : ''}`}
              >
                <span className="builder-card-kicker">Player {index + 1}</span>
                <strong className="lobby-player-name">
                  {player ? player.name : 'Waiting...'}
                </strong>
                <span className="lobby-player-status">
                  {player ? (player.ready ? 'Ready' : 'Choosing deck') : 'Open slot'}
                </span>
                {isYou && <span className="you-badge">You</span>}
              </article>
            );
          })}
        </section>

        <aside className="lobby-details menu-panel">
          <span className="screen-kicker">Loadout</span>
          <h2>{savedDeckLabel}</h2>
          <div className="deck-preview-cards" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="menu-note">
            {players.length < 2
              ? 'Waiting for an opponent to join.'
              : isReady
                ? 'Ready locked in.'
                : 'Ready up when your deck is set.'}
          </p>
        </aside>
      </div>
    </div>
  );
}
