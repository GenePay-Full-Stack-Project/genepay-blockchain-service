const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AuditLedger", function () {
  let auditLedger;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const AuditLedger = await ethers.getContractFactory("AuditLedger");
    auditLedger = await AuditLedger.deploy();
    await auditLedger.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await auditLedger.owner()).to.equal(owner.address);
    });

    it("Should emit ContractDeployed event", async function () {
      const AuditLedger = await ethers.getContractFactory("AuditLedger");
      const deployment = await AuditLedger.deploy();
      await expect(deployment.deploymentTransaction())
        .to.emit(deployment, "ContractDeployed")
        .withArgs(owner.address, await ethers.provider.getBlock('latest').then(b => b.timestamp));
    });

    it("Should start with zero transactions", async function () {
      expect(await auditLedger.getTotalTransactions()).to.equal(0);
    });
  });

  describe("Recording Transactions", function () {
    const txId = "TXN_12345";
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("sample transaction data"));
    const amount = 150000; // $1500.00 in cents
    const timestamp = Math.floor(Date.now() / 1000);
    const fromId = "user_abc123";
    const toId = "merchant_xyz789";

    it("Should record a new transaction successfully", async function () {
      await expect(
        auditLedger.recordTransaction(txId, dataHash, amount, timestamp, fromId, toId)
      )
        .to.emit(auditLedger, "TransactionRecorded")
        .withArgs(txId, dataHash, amount, timestamp, fromId, toId);

      expect(await auditLedger.getTotalTransactions()).to.equal(1);
      expect(await auditLedger.transactionExists(txId)).to.be.true;
    });

    it("Should store transaction details correctly", async function () {
      await auditLedger.recordTransaction(txId, dataHash, amount, timestamp, fromId, toId);
      
      const tx = await auditLedger.getTransaction(txId);
      expect(tx.txIdOffchain).to.equal(txId);
      expect(tx.dataHash).to.equal(dataHash);
      expect(tx.amount).to.equal(amount);
      expect(tx.timestamp).to.equal(timestamp);
      expect(tx.fromId).to.equal(fromId);
      expect(tx.toId).to.equal(toId);
      expect(tx.exists).to.be.true;
    });

    it("Should prevent duplicate transaction IDs", async function () {
      await auditLedger.recordTransaction(txId, dataHash, amount, timestamp, fromId, toId);
      
      await expect(
        auditLedger.recordTransaction(txId, dataHash, amount, timestamp, fromId, toId)
      ).to.be.revertedWith("Transaction already recorded");
    });

    it("Should reject zero amount", async function () {
      await expect(
        auditLedger.recordTransaction(txId, dataHash, 0, timestamp, fromId, toId)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject empty transaction ID", async function () {
      await expect(
        auditLedger.recordTransaction("", dataHash, amount, timestamp, fromId, toId)
      ).to.be.revertedWith("Transaction ID required");
    });

    it("Should reject empty fromId", async function () {
      await expect(
        auditLedger.recordTransaction(txId, dataHash, amount, timestamp, "", toId)
      ).to.be.revertedWith("From ID required");
    });

    it("Should reject empty toId", async function () {
      await expect(
        auditLedger.recordTransaction(txId, dataHash, amount, timestamp, fromId, "")
      ).to.be.revertedWith("To ID required");
    });

    it("Should only allow owner to record transactions", async function () {
      await expect(
        auditLedger.connect(addr1).recordTransaction(txId, dataHash, amount, timestamp, fromId, toId)
      ).to.be.revertedWithCustomError(auditLedger, "OwnableUnauthorizedAccount");
    });
  });

  describe("Querying Transactions", function () {
    beforeEach(async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("tx data"));
      const timestamp = Math.floor(Date.now() / 1000);
      
      await auditLedger.recordTransaction("TXN_1", dataHash, 100000, timestamp, "user_1", "merchant_1");
      await auditLedger.recordTransaction("TXN_2", dataHash, 200000, timestamp, "user_2", "merchant_2");
      await auditLedger.recordTransaction("TXN_3", dataHash, 300000, timestamp, "user_3", "platform");
    });

    it("Should return correct total transactions", async function () {
      expect(await auditLedger.getTotalTransactions()).to.equal(3);
    });

    it("Should retrieve transaction by ID", async function () {
      const tx = await auditLedger.getTransaction("TXN_2");
      expect(tx.txIdOffchain).to.equal("TXN_2");
      expect(tx.amount).to.equal(200000);
      expect(tx.fromId).to.equal("user_2");
      expect(tx.toId).to.equal("merchant_2");
    });

    it("Should get transaction ID by index", async function () {
      expect(await auditLedger.getTransactionIdByIndex(0)).to.equal("TXN_1");
      expect(await auditLedger.getTransactionIdByIndex(1)).to.equal("TXN_2");
      expect(await auditLedger.getTransactionIdByIndex(2)).to.equal("TXN_3");
    });

    it("Should check transaction existence", async function () {
      expect(await auditLedger.transactionExists("TXN_1")).to.be.true;
      expect(await auditLedger.transactionExists("TXN_999")).to.be.false;
    });

    it("Should revert when getting non-existent transaction", async function () {
      await expect(
        auditLedger.getTransaction("TXN_999")
      ).to.be.revertedWith("Transaction not found");
    });

    it("Should revert when index is out of bounds", async function () {
      await expect(
        auditLedger.getTransactionIdByIndex(999)
      ).to.be.revertedWith("Index out of bounds");
    });
  });

  describe("Multiple Transaction Scenarios", function () {
    it("Should handle multiple transactions for the same user", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));
      const timestamp = Math.floor(Date.now() / 1000);
      
      await auditLedger.recordTransaction("TXN_A", dataHash, 50000, timestamp, "user_1", "merchant_1");
      await auditLedger.recordTransaction("TXN_B", dataHash, 75000, timestamp, "user_1", "merchant_2");
      await auditLedger.recordTransaction("TXN_C", dataHash, 30000, timestamp, "user_1", "platform");
      
      expect(await auditLedger.getTotalTransactions()).to.equal(3);
    });

    it("Should handle platform fee transactions", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("fee data"));
      const timestamp = Math.floor(Date.now() / 1000);
      
      // 3% platform fee transaction
      await auditLedger.recordTransaction("FEE_001", dataHash, 4500, timestamp, "user_xyz", "platform");
      
      const tx = await auditLedger.getTransaction("FEE_001");
      expect(tx.toId).to.equal("platform");
      expect(tx.amount).to.equal(4500);
    });
  });
});
