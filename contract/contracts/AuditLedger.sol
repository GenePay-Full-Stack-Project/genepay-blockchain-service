// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuditLedger
 * @dev Immutable audit trail for BioPay payment transactions
 * Records transaction hashes for transparency without exposing sensitive data
 */
contract AuditLedger is Ownable {
    
    struct TransactionRecord {
        string txIdOffchain;      // Payment service transaction ID
        bytes32 dataHash;         // Keccak256 hash of transaction JSON
        uint256 amount;           // Transaction amount in smallest unit (cents)
        uint256 timestamp;        // Block timestamp
        string fromId;            // User/sender identifier
        string toId;              // Merchant/platform identifier
        bool exists;              // Flag to prevent duplicates
    }
    
    // Mapping from offchain transaction ID to on-chain record
    mapping(string => TransactionRecord) public transactions;
    
    // Array to keep track of all transaction IDs for enumeration
    string[] public transactionIds;
    
    // Events
    event TransactionRecorded(
        string indexed txIdOffchain,
        bytes32 dataHash,
        uint256 amount,
        uint256 timestamp,
        string fromId,
        string toId
    );
    
    event ContractDeployed(address deployer, uint256 timestamp);
    
    constructor() Ownable(msg.sender) {
        emit ContractDeployed(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Record a new transaction on the blockchain
     * @param _txIdOffchain Unique transaction ID from payment service
     * @param _dataHash Hash of the complete transaction data
     * @param _amount Transaction amount
     * @param _timestamp Transaction timestamp
     * @param _fromId Sender identifier (user ID)
     * @param _toId Recipient identifier (merchant or platform)
     */
    function recordTransaction(
        string memory _txIdOffchain,
        bytes32 _dataHash,
        uint256 _amount,
        uint256 _timestamp,
        string memory _fromId,
        string memory _toId
    ) public onlyOwner {
        require(!transactions[_txIdOffchain].exists, "Transaction already recorded");
        require(_amount > 0, "Amount must be greater than 0");
        require(_timestamp > 0, "Invalid timestamp");
        require(bytes(_txIdOffchain).length > 0, "Transaction ID required");
        require(bytes(_fromId).length > 0, "From ID required");
        require(bytes(_toId).length > 0, "To ID required");
        
        TransactionRecord memory record = TransactionRecord({
            txIdOffchain: _txIdOffchain,
            dataHash: _dataHash,
            amount: _amount,
            timestamp: _timestamp,
            fromId: _fromId,
            toId: _toId,
            exists: true
        });
        
        transactions[_txIdOffchain] = record;
        transactionIds.push(_txIdOffchain);
        
        emit TransactionRecorded(
            _txIdOffchain,
            _dataHash,
            _amount,
            _timestamp,
            _fromId,
            _toId
        );
    }
    
    /**
     * @dev Get transaction details by offchain ID
     * @param _txIdOffchain Transaction ID from payment service
     * @return Transaction record details
     */
    function getTransaction(string memory _txIdOffchain) 
        public 
        view 
        returns (TransactionRecord memory) 
    {
        require(transactions[_txIdOffchain].exists, "Transaction not found");
        return transactions[_txIdOffchain];
    }
    
    /**
     * @dev Check if a transaction has been recorded
     * @param _txIdOffchain Transaction ID to check
     * @return bool indicating if transaction exists
     */
    function transactionExists(string memory _txIdOffchain) 
        public 
        view 
        returns (bool) 
    {
        return transactions[_txIdOffchain].exists;
    }
    
    /**
     * @dev Get total number of recorded transactions
     * @return uint256 Total transaction count
     */
    function getTotalTransactions() public view returns (uint256) {
        return transactionIds.length;
    }
    
    /**
     * @dev Get transaction ID by index
     * @param _index Index in the transactionIds array
     * @return string Transaction ID
     */
    function getTransactionIdByIndex(uint256 _index) 
        public 
        view 
        returns (string memory) 
    {
        require(_index < transactionIds.length, "Index out of bounds");
        return transactionIds[_index];
    }
}
