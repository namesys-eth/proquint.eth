// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

/**
 *  @notice ERC-721 safe transfer callback (EIP-721).
 */
interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

/**
 * @title IProquint
 * @notice Full interface for ProquintNFT: ERC-721 + commit-reveal registration + inbox + registry.
 * @dev Combines ERC-173 ownership, ERC-721 NFT, commit-reveal name registration,
 *      inbox-based transfer system, and registry lookups.
 *      Overloaded registry resolution (owner/recordExists by bytes32 vs bytes4)
 *      is in IRegistry.sol to avoid ABI ambiguity.
 */
interface IProquint {
    // ============ Errors ============
    error ZeroOwner();
    error ZeroTo();
    error TransferToZeroAddress();
    error UnsafeRecipient();
    error InvalidTokenId();
    error NotMinted();
    error HasPrimary();
    error NameTaken();
    error CommitmentExists();
    error CommitmentNotFound();
    error CommitmentTooNew();
    error CommitmentTooOld();
    error InsufficientFee();
    error Expired();
    error NotInPremiumPeriod();
    error Unauthorized();
    error NotOwner();
    error InvalidYears();
    error AlreadyInInbox();
    error NotInInbox();
    error NotReceiver();
    error InboxExpired();
    error InboxNotExpired();
    error InboxFull();
    error NotPrimary();

    // ============ Events ============
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Committed(bytes32 indexed commitment, address indexed committer);
    event Renewed(bytes4 indexed id, uint64 newExpiry);
    event PrimaryUpdated(address indexed user, bytes4 indexed id);
    event InboxUpdated(address indexed user, bytes4 indexed id, uint64 inboxExpiry);
    event TokenURIUpdated(address indexed oldGenerator, address indexed newGenerator);

    // ============ ERC173 ============
    function transferOwnership(address newOwner) external;

    // ============ ERC721 ============
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function balanceOf(address user) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address o, address op) external view returns (bool);
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    // ============ Commit-Reveal ============
    function makeCommitment(bytes32 input, address recipient) external pure returns (bytes32);
    function commit(bytes32 commitment) external;
    function register(bytes32 input) external payable returns (uint256 tokenId);
    function registerTo(bytes32 input, address to) external payable returns (uint256 tokenId);
    function registerPremium(bytes32 input) external payable returns (uint256 tokenId);
    function renew(bytes32 input) external payable;

    // ============ Inbox ============
    function inboxCount(address user) external view returns (uint8);
    function inboxExpiry(bytes4 id) external view returns (uint64);
    function totalInbox() external view returns (uint256);
    function acceptInbox(bytes4 id) external;
    function shelve(bytes4 id) external;
    function rejectInbox(bytes4 id) external;
    function cleanInbox(bytes4 id) external;

    // ============ Registry (non-overloaded) ============
    function isProquint(bytes32 node) external view returns (bool);
    function primaryName(address user) external view returns (bytes4);
    function commitments(bytes32) external view returns (uint256);
    function expiresAt(bytes4) external view returns (uint64);
    function getNode(bytes4 id) external pure returns (bytes32);
    function getExpiry(bytes4 id) external view returns (uint64);
    function isAvailable(bytes4 id) external view returns (bool);
    function inPremium(bytes4 id) external view returns (bool);
    function totalSupply() external view returns (uint256);

    // ============ Admin ============
    function withdraw() external;
    function setTokenURI(address newGenerator) external;
}
