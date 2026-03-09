const axios = require('axios');

const RELAY_URL = 'http://localhost:3001';

async function testRelay() {
  console.log('🧪 Testing Blockchain Relay Service\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing health endpoint...');
    const health = await axios.get(`${RELAY_URL}/health`);
    console.log('   ✅ Health check passed');
    console.log('   Status:', health.data.status);
    console.log('   Network:', health.data.blockchain.network);
    console.log('   Block:', health.data.blockchain.blockNumber);
    console.log();

    // Test 2: Record Transaction
    console.log('2️⃣ Testing transaction recording...');
    const testTx = {
      txIdOffchain: `TEST_${Date.now()}`,
      amount: 150000,
      timestamp: Math.floor(Date.now() / 1000),
      fromId: 'user_test_123',
      toId: 'merchant_test_456'
    };

    const recordResponse = await axios.post(`${RELAY_URL}/record-transaction`, testTx);
    console.log('   ✅ Transaction recorded');
    console.log('   TX Hash:', recordResponse.data.data.blockchainTxHash);
    console.log('   Block:', recordResponse.data.data.blockNumber);
    console.log();

    // Test 3: Retrieve Transaction
    console.log('3️⃣ Testing transaction retrieval...');
    const getTx = await axios.get(`${RELAY_URL}/transaction/${testTx.txIdOffchain}`);
    console.log('   ✅ Transaction retrieved');
    console.log('   Amount:', getTx.data.data.amount);
    console.log('   From:', getTx.data.data.fromId);
    console.log('   To:', getTx.data.data.toId);
    console.log();

    // Test 4: Statistics
    console.log('4️⃣ Testing statistics endpoint...');
    const stats = await axios.get(`${RELAY_URL}/stats`);
    console.log('   ✅ Statistics retrieved');
    console.log('   Total Transactions:', stats.data.data.totalTransactions);
    console.log('   Current Block:', stats.data.data.currentBlockNumber);
    console.log();

    // Test 5: Duplicate Prevention
    console.log('5️⃣ Testing duplicate prevention...');
    try {
      await axios.post(`${RELAY_URL}/record-transaction`, testTx);
      console.log('   ❌ FAILED: Duplicate was allowed');
    } catch (error) {
      if (error.response.status === 409) {
        console.log('   ✅ Duplicate correctly rejected');
      }
    }
    console.log();

    console.log('✨ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

// Run if this is the main module
if (require.main === module) {
  testRelay();
}

module.exports = { testRelay };
