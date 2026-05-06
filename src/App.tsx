import { useEffect, useState } from 'react';
import { socket } from './client/socket';
import MainScreen from './client/screens/MainScreen';
import DeckBuilder from './client/screens/DeckBuilder';
import Lobby from './client/screens/Lobby';
import GameScreen from './client/screens/GameScreen';
import AuthScreen from './client/screens/AuthScreen';
import InventoryScreen from './client/screens/InventoryScreen';
import GachaScreen from './client/screens/GachaScreen';
import ByteShopScreen from './client/screens/ByteShopScreen';
import {
  checkoutByteBundle,
  claimDailyBytes,
  clearStoredToken,
  getInventory,
  getMe,
  getStoredToken,
  login,
  logout,
  openPack,
  register,
  setStoredToken,
} from './client/api';
import { ACTION_CARD_LIMIT, PROTOCOL_BY_ID, PROTOCOLS, validateDeckAgainstInventory } from './shared/cards';
import type {
  AuthUser,
  DeckSubmission,
  InventoryView,
  PackResult,
  PlayerView,
} from './shared/types';
import './App.css';

type Screen =
  | 'main'
  | 'auth'
  | 'inventory'
  | 'gacha'
  | 'byteShop'
  | 'deckbuilder'
  | 'lobby'
  | 'game';

function makeDefaultDeck(inventory: InventoryView | null): DeckSubmission {
  const ownedProtocol = inventory?.protocols.find((p) => p.count > 0)?.id ?? PROTOCOLS[0].id;
  const ownedActions = inventory?.actionCards ?? [];
  const ids: string[] = [];
  for (const entry of ownedActions) {
    const usable = Math.min(entry.count, ACTION_CARD_LIMIT);
    for (let i = 0; i < usable && ids.length < 20; i++) ids.push(entry.id);
    if (ids.length >= 20) break;
  }
  return { protocolId: ownedProtocol, actionCardIds: ids.slice(0, 20) };
}

