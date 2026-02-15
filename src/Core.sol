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
    // ──────────── Lifecycle constants ────────────

    /**
     * @notice Base inbox pending period for the first transfer to an address.
     */
    uint256 internal constant BASE_PENDING_PERIOD = 42 days;
    /**
     * @notice Minimum inbox pending period (approached as inbox count → 255).
     */
    uint256 internal constant MIN_PENDING_PERIOD = 7 days;
    /**
     * @notice Grace period after expiry during which the owner can still renew.
     */
    uint64 internal constant GRACE_PERIOD = 300 days;
    /**
     * @notice Premium re-registration window that follows the grace period.
     */
    uint64 internal constant PREMIUM_PERIOD = 65 days;
    /**
     * @notice GRACE_PERIOD + PREMIUM_PERIOD — after this the name is fully available.
     */
    uint64 internal constant GRACE_PLUS_PREMIUM = 365 days;
    /**
     * @notice Expiry penalty applied on every transfer or deactivation (7 days).
     */
    uint64 internal constant TRANSFER_PENALTY = 7 days;
    /**
     * @notice Window after inbox expiry during which anyone can accept on behalf of the receiver.
     */
    uint64 internal constant ANYONE_PERIOD = 7 days;
    /**
     * @notice Maximum registration / renewal duration in years.
     */
    uint8 internal constant MAX_YEARS = 12;
    /**
     * @notice Cap on refund paid to old owner during re-registration.
     */
    uint256 internal constant MAX_REFUND = 5 ether;
    /**
     * @notice Minimum delay between commit and reveal (front-run protection).
     */
    uint256 internal constant MIN_COMMITMENT_AGE = 5 seconds;
    /**
     * @notice Maximum age of a commitment before it expires.
     */
    uint256 internal constant MAX_COMMITMENT_AGE = 15 minutes;
    /**
     * @notice One year in seconds — the base registration period.
     */
    uint256 internal constant REGISTRATION_PERIOD = 365 days;

    // ──────────── Pricing constants ────────────

    /**
     * @notice Fixed price per year of registration (0.00024 ETH).
     */
    uint256 internal constant PRICE_PER_YEAR = 0.00024 ether;
    /**
     * @notice Fixed price per month — used for refund calculation (0.00002 ETH).
     */
    uint256 internal constant PRICE_PER_MONTH = 0.00002 ether;
    /**
     * @notice Symmetric (palindrome) names cost 5× the base price.
     */
    uint256 internal constant PALINDROME_MULTIPLIER = 5;

    // ──────────── Inbox state ────────────

    /**
     * @dev Number of pending inbox items per address (max 255).
     */
    mapping(address => uint8) internal _inboxCount;
    /**
     * @dev Non-zero when a token is in inbox state; stores the inbox expiry timestamp.
     */
    mapping(bytes4 => uint64) internal _inboxExpiry;
    /**
     * @dev The user's active primary proquint ID (bytes4(0) if none).
     */
    mapping(address => bytes4) internal _primaryName;
    /**
     * @dev Global count of tokens currently in inbox state.
     */
    uint256 internal _totalInbox;

    // ──────────── Registry state ────────────

    /**
     * @notice Commit timestamp for each commitment hash (commit-reveal scheme).
     */
    mapping(bytes32 => uint256) public commitments;
    /**
     * @notice Expiry timestamp for each registered proquint ID.
     */
    mapping(bytes4 => uint64) public expiresAt;
    /**
     * @dev Reverse lookup: ENS-style namehash → proquint bytes4 ID.
     */
    mapping(bytes32 => bytes4) internal _nodeToId;

    // ──────────── ERC-721 state ────────────

    /**
     * @dev Total number of minted (non-burned) tokens.
     */
    uint256 internal _totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    mapping(bytes4 => address) internal _ownerOf;
    mapping(address => uint256) internal _balanceOf;
    mapping(bytes4 => address) internal _getApproved;
    mapping(address => mapping(address => bool)) internal _isApprovedForAll;

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

    // ──────────── Consolidated events ────────────
    /// @notice Emitted when a user's primary name changes. id=0 means primary cleared.
    event PrimaryUpdated(address indexed user, bytes4 indexed id);
    /// @notice Emitted when an inbox item changes state. inboxExpiry=0 means removed from inbox.
    event InboxUpdated(address indexed user, bytes4 indexed id, uint64 inboxExpiry);

    /**
     * @dev Calculate refund for a token based on remaining whole months until expiry.
     * @param ID Normalized proquint ID.
     * @return Refund in wei (PRICE_PER_MONTH × remaining months), or 0 if expired.
     */
    function _refundAmount(bytes4 ID) internal view returns (uint256) {
        uint64 exp = expiresAt[ID];
        if (block.timestamp >= exp) return 0;
        unchecked {
            uint256 remainingMonths = (exp - block.timestamp) / 30 days;
            if (remainingMonths == 0) return 0;
            return remainingMonths * PRICE_PER_MONTH;
        }
    }

    /**
     * @dev Burn a token: clear expiry, namehash mapping, ownership, approval, and
     *      decrement balance/supply. Emits Transfer(owner → address(0)).
     * @param ID Normalized proquint ID.
     * @return oldOwner The previous owner (address(0) if already burned).
     */
    function _burn(bytes4 ID) internal returns (address oldOwner) {
        oldOwner = _ownerOf[ID];
        delete expiresAt[ID];
        delete _nodeToId[LibProquint.namehash4(ID)];
        if (oldOwner != address(0)) {
            unchecked {
                --_balanceOf[oldOwner];
                --_totalSupply;
            }
        }
        delete _ownerOf[ID];
        delete _getApproved[ID];
        emit Transfer(oldOwner, address(0), uint256(uint32(ID)));
    }

    /**
     * @dev Inbox pending duration decreases linearly from BASE_PENDING_PERIOD (42 days)
     *      toward MIN_PENDING_PERIOD (7 days) as the recipient's inbox count grows.
     *      First inbox item (count=0) gets the full BASE_PENDING_PERIOD.
     * @param count Current inbox count for the recipient (before increment).
     * @return duration Pending duration in seconds.
     */
    function _inboxDuration(uint8 count) internal pure returns (uint256 duration) {
        if (count == 0) return BASE_PENDING_PERIOD;
        unchecked {
            uint256 range = BASE_PENDING_PERIOD - MIN_PENDING_PERIOD;
            duration = BASE_PENDING_PERIOD - (range * (count - 1)) / 255;
        }
    }

    /**
     * @notice Calculate registration price in wei.
     * @dev Exponential curve: (2^yrs − 1) × PRICE_PER_YEAR. Symmetric IDs cost 5×.
     * @param yrs Number of years (1–12).
     * @param isPalindrome True if the proquint ID is symmetric (e.g. `babab-babab`).
     * @return weiAmount Price in wei.
     */
    function priceWei(uint8 yrs, bool isPalindrome) internal pure returns (uint256 weiAmount) {
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        weiAmount = ((uint256(1) << yrs) - 1) * PRICE_PER_YEAR; // exponential : 2 ^ (yrs - 1) * PRICE_PER_YEAR
        if (isPalindrome) weiAmount *= PALINDROME_MULTIPLIER;
    }
}
