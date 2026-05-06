import { useMemo, useState } from 'react';

type BundleTier = 'base' | 'common' | 'rare' | 'epic' | 'legendary';

interface ByteBundle {
  id: string;
  name: string;
  bytes: number;
  price: string;
  amountLabel: string;
  tier: BundleTier;
  badge?: string;
}

const BYTE_BUNDLES: ByteBundle[] = [
  {
    id: 'daily',
    name: 'Free Daily Claim',
    bytes: 8,
    price: 'Free',
    amountLabel: '8 bytes/day',
    tier: 'base',
  },
  {
    id: 'byte',
    name: 'Byte Bundle',
    bytes: 10,
    price: '$0.99',
    amountLabel: '10 bytes',
    tier: 'common',
  },
  {
    id: 'kilobyte',
    name: 'Kilobyte Bundle',
    bytes: 60,
    price: '$4.99',
    amountLabel: '60 bytes',
    tier: 'rare',
    badge: 'Popular',
  },
  {
    id: 'megabyte',
    name: 'Megabyte Bundle',
    bytes: 200,
    price: '$14.99',
    amountLabel: '200 bytes',
    tier: 'epic',
  },
  {
    id: 'gigabyte',
    name: 'Gigabyte Bundle',
    bytes: 500,
    price: '$29.99',
    amountLabel: '500 bytes',
    tier: 'epic',
  },
  {
    id: 'terabyte',
    name: 'Terabyte Bundle',
    bytes: 1200,
    price: '$59.99',
    amountLabel: '1,200 bytes',
    tier: 'legendary',
    badge: 'Best value',
  },
];

interface Props {
  realBytes: number | null;
  onDailyClaim: () => Promise<{ bytes: number; granted: number }>;
  onCheckout: (bundleId: string, discountCode: string) => Promise<{ bytes: number; granted: number }>;
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat().format(bytes);
}

