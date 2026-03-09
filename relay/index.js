const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.RELAY_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Load contract ABI (simplified version - only what we need)
const CONTRACT_ABI = [
  "function recordTransaction(string txIdOffchain, bytes32 dataHash, uint256 amount, uint256 timestamp, string fromId, string toId) public",
  "function getTransaction(string txIdOffchain) public view returns (tuple(string txIdOffchain, bytes32 dataHash, uint256 amount, uint256 timestamp, string fromId, string toId, bool exists))",
  "function transactionExists(string txIdOffchain) public view returns (bool)",
  "function getTotalTransactions() public view returns (uint256)",
  "event TransactionRecorded(string indexed txIdOffchain, bytes32 dataHash, uint256 amount, uint256 timestamp, string fromId, string toId)"
];

// Ethereum provider and contract setup
let provider;
let wallet;
let contract;

async function initializeBlockchain() {
  try {
    const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!rpcUrl || !privateKey || !contractAddress) {
      throw new Error('Missing required environment variables: SEPOLIA_RPC_URL, PRIVATE_KEY, or CONTRACT_ADDRESS');
    }

    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    console.log('✅ Blockchain connection initialized');
    console.log('📍 Contract address:', contractAddress);
    console.log('👤 Wallet address:', wallet.address);
    
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Wallet balance:', ethers.formatEther(balance), 'ETH');

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize blockchain:', error.message);
    return false;
  }
}

// Helper function to compute transaction hash
function computeTransactionHash(txData) {
  const dataString = JSON.stringify({
    txIdOffchain: txData.txIdOffchain,
    amount: txData.amount,
    timestamp: txData.timestamp,
    fromId: txData.fromId,
    toId: txData.toId
  });
  
  return ethers.keccak256(ethers.toUtf8Bytes(dataString));
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const blockNumber = await provider.getBlockNumber();
    const balance = await provider.getBalance(wallet.address);
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      blockchain: {
        connected: true,
        network: (await provider.getNetwork()).name,
        blockNumber: blockNumber,
        walletAddress: wallet.address,
        walletBalance: ethers.formatEther(balance)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Blockchain connection error',
      error: error.message
    });
  }
});

// Transaction queue to prevent nonce collisions
let transactionQueue = Promise.resolve();

// Record transaction endpoint
app.post('/record-transaction', async (req, res) => {
  try {
    const { txIdOffchain, amount, timestamp, fromId, toId } = req.body;

    // Validation
    if (!txIdOffchain || !amount || !timestamp || !fromId || !toId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
        required: ['txIdOffchain', 'amount', 'timestamp', 'fromId', 'toId']
      });
    }

    // Check if transaction already exists
    const exists = await contract.transactionExists(txIdOffchain);
    if (exists) {
      return res.status(409).json({
        status: 'error',
        message: 'Transaction already recorded on blockchain',
        txIdOffchain
      });
    }

    // Compute hash of transaction data
    const dataHash = computeTransactionHash(req.body);

    console.log(`📝 Recording transaction: ${txIdOffchain}`);
    console.log(`   Amount: ${amount}, From: ${fromId}, To: ${toId}`);

    // Queue the transaction to prevent nonce collisions
    const result = await new Promise((resolve, reject) => {
      transactionQueue = transactionQueue.then(async () => {
        try {
          // Send transaction to blockchain
          const tx = await contract.recordTransaction(
            txIdOffchain,
            dataHash,
            BigInt(amount),
            BigInt(timestamp),
            fromId,
            toId,
            {
              // Let ethers handle nonce automatically
              // Add small delay between transactions
            }
          );

          console.log('⏳ Transaction sent, waiting for confirmation...');
          console.log('   TX Hash:', tx.hash);

          // Wait for confirmation
          const receipt = await tx.wait();

          console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

          resolve({
            txIdOffchain,
            blockchainTxHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            dataHash
          });
        } catch (error) {
          reject(error);
        }
      }).catch(reject);
    });

    res.json({
      status: 'success',
      message: 'Transaction recorded on blockchain',
      data: result
    });

  } catch (error) {
    console.error('❌ Error recording transaction:', error);
    
    // More detailed error response
    const errorResponse = {
      status: 'error',
      message: 'Failed to record transaction on blockchain',
      error: error.message
    };

    if (error.code === 'REPLACEMENT_UNDERPRICED') {
      errorResponse.message = 'Transaction nonce collision detected. Please retry.';
      errorResponse.retryable = true;
    }

    res.status(500).json(errorResponse);
  }
});

// Get transaction from blockchain
app.get('/transaction/:txId', async (req, res) => {
  try {
    const { txId } = req.params;

    const exists = await contract.transactionExists(txId);
    if (!exists) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found on blockchain'
      });
    }

    const tx = await contract.getTransaction(txId);

    res.json({
      status: 'success',
      data: {
        txIdOffchain: tx.txIdOffchain,
        dataHash: tx.dataHash,
        amount: tx.amount.toString(),
        timestamp: tx.timestamp.toString(),
        fromId: tx.fromId,
        toId: tx.toId
      }
    });

  } catch (error) {
    console.error('❌ Error fetching transaction:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

// Get blockchain statistics
app.get('/stats', async (req, res) => {
  try {
    const totalTransactions = await contract.getTotalTransactions();
    const blockNumber = await provider.getBlockNumber();

    res.json({
      status: 'success',
      data: {
        totalTransactions: totalTransactions.toString(),
        currentBlockNumber: blockNumber,
        contractAddress: await contract.getAddress(),
        network: (await provider.getNetwork()).name
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// Batch record endpoint (for multiple transactions)
app.post('/record-batch', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'transactions array is required'
      });
    }

    const results = [];
    
    for (const txData of transactions) {
      try {
        const { txIdOffchain, amount, timestamp, fromId, toId } = txData;
        
        const exists = await contract.transactionExists(txIdOffchain);
        if (exists) {
          results.push({
            txIdOffchain,
            status: 'skipped',
            reason: 'Already exists'
          });
          continue;
        }

        const dataHash = computeTransactionHash(txData);
        const tx = await contract.recordTransaction(
          txIdOffchain,
          dataHash,
          BigInt(amount),
          BigInt(timestamp),
          fromId,
          toId
        );

        const receipt = await tx.wait();

        results.push({
          txIdOffchain,
          status: 'success',
          blockchainTxHash: receipt.hash,
          blockNumber: receipt.blockNumber
        });

      } catch (error) {
        results.push({
          txIdOffchain: txData.txIdOffchain,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      status: 'completed',
      message: `Processed ${transactions.length} transactions`,
      results
    });

  } catch (error) {
    console.error('❌ Error in batch recording:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process batch',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: err.message
  });
});

// Start server
async function start() {
  const initialized = await initializeBlockchain();
  
  if (!initialized) {
    console.error('❌ Failed to initialize blockchain connection. Please check your .env file.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🚀 BioPay Blockchain Relay Server');
    console.log(`${'='.repeat(60)}`);
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Statistics: http://localhost:${PORT}/stats`);
    console.log(`${'='.repeat(60)}\n`);
  });
}

start();

module.exports = app;
