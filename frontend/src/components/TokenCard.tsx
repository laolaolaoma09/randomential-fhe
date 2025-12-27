import '../styles/LotteryApp.css';

const ZERO_CIPHERTEXT = '0x0000000000000000000000000000000000000000000000000000000000000000';

function shortenAddress(address: string) {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type TokenCardProps = {
  title: string;
  name: string;
  symbol: string;
  address: string;
  encryptedBalance?: string;
  decryptedBalance?: string;
  decrypting: boolean;
  onDecrypt: () => void;
  connected: boolean;
  canDecrypt: boolean;
};

export function TokenCard({
  title,
  name,
  symbol,
  address,
  encryptedBalance,
  decryptedBalance,
  decrypting,
  onDecrypt,
  connected,
  canDecrypt,
}: TokenCardProps) {
  const balanceLabel = decryptedBalance ?? (encryptedBalance === ZERO_CIPHERTEXT ? '0' : undefined);

  return (
    <div className="token-card">
      <div className="token-header">
        <div>
          <h3 className="token-name">{title}</h3>
          <p className="token-symbol">{symbol || name}</p>
        </div>
      </div>
      <p className="token-address">{shortenAddress(address)}</p>
      <div className="token-balance">
        {!connected ? (
          <p className="token-balance-placeholder">Connect your wallet to view balances.</p>
        ) : balanceLabel !== undefined ? (
          <p className="token-balance-value">{balanceLabel} tokens</p>
        ) : encryptedBalance ? (
          <button
            type="button"
            className="token-decrypt-button"
            onClick={onDecrypt}
            disabled={decrypting || !canDecrypt}
          >
            {decrypting ? 'Decrypting…' : canDecrypt ? 'Decrypt Balance' : 'Initializing…'}
          </button>
        ) : (
          <p className="token-balance-placeholder">Complete a draw to receive encrypted rewards.</p>
        )}
      </div>
    </div>
  );
}
