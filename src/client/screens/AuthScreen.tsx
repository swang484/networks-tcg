import { useEffect, useState } from 'react';

interface Props {
  error: string | null;
  onSubmit: (mode: 'login' | 'register', username: string, password: string) => void;
  onCancel: () => void;
}

const TERMINAL_LINES = [
  '> establishing tcp handshake...',
  '> SYN sent → SYN-ACK received → ACK',
  '> tls 1.3 negotiated',
  '> awaiting credentials',
];

export default function AuthScreen({ error, onSubmit, onCancel }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    if (visibleLines >= TERMINAL_LINES.length) return;
    const id = window.setTimeout(() => setVisibleLines((n) => n + 1), 350);
    return () => window.clearTimeout(id);
  }, [visibleLines]);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  return (
    <div className="screen auth-screen networks-theme">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-bg-grid" />
        <div className="auth-bg-aura" />
        <div className="auth-bg-rain">
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} style={{ '--i': i } as React.CSSProperties}>
              {Math.random() < 0.5 ? '0' : '1'}
            </span>
          ))}
        </div>
      </div>

      <header className="auth-header">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Back
        </button>
        <div className="auth-title">
          <span className="screen-kicker">Connection Required</span>
          <h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
        </div>
        <span className="auth-spacer" aria-hidden="true" />
      </header>

      <section className="auth-panel auth-terminal">
        <div className="auth-terminal-bar">
          <span className="terminal-dot red" />
          <span className="terminal-dot yellow" />
          <span className="terminal-dot green" />
          <span className="terminal-host">root@networks ~ {mode === 'login' ? 'login.sh' : 'register.sh'}</span>
        </div>

        <div className="auth-terminal-body">
          <div className="auth-terminal-trace">
            {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
              <p
                key={i}
                className={`trace-line ${i === visibleLines - 1 ? 'cursor' : ''}`}
              >
                {line}
              </p>
            ))}
          </div>

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) onSubmit(mode, username, password);
            }}
          >
            <label className="auth-field">
              <span>username:</span>
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="enter handle"
              />
            </label>
            <label className="auth-field">
              <span>password:</span>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            <button type="submit" className="primary-button auth-submit" disabled={!canSubmit}>
              {mode === 'login' ? '> authenticate' : '> register'}
            </button>

            <button
              type="button"
              className="link-button auth-toggle"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login'
                ? "// no account yet? register here"
                : '// already registered? login here'}
            </button>

            {error && (
              <p className="error auth-error">
                <span aria-hidden="true">! </span>
                {error}
              </p>
            )}
          </form>
        </div>
      </section>

      <aside className="auth-footnote">
        <span className="screen-kicker">Welcome to the network</span>
        <p>
          Your account stores your card collection, bytes, and deck loadout. Battle other
          players to earn bytes; spend them on payloads to expand your inventory.
        </p>
      </aside>
    </div>
  );
}