function App() {
  const [screen, setScreen] = useState<Screen>('main');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [playerIndex, setPlayerIndex] = useState<0 | 1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<{ name: string; ready: boolean }[]>([]);
  const [view, setView] = useState<PlayerView | null>(null);
  const [savedDeck, setSavedDeck] = useState<DeckSubmission>(() => makeDefaultDeck(null));
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [inventory, setInventory] = useState<InventoryView | null>(null);
  const [packResult, setPackResult] = useState<PackResult | null>(null);
  const [packBusy, setPackBusy] = useState(false);

  useEffect(() => {
    socket.on('joined', ({ roomCode, playerIndex }) => {
      setRoomCode(roomCode);
      setPlayerIndex(playerIndex);
      setError(null);
      setScreen('lobby');
    });
    socket.on('lobby_update', ({ players }) => {
      setLobbyPlayers(players);
    });
    socket.on('state_update', (v) => {
      setView(v);
      setScreen('game');
    });
    socket.on('error_msg', (msg) => {
      setError(msg);
    });
    return () => {
      socket.off('joined');
      socket.off('lobby_update');
      socket.off('state_update');
      socket.off('error_msg');
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      setUser(null);
      setInventory(null);
      return;
    }
    getMe(authToken)
      .then(({ user }) => {
        setUser(user);
        setError(null);
      })
      .catch((err) => {
        clearStoredToken();
        setAuthToken(null);
        setUser(null);
        setError(err instanceof Error ? err.message : 'Session expired');
      });
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !user) return;
    getInventory(authToken)
      .then((inv) => {
        setInventory(inv);
        setSavedDeck((prev) => {
          if (prev.actionCardIds.length === 20) return prev;
          return makeDefaultDeck(inv);
        });
      })
      .catch(() => undefined);
  }, [authToken, user]);

  const refreshInventory = () => {
    if (!authToken) return Promise.resolve();
    return getInventory(authToken)
      .then((inv) => {
        setInventory(inv);
        return inv;
      })
      .catch(() => undefined);
  };

  const handleAuth = (mode: 'login' | 'register', username: string, password: string) => {
    setError(null);
    const authRequest = mode === 'login' ? login : register;
    authRequest(username.trim(), password)
      .then(({ token, user }) => {
        setStoredToken(token);
        setAuthToken(token);
        setUser(user);
        setScreen('main');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Auth failed'));
  };

  const handleLogout = () => {
    const token = authToken;
    clearStoredToken();
    setAuthToken(null);
    setUser(null);
    setInventory(null);
    setError(null);
    if (token) {
      logout(token).catch(() => undefined);
    }
  };

  const handleInventory = () => {
    if (!authToken) {
      setError('Login required');
      return;
    }
    setError(null);
    setPackResult(null);
    setScreen('inventory');
    void refreshInventory();
  };

  const handleOpenPack = () => {
    if (!authToken || packBusy) return;
    setPackBusy(true);
    setError(null);
    openPack(authToken)
      .then(async (result) => {
        setPackResult(result);
        await refreshInventory();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Pack failed'))
      .finally(() => setPackBusy(false));
  };

  const handleDailyClaim = async () => {
    if (!authToken) throw new Error('Login required');
    const result = await claimDailyBytes(authToken);
    await refreshInventory();
    return result;
  };

  const handleByteCheckout = async (bundleId: string, discountCode: string) => {
    if (!authToken) throw new Error('Login required');
    const result = await checkoutByteBundle(authToken, bundleId, discountCode);
    await refreshInventory();
    return result;
  };

  const handleBattle = () => {
    setError(null);
    if (!authToken || !user) {
      setError('Login required');
      return;
    }
    if (!inventory) {
      setError('Inventory still loading');
      return;
    }
    const ownedProtos = new Map(inventory.protocols.map((p) => [p.id, p.count]));
    const ownedActions = new Map(inventory.actionCards.map((c) => [c.id, c.count]));
    const deckErr = validateDeckAgainstInventory(
      savedDeck.protocolId,
      savedDeck.actionCardIds,
      ownedProtos,
      ownedActions,
    );
    if (deckErr) {
      setError(deckErr);
      return;
    }
    setLobbyPlayers([]);
    setView(null);
    setPlayerIndex(null);
    socket.emit('create_or_join', { roomCode: joinCode.trim(), authToken });
  };

  const handleSaveDeck = (protocolId: string, actionCardIds: string[]) => {
    setSavedDeck({ protocolId, actionCardIds });
    setError(null);
    setScreen('main');
  };

  const handleReady = () => {
    setError(null);
    socket.emit('submit_deck', savedDeck);
  };

  const handleMainMenu = () => {
    socket.emit('leave_room');
    setScreen('main');
    setRoomCode('');
    setPlayerIndex(null);
    setError(null);
    setLobbyPlayers([]);
    setView(null);
    void refreshInventory();
  };

  const savedDeckLabel = `${PROTOCOL_BY_ID[savedDeck.protocolId]?.name ?? savedDeck.protocolId}, ${savedDeck.actionCardIds.length} actions`;
  const bytesLabel = inventory ? `${inventory.bytes} bytes` : '—';

  if (screen === 'main') {
    return (
      <MainScreen
        username={user?.username ?? null}
        bytes={bytesLabel}
        roomCode={joinCode}
        savedDeckLabel={savedDeckLabel}
        onRoomCodeChange={setJoinCode}
        onAuth={() => {
          setError(null);
          setScreen('auth');
        }}
        onInventory={handleInventory}
        onGacha={() => {
          if (!authToken) {
            setError('Login required');
            return;
          }
          setError(null);
          setPackResult(null);
          setScreen('gacha');
          void refreshInventory();
        }}
        onByteShop={() => {
          setError(null);
          setScreen('byteShop');
        }}
        onLogout={handleLogout}
        onBuildDeck={() => {
          setError(null);
          setScreen('deckbuilder');
        }}
        onBattle={handleBattle}
        error={error}
      />
    );
  }
  if (screen === 'auth') {
    return (
      <AuthScreen
        error={error}
        onSubmit={handleAuth}
        onCancel={() => {
          setError(null);
          setScreen('main');
        }}
      />
    );
  }
  if (screen === 'inventory') {
    return (
      <InventoryScreen
        inventory={inventory}
        error={error}
        onBack={() => {
          setError(null);
          setScreen('main');
        }}
      />
    );
  }
  if (screen === 'gacha') {
    return (
      <GachaScreen
        bytes={inventory?.bytes ?? null}
        packBusy={packBusy}
        packResult={packResult}
        error={error}
        onOpenPack={handleOpenPack}
        onBack={() => {
          setError(null);
          setPackResult(null);
          setScreen('main');
        }}
        onClearResult={() => setPackResult(null)}
      />
    );
  }
  if (screen === 'byteShop') {
    return (
      <ByteShopScreen
        realBytes={inventory?.bytes ?? null}
        onDailyClaim={handleDailyClaim}
        onCheckout={handleByteCheckout}
        onBack={() => {
          setError(null);
          setScreen('main');
        }}
      />
    );
  }
  if (screen === 'deckbuilder') {
    return (
      <DeckBuilder
        initialDeck={savedDeck}
        inventory={inventory}
        onSave={handleSaveDeck}
        onCancel={() => setScreen('main')}
        error={error}
      />
    );
  }
  if (screen === 'lobby') {
    return (
      <Lobby
        roomCode={roomCode}
        players={lobbyPlayers}
        playerIndex={playerIndex}
        savedDeckLabel={savedDeckLabel}
        onReady={handleReady}
        onMainMenu={handleMainMenu}
      />
    );
  }
  if (screen === 'game' && view) {
    return (
      <GameScreen
        view={view}
        onPlayCard={(cardId) => socket.emit('play_card', { cardId })}
        onSkipPlay={() => socket.emit('skip_play')}
        onMainMenu={handleMainMenu}
        onForfeit={() => socket.emit('forfeit')}
      />
    );
  }
  return <div>Loading...</div>;
}

export default App;
