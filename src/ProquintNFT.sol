// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {LibProquint} from "./LibProquint.sol";
import {ProquintInbox} from "./Inbox.sol";
import {TokenURI} from "./TokenURI.sol";
import {IProquint, IERC721Receiver} from "./IProquint.sol";
import {IRegistry} from "./IRegistry.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/**
 * @title ProquintNFT
 * @notice Standalone proquint name registration: ERC-721 + registry + inbox in one contract.
 * @dev Token ID = `uint256(uint32(bytes4 ID))`. Internally all mappings use `bytes4`.
 *      Inheritance: Core → ProquintInbox → ProquintNFT.
 *
 *      Registration flow:
 *      1. `commit(hash)` — submit commitment hash (front-run protection).
 *      2. `register(input)` — reveal & register as primary (self).
 *         `registerTo(input, to)` — reveal & register into recipient's inbox.
 *         `registerPremium(input)` — register during premium period with decaying surcharge.
 *      3. Inbox items must be accepted via `acceptInbox` to become primary.
 *      4. `shelve` moves primary back to inbox (with penalty).
 *      5. `renew(input)` — extend expiry (up to MAX_YEARS from now).
 */
contract ProquintNFT is ProquintInbox, ReentrancyGuard {
    error ZeroOwner();
    error ZeroTo();
    error TransferToZeroAddress();
    error UnsafeRecipient();
    error InvalidTokenId();
    error NotMinted();
    error NameTaken();
    error CommitmentExists();
    error CommitmentNotFound();
    error CommitmentTooNew();
    error CommitmentTooOld();
    error InsufficientFee();
    error NotInPremiumPeriod();
    event Committed(bytes32 indexed commitment, address indexed committer);
    event Renewed(bytes4 indexed id, uint64 newExpiry);

    // ============ ERC-173 Ownership ============

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    address internal _owner;
    modifier onlyOwner() {
        require(msg.sender == _owner, NotOwner());
        _;
    }

    /**
     * @notice Contract owner (ERC-173).
     *  @return Owner address.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @notice Transfer contract ownership.
     *  @param newOwner New owner (non-zero).
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), ZeroOwner());
        address prev = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    // ============ Minimal ERC-721 ============

    /**
     * @notice On-chain SVG token URI generator (upgradable by owner).
     */
    TokenURI public tokenURIGenerator;

    event TokenURIUpdated(address indexed oldGenerator, address indexed newGenerator);

    /**
     * @param owner_ Initial contract owner.
     */
    constructor(address owner_) {
        _owner = owner_;
        emit OwnershipTransferred(address(0), _owner);
        tokenURIGenerator = new TokenURI();
    }

    /**
     * @notice Update the token URI generator contract.
     * @param newGenerator Address of the new TokenURI contract.
     */
    function setTokenURI(address newGenerator) external onlyOwner {
        require(newGenerator != address(0), ZeroOwner());
        address old = address(tokenURIGenerator);
        tokenURIGenerator = TokenURI(newGenerator);
        emit TokenURIUpdated(old, newGenerator);
    }

    /**
     * @notice ERC-721 collection name.
     *  @return "Proquint Name System".
     */
    function name() public pure returns (string memory) {
        return "Proquint Name System";
    }

    /**
     * @notice ERC-721 collection symbol.
     *  @return "PROQUINT".
     */
    function symbol() public pure returns (string memory) {
        return "PROQUINT";
    }

    /**
     * @notice On-chain metadata URI.
     *  @param tokenId ERC-721 token ID.
     *  @return data URI with JSON metadata + base64 SVG.
     */
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        bytes4 ID = bytes4(uint32(tokenId));
        require(_ownerOf[ID] != address(0), NotMinted());
        return tokenURIGenerator.tokenURI(tokenId);
    }

    /**
     * @param a Address to query.
     *  @return Token count.
     */
    function balanceOf(address a) external view returns (uint256) {
        return _balanceOf[a];
    }

    /**
     * @param tokenId ERC-721 token ID.
     *  @return Owner address.
     */
    function ownerOf(uint256 tokenId) public view returns (address) {
        bytes4 ID = bytes4(uint32(tokenId));
        address o = _ownerOf[ID];
        require(o != address(0), NotMinted());
        return o;
    }

    /**
     * @param tokenId ERC-721 token ID.
     *  @return Approved spender.
     */
    function getApproved(uint256 tokenId) external view returns (address) {
        bytes4 ID = bytes4(uint32(tokenId));
        require(_ownerOf[ID] != address(0), NotMinted());
        return _getApproved[ID];
    }

    /**
     * @param a Owner.
     *  @param op Operator.
     *  @return True if approved for all.
     */
    function isApprovedForAll(address a, address op) public view returns (bool) {
        return _isApprovedForAll[a][op];
    }

    /**
     * @param to Approved spender.
     *  @param tokenId ERC-721 token ID.
     */
    function approve(address to, uint256 tokenId) external {
        bytes4 ID = bytes4(uint32(tokenId));
        address o = _ownerOf[ID];
        require(msg.sender == o || _isApprovedForAll[o][msg.sender], Unauthorized());
        _getApproved[ID] = to;
        emit Approval(o, to, uint256(uint32(ID)));
    }

    /**
     * @param operator Operator address.
     *  @param approved True to approve.
     */
    function setApprovalForAll(address operator, bool approved) external {
        _isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /**
     * @notice Transfer a proquint NFT. Always lands in recipient's inbox with a
     *         TRANSFER_PENALTY applied to expiry. Clears sender's primary.
     * @param from Current owner.
     * @param to Recipient (enters inbox).
     * @param tokenId ERC-721 token ID (`uint256(uint32(bytes4 ID))`).
     */
    function transferFrom(address from, address to, uint256 tokenId) public nonReentrant {
        require(to != address(0), TransferToZeroAddress());
        bytes4 ID = bytes4(uint32(tokenId));
        address o = _ownerOf[ID];
        require(o == from, NotMinted());
        require(msg.sender == from || msg.sender == _getApproved[ID] || _isApprovedForAll[from][msg.sender], Unauthorized());

        require(expiresAt[ID] > block.timestamp, Expired());
        require(_inboxExpiry[ID] == 0, AlreadyInInbox());
        require(_inboxCount[to] < type(uint8).max, InboxFull());

        _toInbox(ID, from, to);
        unchecked {
            --_balanceOf[from];
            ++_balanceOf[to];
        }
        _ownerOf[ID] = to;
        delete _getApproved[ID];
        emit Transfer(from, to, uint256(uint32(ID)));
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length != 0) {
            bytes4 ret = IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data);
            require(ret == IERC721Receiver.onERC721Received.selector, UnsafeRecipient());
        }
    }

    /**
     * @notice ERC-165 interface check.
     *  @param interfaceId Interface selector.
     *  @return True for ERC-721, ERC-721Metadata, ERC-165.
     */
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x80ac58cd // ERC-721
            || interfaceId == 0x5b5e139f // ERC-721Metadata
            || interfaceId == 0x7f5828d0; // ERC-173
    }

    // ============ Commit-Reveal ============

    /**
     * @notice Build a commitment hash for the commit-reveal scheme.
     * @dev `input` layout: `bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)`.
     *      The ID is auto-normalized before hashing.
     * @param input Packed registration input.
     * @param recipient Address that will own the name (used in hash to bind commitment).
     * @return Commitment hash: `keccak256(abi.encodePacked(ID, secret, recipient))`.
     */
    function makeCommitment(bytes32 input, address recipient) public pure returns (bytes32) {
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        bytes27 secret = bytes27(input << 40);
        return keccak256(abi.encodePacked(ID, secret, recipient));
    }

    /**
     * @notice Submit a commitment hash. Must wait MIN_COMMITMENT_AGE before revealing.
     * @dev Reverts if the same commitment is still active (not yet expired).
     * @param commitment Hash from `makeCommitment`.
     */
    function commit(bytes32 commitment) external {
        require(
            commitments[commitment] == 0 || block.timestamp > commitments[commitment] + MAX_COMMITMENT_AGE,
            CommitmentExists()
        );
        commitments[commitment] = block.timestamp;
        emit Committed(commitment, msg.sender);
    }

    /**
     * @dev Verify commit-reveal timing window and consume the commitment.
     *      Reverts if commitment not found, too new, or too old.
     * @param _idSecret Packed `bytes4(ID) ++ bytes27(secret)` (31 bytes).
     * @param recipient The address bound to this commitment.
     */
    function _checkCommitment(bytes31 _idSecret, address recipient) internal {
        bytes32 commitment = keccak256(abi.encodePacked(_idSecret, recipient));
        uint256 committedAt = commitments[commitment];
        require(committedAt != 0, CommitmentNotFound());
        require(block.timestamp >= committedAt + MIN_COMMITMENT_AGE, CommitmentTooNew());
        require(committedAt + MAX_COMMITMENT_AGE >= block.timestamp, CommitmentTooOld());
        delete commitments[commitment];
    }

    /**
     * @dev Clear and burn an existing token during re-registration.
     *      Handles both inbox and primary states before burning.
     * @param ID Normalized proquint ID.
     * @return oldOwner Previous owner (address(0) if token didn't exist).
     */
    function _clearOldToken(bytes4 ID) internal returns (address oldOwner) {
        oldOwner = _ownerOf[ID];
        if (oldOwner == address(0)) return oldOwner;
        // Clear whichever state the token is in: inbox or primary
        if (_inboxExpiry[ID] != 0) {
            delete _inboxExpiry[ID];
            unchecked {
                --_inboxCount[oldOwner];
                --_totalInbox;
            }
        } else {
            delete _primaryName[oldOwner];
        }
        _burn(ID);
    }

    /**
     * @dev Mint a new token as the caller's primary name.
     * @param ID Normalized proquint ID.
     * @param to Owner address.
     * @param yrs Registration years.
     * @return tokenId ERC-721 token ID.
     */
    function _mintPrimary(bytes4 ID, address to, uint8 yrs) internal returns (uint256 tokenId) {
        expiresAt[ID] = uint64(block.timestamp + uint256(yrs) * REGISTRATION_PERIOD);
        _nodeToId[LibProquint.namehash4(ID)] = ID;
        _ownerOf[ID] = to;
        _primaryName[to] = ID;
        unchecked {
            ++_balanceOf[to];
            ++_totalSupply;
        }
        tokenId = uint256(uint32(ID));
        emit Transfer(address(0), to, tokenId);
        emit PrimaryUpdated(to, ID);
    }

    /**
     * @dev Move a token into recipient's inbox with TRANSFER_PENALTY.
     * @param ID Normalized proquint ID.
     * @param from Current owner (primary cleared).
     * @param to Recipient.
     */
    function _toInbox(bytes4 ID, address from, address to) internal {
        delete _primaryName[from];
        unchecked {
            expiresAt[ID] -= TRANSFER_PENALTY;
        }
        uint64 ie = uint64(block.timestamp + _inboxDuration(_inboxCount[to]));
        _inboxExpiry[ID] = ie;
        unchecked {
            ++_inboxCount[to];
            ++_totalInbox;
        }
        emit PrimaryUpdated(from, bytes4(0));
        emit InboxUpdated(to, ID, ie);
    }

    /**
     * @notice Register a proquint as the caller's primary name.
     * @dev Requires the caller to have no existing primary. The name must be fully
     *      available (past GRACE_PLUS_PREMIUM). Old token is cleared and old owner
     *      receives a capped refund.
     * @param input Packed: `bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)`.
     * @return tokenId ERC-721 token ID.
     */
    function register(bytes32 input) external payable nonReentrant returns (uint256 tokenId) {
        uint8 yrs = uint8(bytes1(input[0]));
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        _checkCommitment(bytes31(input << 8), msg.sender);
        require(_primaryName[msg.sender] == bytes4(0), HasPrimary());
        require(block.timestamp > expiresAt[ID] + GRACE_PLUS_PREMIUM, NameTaken());

        uint256 fee = priceWei(yrs, LibProquint.isSymmetric(ID));
        require(msg.value >= fee, InsufficientFee());

        address oldOwner = _clearOldToken(ID);
        uint256 oldRefund;
        if (oldOwner != address(0)) {
            oldRefund = fee > MAX_REFUND ? MAX_REFUND : fee;
        }

        tokenId = _mintPrimary(ID, msg.sender, yrs);

        if (oldRefund > 0) SafeTransferLib.safeTransferETH(oldOwner, oldRefund);
        if (msg.value > fee) SafeTransferLib.safeTransferETH(msg.sender, msg.value - fee);
    }

    /**
     * @notice Register a proquint into another address's inbox.
     * @dev Commitment is bound to `to`, so only the intended recipient can be targeted.
     *      The token enters inbox state with a duration based on the recipient's inbox count.
     *      Old owner receives a capped refund (half the fee).
     * @param input Packed: `bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)`.
     * @param to Recipient address (token goes to their inbox).
     * @return tokenId ERC-721 token ID.
     */
    function registerTo(bytes32 input, address to) external payable nonReentrant returns (uint256 tokenId) {
        require(to != address(0), ZeroTo());
        require(_inboxCount[to] != type(uint8).max, InboxFull());
        uint8 yrs = uint8(bytes1(input[0]));
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        _checkCommitment(bytes31(input << 8), to);
        require(block.timestamp > expiresAt[ID] + GRACE_PLUS_PREMIUM, NameTaken());

        uint256 fee = priceWei(yrs, LibProquint.isSymmetric(ID));
        require(msg.value >= fee, InsufficientFee());

        address oldOwner = _clearOldToken(ID);
        uint256 oldRefund;
        if (oldOwner != address(0)) {
            uint256 half = fee / 2;
            oldRefund = half > MAX_REFUND ? MAX_REFUND : half;
        }

        expiresAt[ID] = uint64(block.timestamp + uint256(yrs) * REGISTRATION_PERIOD);
        _nodeToId[LibProquint.namehash4(ID)] = ID;
        _ownerOf[ID] = to;

        // Compute inbox duration BEFORE incrementing count
        uint64 ie = uint64(block.timestamp + _inboxDuration(_inboxCount[to]));
        _inboxExpiry[ID] = ie;
        unchecked {
            ++_balanceOf[to];
            ++_totalSupply;
            ++_inboxCount[to];
            ++_totalInbox;
        }

        tokenId = uint256(uint32(ID));
        emit Transfer(address(0), to, tokenId);
        emit InboxUpdated(to, ID, ie);

        if (oldRefund > 0) SafeTransferLib.safeTransferETH(oldOwner, oldRefund);
        if (msg.value > fee) SafeTransferLib.safeTransferETH(msg.sender, msg.value - fee);
    }

    /**
     * @notice Register a name during the premium period (after grace, before full availability).
     * @dev A linearly decaying premium surcharge is added on top of the base fee.
     *      50% of the total cost goes to the old owner. Caller must have no primary.
     * @param input Packed: `bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)`.
     * @return tokenId ERC-721 token ID.
     */
    function registerPremium(bytes32 input) external payable nonReentrant returns (uint256 tokenId) {
        uint8 yrs = uint8(bytes1(input[0]));
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        _checkCommitment(bytes31(input << 8), msg.sender);
        require(_primaryName[msg.sender] == bytes4(0), HasPrimary());

        uint64 oldExpiry = expiresAt[ID];
        uint256 premiumStart = uint256(oldExpiry) + GRACE_PERIOD;
        require(
            block.timestamp >= premiumStart && block.timestamp < premiumStart + PREMIUM_PERIOD, NotInPremiumPeriod()
        );

        uint256 fee = priceWei(yrs, LibProquint.isSymmetric(ID));
        uint256 premium;
        unchecked {
            premium = (fee * (PREMIUM_PERIOD - (block.timestamp - premiumStart))) / PREMIUM_PERIOD;
        }
        uint256 total = fee + premium;
        require(msg.value >= total, InsufficientFee());

        address oldOwner = _clearOldToken(ID);
        uint256 premiumShare;
        if (oldOwner != address(0) && total > 0) {
            premiumShare = total / 2;
        }

        tokenId = _mintPrimary(ID, msg.sender, yrs);

        if (premiumShare > 0) SafeTransferLib.safeTransferETH(oldOwner, premiumShare);
        if (msg.value > total) SafeTransferLib.safeTransferETH(msg.sender, msg.value - total);
    }

    /**
     * @notice Extend a proquint's expiry. Callable by anyone (gift renewals allowed).
     * @dev The name must not have fully expired (within grace period). New expiry
     *      cannot exceed MAX_YEARS from now.
     * @param input Packed: `bytes1(yrs) ++ bytes4(id)` (remaining bytes ignored).
     */
    function renew(bytes32 input) external payable nonReentrant {
        uint8 yrs = uint8(bytes1(input[0]));
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        uint64 current = expiresAt[ID];
        require(current != 0, NotMinted());
        require(current + GRACE_PERIOD >= block.timestamp, Expired());

        uint64 newExpiry = current + uint64(uint256(yrs) * REGISTRATION_PERIOD);
        require(newExpiry <= uint64(block.timestamp + MAX_YEARS * REGISTRATION_PERIOD), InvalidYears());

        uint256 fee = priceWei(yrs, LibProquint.isSymmetric(ID));
        require(msg.value >= fee, InsufficientFee());

        expiresAt[ID] = newExpiry;
        emit Renewed(ID, newExpiry);
        if (msg.value > fee) SafeTransferLib.safeTransferETH(msg.sender, msg.value - fee);
    }

    // ============ Registry helpers ============

    /**
     * @notice Resolve namehash to owner.
     *  @param node ENS-style namehash.
     *  @return Owner or address(0) if expired past grace.
     */
    function owner(bytes32 node) external view returns (address) {
        bytes4 id = _nodeToId[node];
        if (id == bytes4(0)) return address(0);
        if (block.timestamp > expiresAt[id] + GRACE_PERIOD) return address(0);
        return _ownerOf[id];
    }

    /**
     * @notice Check if record exists (by namehash).
     *  @param node ENS-style namehash.
     *  @return True if within grace period.
     */
    function recordExists(bytes32 node) external view returns (bool) {
        bytes4 id = _nodeToId[node];
        if (id == bytes4(0)) return false;
        return expiresAt[id] + GRACE_PERIOD >= block.timestamp && _ownerOf[id] != address(0);
    }

    /**
     * @notice Check if record exists (by raw ID).
     *  @param id Raw proquint ID.
     *  @return True if within grace period.
     */
    function recordExists(bytes4 id) external view returns (bool) {
        bytes4 ID = LibProquint.normalize(id);
        return expiresAt[ID] + GRACE_PERIOD >= block.timestamp && _ownerOf[ID] != address(0);
    }

    /**
     * @notice Resolve raw ID to owner.
     *  @param id Raw proquint ID.
     *  @return Owner or address(0) if expired past grace.
     */
    function owner(bytes4 id) external view returns (address) {
        bytes4 ID = LibProquint.normalize(id);
        if (block.timestamp > expiresAt[ID] + GRACE_PERIOD) return address(0);
        return _ownerOf[ID];
    }

    /**
     * @notice Check if namehash was ever registered.
     *  @param node ENS-style namehash.
     *  @return True if registered (even if expired).
     */
    function isProquint(bytes32 node) external view returns (bool) {
        return _nodeToId[node] != bytes4(0);
    }

    /**
     * @notice Compute namehash for a proquint ID.
     *  @param id Raw proquint ID.
     *  @return ENS-style namehash.
     */
    function getNode(bytes4 id) external pure returns (bytes32) {
        return LibProquint.namehash4(id);
    }

    /**
     * @notice Get expiry timestamp.
     *  @param id Raw proquint ID.
     *  @return Expiry unix timestamp.
     */
    function getExpiry(bytes4 id) external view returns (uint64) {
        return expiresAt[LibProquint.normalize(id)];
    }

    /**
     * @notice Check if name is fully available.
     *  @param id Raw proquint ID.
     *  @return True if past grace + premium.
     */
    function isAvailable(bytes4 id) external view returns (bool) {
        return block.timestamp > expiresAt[LibProquint.normalize(id)] + GRACE_PLUS_PREMIUM;
    }

    /**
     * @notice Check if name is in premium window.
     *  @param id Raw proquint ID.
     *  @return True if in premium re-registration period.
     */
    function inPremium(bytes4 id) external view returns (bool) {
        uint64 exp = expiresAt[LibProquint.normalize(id)];
        if (exp == 0) return false;
        unchecked {
            uint256 premiumStart = uint256(exp) + GRACE_PERIOD;
            return block.timestamp >= premiumStart && block.timestamp < premiumStart + PREMIUM_PERIOD;
        }
    }

    /**
     * @notice Active primary proquint ID for a user.
     *  @param user Address to query.
     *  @return Proquint bytes4 ID, or bytes4(0) if none.
     */
    function primaryName(address user) external view returns (bytes4) {
        return _primaryName[user];
    }

    /**
     * @notice Total minted (non-burned) tokens.
     *  @return Token count.
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Withdraw all contract ETH to the owner.
     */
    function withdraw() external onlyOwner {
        SafeTransferLib.safeTransferETH(msg.sender, address(this).balance);
    }
}
