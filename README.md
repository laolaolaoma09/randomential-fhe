<p align="center">
  <img src="https://img.shields.io/badge/Zama-FHE-00D4AA?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMiA3TDEyIDEyTDIyIDdMMTIgMloiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yIDE3TDEyIDIyTDIyIDE3IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTIgMTJMMTIgMTdMMjIgMTIiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K" alt="Zama FHE"/>
  <img src="https://img.shields.io/badge/Solidity-0.8.27-363636?style=for-the-badge&logo=solidity" alt="Solidity"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/>
</p>

<h1 align="center">LuckyVault</h1>

<p align="center">
  <strong>Privacy-Preserving Lottery Platform powered by Fully Homomorphic Encryption</strong>
</p>

<p align="center">
  Win encrypted token rewards that remain completely private on-chain until you choose to reveal them.
</p>

---

## Overview

LuckyVault is a decentralized lottery application built on **Zama's fhEVM** technology. Using Fully Homomorphic Encryption (FHE), all token balances and rewards are encrypted on-chain, ensuring complete privacy while maintaining full transparency of the lottery mechanism.

### Key Features

- **Encrypted Rewards** - All token balances stored as encrypted ciphertexts
- **Private Until You Decide** - Only you can decrypt your winnings
- **Provably Fair** - On-chain verifiable randomness
- **Multi-Token Support** - 5 different confidential ERC7984 tokens
- **Modern Web3 UX** - RainbowKit wallet integration

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   1. Connect Wallet    2. Draw Lottery    3. Win Tokens    │
│        ↓                    ↓                   ↓          │
│   [MetaMask] ────→ [Smart Contract] ────→ [Encrypted]      │
│                     Random Selection       Balance         │
│                                                             │
│   4. View Encrypted    5. Decrypt Locally                  │
│        Handle               ↓                              │
│        ↓              [Your Private                        │
│   [0x7f3a...]          Balance: 42]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

1. **Connect** your wallet via RainbowKit
2. **Draw** to trigger the on-chain lottery
3. **Receive** encrypted tokens (cDAI, cUSDC, cWBTC, cLINK, cUSDT)
4. **Decrypt** your balance locally when you're ready

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Encryption** | Zama fhEVM, FHE Library |
| **Smart Contracts** | Solidity 0.8.27, ERC7984 |
| **Development** | Hardhat, TypeChain |
| **Frontend** | React 19, TypeScript, Vite |
| **Web3** | Wagmi, Viem, RainbowKit |
| **Decryption** | Zama Relayer SDK |

---

## Quick Start

### Prerequisites

- Node.js 20+
- MetaMask or compatible wallet
- Sepolia ETH for gas

### Installation

```bash
# Clone repository
git clone https://github.com/laolaolaoma09/randomential-fhe.git
cd randomential-fhe

# Install dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Configuration

```bash
# Set up environment variables
npx hardhat vars set PRIVATE_KEY
npx hardhat vars set INFURA_API_KEY
```

### Deploy & Run

```bash
# Compile contracts
npm run compile

# Deploy to Sepolia
npm run deploy:sepolia

# Start frontend
cd frontend && npm run dev
```

---

## Smart Contracts

### TokenLottery.sol

Main lottery contract handling random draws and token distribution.

```solidity
function draw() external {
    // Generate randomness from multiple sources
    uint256 randomValue = uint256(keccak256(abi.encode(
        block.prevrandao,
        block.timestamp,
        msg.sender,
        drawNonce++,
        blockhash(block.number - 1)
    )));

    // Select random token and amount
    address token = supportedTokens[randomValue % tokenCount];
    uint64 amount = uint64((randomValue % 100) + 1);

    // Mint encrypted tokens
    IERC7984(token).mint(msg.sender, amount);
}
```

### ERC7984 Confidential Tokens

Five encrypted token implementations:
- **cDAI** - Confidential DAI
- **cUSDC** - Confidential USDC
- **cWBTC** - Confidential Wrapped Bitcoin
- **cLINK** - Confidential Chainlink
- **cUSDT** - Confidential Tether

All balances are stored as `euint64` encrypted integers.

---

## Project Structure

```
luckyvault/
├── contracts/
│   ├── TokenLottery.sol      # Main lottery logic
│   ├── ERC7984DAI.sol        # Confidential tokens
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   └── config/           # Contract configs
│   └── package.json
├── deploy/                   # Deployment scripts
├── test/                     # Test suites
└── hardhat.config.ts
```

---

## Privacy Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    ON-CHAIN (PUBLIC)                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  TokenLottery          ERC7984 Tokens              │  │
│  │  ├─ draw()             ├─ balances: euint64        │  │
│  │  └─ randomness         └─ encrypted storage       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                   OFF-CHAIN (PRIVATE)                    │
│  ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │  User's Wallet  │───→│  Zama Relayer Network       │  │
│  │  EIP-712 Sign   │    │  Decrypt with Authorization │  │
│  └─────────────────┘    └─────────────────────────────┘  │
│                                     │                    │
│                                     ▼                    │
│                         ┌───────────────────┐            │
│                         │  Decrypted Value  │            │
│                         │  (Client Only)    │            │
│                         └───────────────────┘            │
└──────────────────────────────────────────────────────────┘
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile smart contracts |
| `npm run test` | Run test suite |
| `npm run deploy:sepolia` | Deploy to Sepolia |
| `npm run coverage` | Generate coverage report |
| `cd frontend && npm run dev` | Start frontend dev server |
| `cd frontend && npm run build` | Build for production |

---

## Security

- **Randomness**: Uses RANDAO, timestamps, addresses, and block hashes
- **Access Control**: Only token holders can decrypt their balances
- **No Backdoors**: No admin decryption keys exist
- **Auditable**: All lottery logic is transparent and on-chain

---

## Network

| Property | Value |
|----------|-------|
| Network | Sepolia Testnet |
| Chain ID | 11155111 |
| Lottery Contract | `0x...` (after deployment) |

---

## References

- [Zama fhEVM Documentation](https://docs.zama.org/fhevm)
- [ERC7984 Confidential Token Standard](https://docs.openzeppelin.com/contracts-confidential)
- [Zama Developer Program](https://docs.zama.org/programs/developer-program)

---

## License

MIT License

---

<p align="center">
  <strong>Built with Zama FHE for the Zama Developer Program</strong>
</p>
