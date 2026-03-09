# genepay-blockchain-service / contract

Hardhat project for the `AuditLedger` smart contract used by the GenePay payment audit system. Supports deployment to a local Hardhat node or the Sepolia testnet.

## Prerequisites

- Node.js 18+
- A wallet private key (test wallet recommended)
- Sepolia RPC URL from [Infura](https://infura.io) or [Alchemy](https://alchemy.com) _(testnet only)_
- Sepolia test ETH from [sepoliafaucet.com](https://sepoliafaucet.com) _(testnet only)_

## Install

From the `contract` folder run:

```bash
npm install
```

## Configure

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable            | Description                                  |
| ------------------- | -------------------------------------------- |
| `SEPOLIA_RPC_URL`   | Infura/Alchemy Sepolia endpoint              |
| `PRIVATE_KEY`       | Deployer wallet private key (no `0x` prefix) |
| `ETHERSCAN_API_KEY` | Etherscan API key for contract verification  |
| `CONTRACT_ADDRESS`  | Filled automatically after deployment        |

## Compile

```bash
npm run compile
```

Compiled artifacts are output to `artifacts/`.

## Deploy

**Local Hardhat node** (no ETH required):

```bash
# Terminal 1 — start local node
npm run node

# Terminal 2 — deploy
npm run deploy:local
```

**Sepolia testnet:**

```bash
npm run deploy:sepolia
```

After deployment, `CONTRACT_ADDRESS` in `.env` and `deployments.json` are updated automatically.

## Test

```bash
npm test
```
