// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import {LibProquint} from "./LibProquint.sol";

/**
 * @title Core
 * @notice Shared constants, pricing logic, and storage layout for the Proquint Name System.
 * @dev Inherited by ProquintInbox → ProquintNFT. All token IDs are `bytes4` internally;
 *      ERC-721 uses `uint256(uint32(ID))` at the boundary.
 */
abstract contract Core {
    // ──────────── Anti-batching ────────────

    /**
     * @dev Prevents batched calls within the same transaction using transient storage.
     *      Sets tstore(0, 1) and does NOT clear it, so only one protected call per tx.
     *      WARNING: this breaks composability, but we use this for sybil aware/resistant system. 
     */
    modifier noBatching() {
        assembly("memory-safe") {
            if tload(0) { revert(0, 0) }
            tstore(0, 1)
        }
        _;
    }
    // ──────────── Lifecycle constants ────────────

    /// @notice Base inbox pending period for the first transfer to an address.
    uint256 internal constant BASE_PENDING_PERIOD = 42 days;
    /// @notice Minimum inbox pending period (approached as inbox count → 45).
    uint256 internal constant MIN_PENDING_PERIOD = 7 days;
    /// @notice Maximum inbox count per address.
    uint8 internal constant MAX_INBOX_COUNT = 45;
    /// @notice Grace period after expiry during which the owner can still renew.
    uint64 internal constant GRACE_PERIOD = 300 days;
    /// @notice Premium re-registration window that follows the grace period.
    uint64 internal constant PREMIUM_PERIOD = 65 days;
    /// @notice GRACE_PERIOD + PREMIUM_PERIOD — after this the name is fully available.
    uint64 internal constant GRACE_PLUS_PREMIUM = 365 days;
    /// @notice Expiry penalty applied on every transfer or deactivation (7 days).
    uint64 internal constant TRANSFER_PENALTY = 7 days;
    /// @notice Window after inbox expiry during which anyone can accept on behalf of the receiver.
    uint64 internal constant ANYONE_PERIOD = 7 days;
    /// @notice Maximum registration / renewal duration in years.
    uint8 internal constant MAX_YEARS = 12;
    /// @notice Inbox duration decay range (BASE_PENDING_PERIOD - MIN_PENDING_PERIOD).
    uint256 internal constant INBOX_DURATION_RANGE = BASE_PENDING_PERIOD - MIN_PENDING_PERIOD;
    /// @notice Cap on refund paid to old owner during re-registration.
    uint256 internal constant MAX_REFUND = 1 ether;
    uint256 internal constant MAX_REFUND_PREMIUM = 10 ether;
    uint256 internal constant PREMIUM_START = 65 ether;
    /// @notice Minimum delay between commit and reveal (front-run protection).
    uint256 internal constant MIN_COMMITMENT_AGE = 25 seconds;
    /// @notice Maximum age before commitment expires (anti-DoS).
    uint256 internal constant MAX_COMMITMENT_AGE = 25 minutes;
    /// @notice One year in seconds — the base registration period.
    uint256 internal constant REGISTRATION_PERIOD = 365 days;
    /// @notice Month duration for refund calculations (365 days / 12).
    uint256 internal constant MONTH_DURATION = REGISTRATION_PERIOD / 12;

    // ──────────── Pricing constants ────────────

    /// @notice Fixed price per year of registration (0.00036 ETH).
    uint256 internal constant PRICE_PER_YEAR = 0.00036 ether;
    /// @notice Fixed price per month — used for refund calculation (0.00003 ETH).
    uint256 internal constant PRICE_PER_MONTH = 0.00003 ether;
    /// @notice TWIN (twin) names cost 5× the base price.
    uint256 internal constant TWIN_MULTIPLIER = 5;

    // ──────────── Inbox state ────────────

    /// @dev Number of pending inbox items per address (max 45).
    mapping(address _addr => uint8 _count) internal _inboxCount;
    /// @dev Non-zero when a token is in inbox state; stores the inbox expiry timestamp.
    mapping(bytes4 _id => uint64 _expiry) internal _inboxExpiry;
    /// @dev The user's active primary proquint ID (bytes4(0) if none).
    mapping(address _addr => bytes4 _id) internal _primary;
    /// @dev Global count of tokens currently in inbox state.
    uint256 internal _totalInbox;

    // ──────────── Registry state ────────────

    /// @dev Commit timestamp for each commitment hash (commit-reveal scheme).
    mapping(bytes32 _commitment => uint256 _timestamp) public commitments;
    /// @dev Expiry timestamp for each registered proquint ID.
    mapping(bytes4 _id => uint64 _expiry) public expiry;
    /// @dev Reverse lookup: ENS-style namehash → proquint bytes4 ID.
    mapping(bytes32 _node => bytes4 _id) internal _nodeToId;

    // ──────────── ERC-721 state ────────────

    /// @dev Total number of minted (non-burned) tokens.
    uint256 internal _totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    mapping(bytes4 _id => address _owner) internal _ownerOf;
    mapping(bytes4 _id => address _approved) internal _approved;
    mapping(address _owner => mapping(address _operator => bool _approved)) internal _approvedForAll;

    // ──────────── Shared errors ────────────
    error InvalidYears();
    error Expired();
    error NotOwner();
    error Unauthorized();
    error NotPrimary();
    error NotInInbox();
    error NotReceiver();
    error InboxExpired();
    error InboxFull();
    error AlreadyInInbox();
    error HasPrimary();
    error InboxNotExpired();
    error CommitmentTooNew();
    error CommitmentTooOld();

    // ──────────── Consolidated events ────────────
    /// @notice Emitted when a user's primary name changes. id=0 means primary cleared.
    event PrimaryUpdated(address indexed user, bytes4 indexed id);
    /// @notice Emitted when an inbox item changes state. inboxExpiry=0 means removed from inbox.
    event InboxUpdated(address indexed user, bytes4 indexed id, uint64 indexed inboxExpiry);

    /**
     * @dev Burn a token, clearing all state and emitting Transfer to zero.
     *      Handles both inbox and primary states before burning.
     *      Caller MUST ensure token exists.
     * @param ID Normalized proquint ID.
     */
    function _burn(bytes4 ID) internal {
        address oldOwner = _ownerOf[ID];
        
        // Clear whichever state the token is in: inbox or primary
        if (_inboxExpiry[ID] > 0) {
            delete _inboxExpiry[ID];
            unchecked {
                --_inboxCount[oldOwner];
                --_totalInbox;
            }
            emit InboxUpdated(oldOwner, ID, 0);
        } else {
            delete _primary[oldOwner];
        }
        
        delete expiry[ID];
        unchecked {
            --_totalSupply;
        }
        delete _ownerOf[ID];
        delete _approved[ID];
        emit Transfer(oldOwner, address(0), uint256(uint32(ID)));
    }

    /**
     * @dev Check commitment validity (age bounds).
     * @param _idSecret Packed `bytes4(ID) ++ bytes27(secret)` (31 bytes).
     * @param recipient The address bound to this commitment.
     */
    function _checkCommitment(bytes31 _idSecret, address recipient) internal {
        bytes32 commitment = keccak256(abi.encodePacked(_idSecret, recipient));
        uint256 committedAt = commitments[commitment];
        require(block.timestamp >= committedAt + MIN_COMMITMENT_AGE, CommitmentTooNew());
        require(block.timestamp <= committedAt + MAX_COMMITMENT_AGE, CommitmentTooOld());
        delete commitments[commitment];
    }

    /**
     * @dev Mint a new token as the caller's primary name.
     * @param ID Normalized proquint ID.
     * @param to Owner address.
     * @param yrs Registration years.
     */
    function _mintPrimary(bytes4 ID, address to, uint8 yrs) internal {
        expiry[ID] = uint64(block.timestamp + uint256(yrs) * REGISTRATION_PERIOD);
        _nodeToId[LibProquint.namehash4(ID)] = ID;
        _ownerOf[ID] = to;
        _primary[to] = ID;
        unchecked {
            ++_totalSupply;
        }
        emit Transfer(address(0), to, uint256(uint32(ID)));
        emit PrimaryUpdated(to, ID);
    }

    /**
     * @dev Mint a new token directly into recipient's inbox.
     * @param ID Normalized proquint ID.
     * @param to Recipient address.
     * @param yrs Registration years.
     */
    function _mintInbox(bytes4 ID, address to, uint8 yrs) internal {
        expiry[ID] = uint64(block.timestamp + uint256(yrs) * REGISTRATION_PERIOD);
        _nodeToId[LibProquint.namehash4(ID)] = ID;
        _ownerOf[ID] = to;
        uint8 count;
        unchecked {
            ++_totalSupply;
            count = ++_inboxCount[to];
            ++_totalInbox;
        }
        uint64 ie;
        if (count == 1) {
            ie = uint64(block.timestamp + BASE_PENDING_PERIOD);
        } else {
            unchecked {
                ie = uint64(block.timestamp + BASE_PENDING_PERIOD - (INBOX_DURATION_RANGE * (count - 1)) / (MAX_INBOX_COUNT - 1));
            }
        }
        _inboxExpiry[ID] = ie;
        emit Transfer(address(0), to, uint256(uint32(ID)));
        emit InboxUpdated(to, ID, ie);
    }


    /**
     * @notice Calculate registration price in wei.
     * @dev Exponential curve: (2^yrs − 1) × PRICE_PER_YEAR. TWIN IDs cost 5×.
     * @param yrs Number of years (1–12).
     * @param isTwin True if the proquint ID is TWIN (e.g. `babab-babab`).
     * @return weiAmount Price in wei.
     */
    function priceWei(uint8 yrs, bool isTwin) internal pure returns (uint256 weiAmount) {
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        unchecked {
            weiAmount = ((uint256(1) << yrs) - 1) * PRICE_PER_YEAR;
            if (isTwin) weiAmount *= TWIN_MULTIPLIER;
        }
    }

    /**
     * @notice Calculate renewal price in wei (anti-hoarding).
     * @dev Formula: fee = ((2^total - 2^floored) * PRICE_PER_YEAR) * twinMultiplier
     *      floored = floor(remaining / 365 days) — gives ~1yr window to renew without overpaying
     *      total = floored + yrs, must be <= MAX_YEARS (12)
     *      Serial 1yr renewals cost same as bulk registration.
     * @param yrs Number of years to extend (1–12).
     * @param remaining Remaining time in seconds before expiry.
     * @param isTwin True if the proquint ID is TWIN.
     * @return weiAmount Renewal price in wei.
     */
    function renewPriceWei(uint8 yrs, uint256 remaining, bool isTwin) internal pure returns (uint256 weiAmount) {
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        unchecked {
            uint8 floored = uint8(remaining / REGISTRATION_PERIOD);
            uint8 total = floored + yrs;
            require(total <= MAX_YEARS, InvalidYears());
            weiAmount = ((uint256(1) << total) - (uint256(1) << floored)) * PRICE_PER_YEAR;
            if (isTwin) weiAmount *= TWIN_MULTIPLIER;
        }
    }
}
