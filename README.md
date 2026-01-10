# genepay-blockchain-service

Minimal demo blockchain service used by the GenePay project.

## Install

From the `genepay-blockchain-service` folder run:

```bash
npm install
```

## Run

```bash
npm start
# or set PORT: PORT=4000 npm start
```

## Endpoints

- `GET /health` — health check
- `GET /blocks` — current in-memory chain
- `POST /tx` — create a transaction (JSON body: `{ "from": "A", "to": "B", "amount": 10 }`)
- `POST /mine` — mine a block including mempool transactions

This is a minimal demo - data is stored in memory and resets when the process restarts.