export default function ByteShopScreen({
  realBytes,
  onDailyClaim,
  onCheckout,
  onBack,
}: Props) {
  const [selectedBundleId, setSelectedBundleId] = useState(BYTE_BUNDLES[1].id);
  const [discountCode, setDiscountCode] = useState('');
  const [cardholder, setCardholder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [zip, setZip] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedBundle = useMemo(
    () => BYTE_BUNDLES.find((bundle) => bundle.id === selectedBundleId) ?? BYTE_BUNDLES[0],
    [selectedBundleId],
  );

  const discountApplied = discountCode.trim().toUpperCase() === 'NICKISTHEGOAT';
  const isFreeCheckout = selectedBundle.price === 'Free' || discountApplied;
  const checkoutPrice = isFreeCheckout ? 'Free' : selectedBundle.price;

  const clearPaymentFields = () => {
    setCardholder('');
    setCardNumber('');
    setExpiry('');
    setCvc('');
    setZip('');
  };

  const claimDaily = () => {
    if (busy) return;
    setBusy(true);
    setReceipt(null);
    setShopError(null);
    onDailyClaim()
      .then(({ granted }) => {
        setReceipt(`Free Daily Claim approved for ${formatBytes(granted)} bytes.`);
      })
      .catch((err) => {
        setShopError(err instanceof Error ? err.message : 'Daily claim failed');
      })
      .finally(() => setBusy(false));
  };

  const fakeCheckout = () => {
    if (busy) return;
    setBusy(true);
    setReceipt(null);
    setShopError(null);
    onCheckout(selectedBundle.id, discountCode)
      .then(({ granted }) => {
        setReceipt(
          `${selectedBundle.name} approved for ${formatBytes(
            granted,
          )} bytes. Discount code NICKISTHEGOAT applied.`,
        );
        clearPaymentFields();
      })
      .catch((err) => {
        setShopError(err instanceof Error ? err.message : 'Checkout failed');
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="screen byte-shop-screen">
      <header className="byte-shop-header">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to main menu
        </button>
        <div>
          <span className="screen-kicker">Premium Throughput</span>
          <h2>Byte Shop</h2>
        </div>
        <div className="byte-balance-card inventory-bytes-pill">
          <span className="screen-kicker">Wallet</span>
          <strong>{realBytes === null ? '—' : formatBytes(realBytes)}</strong>
        </div>
      </header>

      <div className="byte-shop-layout">
        <section className="byte-bundle-grid builder-card-grid">
          {BYTE_BUNDLES.map((bundle) => {
            const selected = selectedBundle.id === bundle.id;
            const isDaily = bundle.id === 'daily';
            const isElite = bundle.tier === 'epic' || bundle.tier === 'legendary';
            return (
              <button
                key={bundle.id}
                type="button"
                className={`builder-card byte-bundle-card ${selected && !isDaily ? 'selected' : ''} ${
                  isDaily ? 'daily' : ''
                }`}
                aria-pressed={selected}
                disabled={busy}
                onClick={() => {
                  if (isDaily) {
                    claimDaily();
                    return;
                  }
                  setSelectedBundleId(bundle.id);
                  setReceipt(null);
                  setShopError(null);
                }}
              >
                {isElite && (
                  <>
                    <span className="proto-aura" aria-hidden="true" />
                    <span className="proto-ring" aria-hidden="true" />
                  </>
                )}
                {bundle.badge && <span className="byte-bundle-badge">{bundle.badge}</span>}
                <span className="proto-badge">BUNDLE</span>
                <span className={`rarity-pill rarity-${bundle.tier}`}>{bundle.tier}</span>
                <span className="builder-card-kicker">Bundle</span>
                <strong className="builder-card-title">{bundle.name}</strong>
                <span className="builder-card-stat byte-amount">{bundle.amountLabel}</span>
                <span className="builder-card-foot byte-price">{bundle.price}</span>
              </button>
            );
          })}
        </section>

        <aside className="checkout-panel menu-panel">
          <span className="screen-kicker">Secure Checkout</span>
          <h2>{selectedBundle.name}</h2>
          <div className="checkout-total">
            <span>{selectedBundle.amountLabel}</span>
            <strong>{checkoutPrice}</strong>
          </div>

          <label className="checkout-field">
            <span>Discount code</span>
            <input
              value={discountCode}
              onChange={(event) => {
                setDiscountCode(event.target.value);
                setReceipt(null);
              }}
              placeholder="Enter code"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {discountApplied && <p className="discount-success">Discount accepted. Total waived.</p>}

          <div className="checkout-card-fields">
            <label className="checkout-field">
              <span>Name on card</span>
              <input
                value={cardholder}
                onChange={(event) => {
                  setCardholder(event.target.value);
                  setReceipt(null);
                }}
                placeholder="Nick DeMarinis"
                autoComplete="cc-name"
                spellCheck={false}
              />
            </label>

            <label className="checkout-field">
              <span>Card number</span>
              <input
                value={cardNumber}
                onChange={(event) => {
                  setCardNumber(event.target.value);
                  setReceipt(null);
                }}
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                autoComplete="cc-number"
              />
            </label>

            <div className="checkout-split">
              <label className="checkout-field">
                <span>Expiry</span>
                <input
                  value={expiry}
                  onChange={(event) => {
                    setExpiry(event.target.value);
                    setReceipt(null);
                  }}
                  placeholder="04/32"
                  autoComplete="cc-exp"
                />
              </label>
              <label className="checkout-field">
                <span>CVC</span>
                <input
                  value={cvc}
                  onChange={(event) => {
                    setCvc(event.target.value);
                    setReceipt(null);
                  }}
                  inputMode="numeric"
                  placeholder="404"
                  autoComplete="cc-csc"
                />
              </label>
            </div>

            <label className="checkout-field">
              <span>Billing ZIP</span>
              <input
                value={zip}
                onChange={(event) => {
                  setZip(event.target.value);
                  setReceipt(null);
                }}
                inputMode="numeric"
                placeholder="02139"
                autoComplete="postal-code"
              />
            </label>
          </div>

          <button type="button" className="battle-button" disabled={busy} onClick={fakeCheckout}>
            {busy ? 'Processing...' : 'Complete checkout'}
          </button>
          <p className="menu-note">
            Demo only. No payment information is processed, stored, or sent anywhere.
          </p>
          {shopError && <p className="error">{shopError}</p>}
          {receipt && <p className="checkout-receipt">{receipt}</p>}
        </aside>
      </div>
    </div>
  );
}
