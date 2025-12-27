import { useCallback, useEffect, useMemo, useState } from 'react';
import { Contract, Log } from 'ethers';
import { useAccount } from 'wagmi';
import { createPublicClient, http, isAddress } from 'viem';
import { sepolia } from 'viem/chains';

import { Header } from './Header';
import { TokenCard } from './TokenCard';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { LOTTERY_CONTRACT, TOKEN_CONTRACTS, ZERO_ADDRESS } from '../config/contracts';
import '../styles/LotteryApp.css';

type TokenState = {
  address: `0x${string}`;
  title: string;
  name: string;
  symbol: string;
  encryptedBalance?: string;
  decryptedBalance?: string;
  isDecrypting: boolean;
};

type DrawRecord = {
  txHash: string;
  tokenAddress: string;
  tokenTitle: string;
  tokenSymbol: string;
  amount: string;
  timestamp: string;
};

const ZERO_CIPHERTEXT = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function LotteryApp() {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: sepolia,
        transport: http('https://rpc.sepolia.org'),
      }),
    [],
  );

  const [tokenStates, setTokenStates] = useState<TokenState[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [balanceVersion, setBalanceVersion] = useState(0);

  const fallbackStates: TokenState[] = useMemo(
    () =>
      TOKEN_CONTRACTS.map((token) => ({
        address: token.address,
        title: token.title,
        name: token.key,
        symbol: token.key,
        encryptedBalance: undefined,
        decryptedBalance: undefined,
        isDecrypting: false,
      })),
    [],
  );

  const loadTokens = useCallback(async () => {
    setLoadingTokens(true);
    setLoadError(null);

    try {
      if (LOTTERY_CONTRACT.address === ZERO_ADDRESS) {
        throw new Error('Lottery contract configuration is missing. Update contracts.ts with deployed values.');
      }

      const tokenAddresses = (await publicClient.readContract({
        address: LOTTERY_CONTRACT.address,
        abi: LOTTERY_CONTRACT.abi,
        functionName: 'getSupportedTokens',
      })) as `0x${string}`[];

      const detailedStates: TokenState[] = await Promise.all(
        tokenAddresses.map(async (tokenAddress) => {
          if (!isAddress(tokenAddress)) {
            throw new Error(`Invalid token address returned by lottery: ${tokenAddress}`);
          }

          const tokenConfig = TOKEN_CONTRACTS.find(
            (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
          );

          if (!tokenConfig || tokenConfig.address === ZERO_ADDRESS) {
            throw new Error(`Missing ABI configuration for token ${tokenAddress}`);
          }

          const [name, symbol] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress,
              abi: tokenConfig.abi,
              functionName: 'name',
            }) as Promise<string>,
            publicClient.readContract({
              address: tokenAddress,
              abi: tokenConfig.abi,
              functionName: 'symbol',
            }) as Promise<string>,
          ]);

          return {
            address: tokenAddress,
            title: tokenConfig.title,
            name,
            symbol,
            encryptedBalance: undefined,
            decryptedBalance: undefined,
            isDecrypting: false,
          } satisfies TokenState;
        }),
      );

      setTokenStates(detailedStates);
      setBalanceVersion((version: number) => version + 1);
    } catch (error) {
      console.error('Failed to load tokens', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load lottery configuration');
      setTokenStates((previous: TokenState[]) => (previous.length > 0 ? previous : fallbackStates));
    } finally {
      setLoadingTokens(false);
    }
  }, [fallbackStates, publicClient]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  useEffect(() => {
    if (!address) {
      setTokenStates((prev: TokenState[]) =>
        prev.map((token: TokenState) => ({
          ...token,
          encryptedBalance: undefined,
          decryptedBalance: undefined,
        })),
      );
      return;
    }

    if (tokenStates.length === 0) {
      return;
    }

    let cancelled = false;

    const fetchBalances = async () => {
      const updated = await Promise.all(
        tokenStates.map(async (token: TokenState) => {
          const tokenConfig = TOKEN_CONTRACTS.find(
            (config) => config.address.toLowerCase() === token.address.toLowerCase(),
          );

          if (!tokenConfig || tokenConfig.address === ZERO_ADDRESS) {
            return {
              ...token,
              encryptedBalance: undefined,
              decryptedBalance: undefined,
            };
          }

          try {
            const encryptedBalance = (await publicClient.readContract({
              address: token.address,
              abi: tokenConfig.abi,
              functionName: 'confidentialBalanceOf',
              args: [address],
            })) as string;

            if (encryptedBalance === ZERO_CIPHERTEXT) {
              return {
                ...token,
                encryptedBalance,
                decryptedBalance: '0',
              };
            }

            return {
              ...token,
              encryptedBalance,
              decryptedBalance: token.decryptedBalance,
            };
          } catch (error) {
            console.error(`Failed to read encrypted balance for ${token.address}`, error);
            return {
              ...token,
              encryptedBalance: undefined,
              decryptedBalance: undefined,
            };
          }
        }),
      );

      if (!cancelled) {
        setTokenStates(updated);
      }
    };

    fetchBalances();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient, tokenStates.length, balanceVersion]);

  const handleDecrypt = useCallback(
    async (token: TokenState) => {
      if (!address) {
        alert('Connect your wallet to decrypt balances.');
        return;
      }

      if (!token.encryptedBalance) {
        alert('No encrypted balance found for this token yet.');
        return;
      }

      if (token.encryptedBalance === ZERO_CIPHERTEXT) {
        setTokenStates((prev: TokenState[]) =>
          prev.map((item: TokenState) => (item.address === token.address ? { ...item, decryptedBalance: '0' } : item)),
        );
        return;
      }

      if (!instance) {
        alert('Encryption services are still initializing. Please try again in a moment.');
        return;
      }

      const signer = await signerPromise;

      if (!signer) {
        alert('A signer is required to decrypt balances.');
        return;
      }

      setTokenStates((prev: TokenState[]) =>
        prev.map((item: TokenState) => (item.address === token.address ? { ...item, isDecrypting: true } : item)),
      );

      try {
        const keypair = instance.generateKeypair();
        const startTimeStamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '10';
        const contractAddresses = [token.address];
        const handleContractPairs = [
          {
            handle: token.encryptedBalance,
            contractAddress: token.address,
          },
        ];

        const eip712 = instance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimeStamp,
          durationDays,
        );

        const signature = await signer.signTypedData(
          eip712.domain,
          {
            UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
          },
          eip712.message,
        );

        const result = await instance.userDecrypt(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contractAddresses,
          address,
          startTimeStamp,
          durationDays,
        );

        const decryptedValue = String(result[token.encryptedBalance] ?? '0');

        setTokenStates((prev: TokenState[]) =>
          prev.map((item: TokenState) =>
            item.address === token.address ? { ...item, decryptedBalance: decryptedValue } : item,
          ),
        );
      } catch (error) {
        console.error('Failed to decrypt balance', error);
        alert(`Failed to decrypt balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setTokenStates((prev: TokenState[]) =>
          prev.map((item: TokenState) => (item.address === token.address ? { ...item, isDecrypting: false } : item)),
        );
      }
    },
    [address, instance, signerPromise],
  );

  const triggerBalanceRefresh = useCallback(() => {
    setBalanceVersion((version: number) => version + 1);
  }, []);

  const handleDraw = useCallback(async () => {
    if (!signerPromise) {
      alert('Connect your wallet to run the lottery.');
      return;
    }

    if (LOTTERY_CONTRACT.address === ZERO_ADDRESS) {
      alert('Lottery contract configuration is missing. Update contracts.ts with deployed values.');
      return;
    }

    setIsDrawing(true);

    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('No signer available from wallet.');
      }

      const lotteryContract = new Contract(LOTTERY_CONTRACT.address, LOTTERY_CONTRACT.abi, signer);
      const tx = await lotteryContract.draw();
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Lottery draw transaction failed.');
      }

      let rewardLog: ReturnType<typeof lotteryContract.interface.parseLog> | null = null;

      for (const log of receipt.logs as Log[]) {
        try {
          const parsed = lotteryContract.interface.parseLog(log);
          if (parsed && parsed.name === 'LotteryReward') {
            rewardLog = parsed;
            break;
          }
        } catch (_error) {
          // Ignore unrelated logs
        }
      }

      if (rewardLog) {
        const tokenAddress = rewardLog.args?.token as string;
        const amount = rewardLog.args?.amount as bigint;
        const matchedToken = tokenStates.find(
          (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
        );

        setDrawHistory((prev: DrawRecord[]) => [
          {
            txHash: tx.hash,
            tokenAddress,
            amount: amount.toString(),
            tokenTitle: matchedToken?.title ?? 'Unknown Token',
            tokenSymbol: matchedToken?.symbol ?? matchedToken?.name ?? '',
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 6));

        if (matchedToken) {
          setTokenStates((prev: TokenState[]) =>
            prev.map((token: TokenState) =>
              token.address === matchedToken.address
                ? { ...token, decryptedBalance: undefined, encryptedBalance: token.encryptedBalance }
                : token,
            ),
          );
        }
      }

      triggerBalanceRefresh();
    } catch (error) {
      console.error('Lottery draw failed', error);
      alert(`Lottery draw failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDrawing(false);
    }
  }, [signerPromise, tokenStates, triggerBalanceRefresh]);

  return (
    <div className="lottery-app">
      <Header />
      <main className="lottery-main">
        <section className="lottery-hero">
          <h2 className="lottery-hero-title">Encrypted rewards, transparent execution</h2>
          <p className="lottery-hero-text">
            Each draw selects one of the deployed ERC7984 tokens and mints 1 to 100 encrypted units directly to your
            wallet. Balances stay private thanks to Zama&apos;s FHE tooling, and you can decrypt them locally whenever you
            need insight.
          </p>
          <div className="lottery-action">
            <button
              type="button"
              className="lottery-button"
              onClick={handleDraw}
              disabled={isDrawing || !address || !signerPromise}
            >
              {isDrawing ? 'Drawing…' : 'Run Lottery Draw'}
            </button>
            {!address && <span className="lottery-warning">Connect your wallet to start drawing prizes.</span>}
            {loadError && <span className="lottery-warning">{loadError}</span>}
            {zamaError && <span className="lottery-warning">{zamaError}</span>}
            {zamaLoading && <span className="lottery-status">Initializing Zama SDK…</span>}
            {loadingTokens && <span className="lottery-status">Loading deployed contracts…</span>}
          </div>
        </section>

        <section className="tokens-section">
          <div className="section-header">
            <h3 className="section-title">Your confidential balances</h3>
            <p className="section-subtitle">Decrypt locally to reveal draw rewards.</p>
          </div>

          <div className="token-grid">
            {tokenStates.map((token) => (
              <TokenCard
                key={token.address}
                title={token.title}
                name={token.name}
                symbol={token.symbol}
                address={token.address}
                encryptedBalance={token.encryptedBalance}
                decryptedBalance={token.decryptedBalance}
                decrypting={token.isDecrypting}
                onDecrypt={() => handleDecrypt(token)}
                connected={Boolean(address)}
                canDecrypt={Boolean(instance) && !zamaLoading}
              />
            ))}
          </div>
        </section>

        <section className="history-section">
          <div className="section-header">
            <h3 className="section-title">Recent draws</h3>
            <p className="section-subtitle">Latest on-chain outcomes from this session.</p>
          </div>
          {drawHistory.length === 0 ? (
            <div className="empty-history">Your rewards will appear here after you run the lottery.</div>
          ) : (
            <ul className="history-list">
              {drawHistory.map((record) => (
                <li key={record.txHash} className="history-item">
                  <p className="history-heading">
                    {record.tokenTitle} {record.tokenSymbol ? `(${record.tokenSymbol})` : ''}
                  </p>
                  <div className="history-meta">
                    <span>Amount: {record.amount}</span>
                    <span>Hash: {record.txHash.slice(0, 10)}…</span>
                    <span>{new Date(record.timestamp).toLocaleTimeString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
