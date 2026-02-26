// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {LibProquint} from "./LibProquint.sol";
import {ProquintInbox} from "./Inbox.sol";
import {TokenURI} from "./TokenURI.sol";
import {IProquint, IERC721Receiver} from "./IProquint.sol";
import {IRegistry} from "./IRegistry.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/**
 * @title Proquint
 * @notice Standalone proquint name registration: ERC-721 + registry + inbox in one contract.
 * @dev Token ID = `uint256(uint32(bytes4 ID))`. Internally all mappings use `bytes4`.
 *      Inheritance: Core → ProquintInbox → Proquint.
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
contract Proquint is ProquintInbox {
    error ZeroOwner();
    error ZeroTo();
    error TransferToZeroAddress();
    error UnsafeRecipient();
    error InvalidTokenId();
    error NotMinted();
    error NameTaken();
    error CommitmentExists();
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
    constructor(address owner_) payable {
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
        address o = _ownerOf[ID];
        require(o != address(0), NotMinted());
        return tokenURIGenerator.tokenURI(tokenId, o);
    }

    /**
     * @param a Address to query.
     * @return Token count (inbox count + 1 if has primary, else inbox count).
     */
    function balanceOf(address a) external view returns (uint256) {
        return _inboxCount[a] + (_primary[a] != bytes4(0) ? 1 : 0);
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
        return _approved[ID];
    }

    /**
     * @param a Owner.
     *  @param op Operator.
     *  @return True if approved for all.
     */
    function isApprovedForAll(address a, address op) public view returns (bool) {
        return _approvedForAll[a][op];
    }

    /**
     * @param to Approved spender.
     *  @param tokenId ERC-721 token ID.
     */
    function approve(address to, uint256 tokenId) external {
        bytes4 ID = bytes4(uint32(tokenId));
        address o = _ownerOf[ID];
        require(msg.sender == o || _approvedForAll[o][msg.sender], Unauthorized());
        _approved[ID] = to;
        emit Approval(o, to, uint256(uint32(ID)));
    }

    /**
     * @param operator Operator address.
     *  @param approved True to approve.
     */
    function setApprovalForAll(address operator, bool approved) external {
        _approvedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /**
     * @dev Internal transfer function with all validation checks.
     * @param from Current owner.
     * @param to Recipient.
     * @param ID Normalized proquint ID.
     */
    function _transfer(address from, address to, bytes4 ID) internal {
        require(to != address(0), TransferToZeroAddress());
        address owner = _ownerOf[ID];
        require(owner == from, NotOwner());
        require(
            msg.sender == from || msg.sender == _approved[ID] || _approvedForAll[from][msg.sender], Unauthorized()
        );
        require(expiry[ID] > block.timestamp, Expired());
        require(_inboxCount[to] < MAX_INBOX_COUNT, InboxFull());

        // Clear sender's state: either primary or inbox
        if (_inboxExpiry[ID] > 0) {
            // ID is in inbox state — decrement sender's inbox count
            unchecked {
                --_inboxCount[from];
                // _totalInbox stays same (moving between inboxes)
            }
        } else {
            // Sender has this as primary — clear it and increment total inbox
            delete _primary[from];
            unchecked {
                ++_totalInbox;
            }
            emit PrimaryUpdated(from, bytes4(0));
        }

        // Apply transfer penalty
        unchecked {
            expiry[ID] -= TRANSFER_PENALTY;
        }

        // Set new inbox state for recipient
        uint8 count;
        unchecked {
            count = ++_inboxCount[to];
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
        emit InboxUpdated(to, ID, ie);

        _ownerOf[ID] = to;
        delete _approved[ID];
        emit Transfer(from, to, uint256(uint32(ID)));
    }

    /**
     * @notice Transfer a proquint to another address. Moves it to the recipient's inbox.
     * @dev Applies TRANSFER_PENALTY (7 days) to expiry. Sender must be owner or approved.
     *      Name must not be expired. Recipient's inbox must not be full.
     * @param from Current owner.
     * @param to Recipient.
     * @param tokenId ERC-721 token ID (`uint256(uint32(bytes4 ID))`).
     */
    function transferFrom(address from, address to, uint256 tokenId) public noBatching {
        bytes4 ID = LibProquint.normalize(bytes4(uint32(tokenId)));
        _transfer(from, to, ID);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public noBatching {
        bytes4 ID = LibProquint.normalize(bytes4(uint32(tokenId)));
        _transfer(from, to, ID);
        if (to.code.length != 0) {
            bytes4 ret = IERC721Receiver(to).onERC721Received(msg.sender, from, uint256(uint32(ID)), data);
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
     * 
     * @param id Proquint ID.
     * @param secret Random secret.
     * @param recipient Address that will own the name (used in hash to bind commitment).
     * @return Commitment hash: `keccak256(abi.encodePacked(ID, secret, recipient))`.
     */
    function makeCommitment(bytes4 id, bytes27 secret, address recipient) public pure returns (bytes32) {
        bytes4 ID = LibProquint.normalize(id);
        return keccak256(abi.encodePacked(ID, secret, recipient));
    }

    /**
     * @notice Submit a commitment hash. Must wait MIN_COMMITMENT_AGE before revealing.
     * @dev Reverts if the same commitment is still active (not yet expired).
     * @param commitment Hash from `makeCommitment`.
     */
    function commit(bytes32 commitment) external {
        require(block.timestamp > commitments[commitment] + MAX_COMMITMENT_AGE, CommitmentExists());
        commitments[commitment] = block.timestamp;
        emit Committed(commitment, msg.sender);
    }

    /**
     * @notice Register a proquint as the caller's primary name.
     * @dev Requires the caller to have no existing primary. The name must be fully
     *      available (past GRACE_PLUS_PREMIUM). Old token is cleared and old owner
     *      receives a capped refund (half the fee).
     * @param input Packed: `bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)`.
     */
    function register(bytes32 input) external payable noBatching {
        uint8 yrs = uint8(bytes1(input[0]));
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        _checkCommitment(bytes31(input << 8), msg.sender);
        require(_primary[msg.sender] == bytes4(0), HasPrimary());
        require(block.timestamp > expiry[ID] + GRACE_PLUS_PREMIUM, NameTaken());

        uint256 fee = priceWei(yrs, LibProquint.isTwin(ID));
        require(msg.value >= fee, InsufficientFee());

        address oldOwner = _ownerOf[ID];
        uint256 _refund;
        if (oldOwner != address(0)) {
            _burn(ID);
            uint256 half = fee / 2;
            _refund = half > MAX_REFUND ? MAX_REFUND : half;
        }

        _mintPrimary(ID, msg.sender, yrs);

        if (_refund > 0) SafeTransferLib.forceSafeTransferETH(oldOwner, _refund);
        if (msg.value > fee) SafeTransferLib.safeTransferETH(msg.sender, msg.value - fee);
    }

    /**
     * @notice Register a proquint into another address's inbox.
     * @dev Commitment is bound to `to`, so only the intended recipient can be targeted.
     *      The token enters inbox state with a duration based on the recipient's inbox count.
     *      Old owner receives a capped refund (half the fee).
     * @param input Packed: `bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)`.
     * @param to Recipient address (token goes to their inbox).
     */
    function registerTo(bytes32 input, address to) external payable noBatching {
        require(to != address(0), ZeroTo());
        require(_inboxCount[to] < MAX_INBOX_COUNT, InboxFull());
        uint8 yrs = uint8(bytes1(input[0]));
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        _checkCommitment(bytes31(input << 8), to);
        require(block.timestamp > expiry[ID] + GRACE_PLUS_PREMIUM, NameTaken());

        uint256 fee = priceWei(yrs, LibProquint.isTwin(ID));
        require(msg.value >= fee, InsufficientFee());

        address oldOwner = _ownerOf[ID];
        uint256 _refund;
        if (oldOwner != address(0)) {
            _burn(ID);
            uint256 half = fee / 2;
            _refund = half > MAX_REFUND ? MAX_REFUND : half;
        }

        _mintInbox(ID, to, yrs);

        if (_refund > 0) SafeTransferLib.forceSafeTransferETH(oldOwner, _refund);
        if (msg.value > fee) SafeTransferLib.safeTransferETH(msg.sender, msg.value - fee);
    }

    /**
     * @notice Register a name during the premium period (after grace, before full availability).
     * @dev A linearly decaying premium surcharge is added on top of the base fee.
     *      50% of the total cost goes to the old owner. Caller must have no primary.
     * @param input Packed: `bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)`.
     */
    function registerPremium(bytes32 input) external payable noBatching {
        uint8 yrs = uint8(bytes1(input[0]));
        require(yrs > 0 && yrs <= MAX_YEARS, InvalidYears());
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        _checkCommitment(bytes31(input << 8), msg.sender);
        require(_primary[msg.sender] == bytes4(0), HasPrimary());

        uint64 oldExpiry = expiry[ID];
        uint256 premiumStart = uint256(oldExpiry) + GRACE_PERIOD;
        require(
            block.timestamp >= premiumStart && block.timestamp < premiumStart + PREMIUM_PERIOD, NotInPremiumPeriod()
        );

        uint256 fee = priceWei(yrs, LibProquint.isTwin(ID));
        uint256 premium;
        unchecked {
            premium = (PREMIUM_START * (PREMIUM_PERIOD - (block.timestamp - premiumStart))) / PREMIUM_PERIOD;
        }
        uint256 total = fee + premium;
        require(msg.value >= total, InsufficientFee());

        address oldOwner = _ownerOf[ID];
        uint256 premiumShare;
        if (oldOwner != address(0)) {
            _burn(ID);
            uint256 half = total / 2;
            premiumShare = half > MAX_REFUND_PREMIUM ? MAX_REFUND_PREMIUM : half;
        }

        _mintPrimary(ID, msg.sender, yrs);

        if (premiumShare > 0) SafeTransferLib.forceSafeTransferETH(oldOwner, premiumShare);
        if (msg.value > total) SafeTransferLib.safeTransferETH(msg.sender, msg.value - total);
    }

    /**
     * @notice Extend a proquint's expiry. Callable by anyone (gift renewals allowed).
     * @dev Uses marginal exponential pricing: fee is based on the total duration
     *      (floor(remaining) + extension years), not just the extension. This prevents
     *      serial 1-year renewals from bypassing the exponential curve.
     *      Total duration (floor(remaining) + yrs) must be ≤ MAX_YEARS.
     * @param input Packed: `bytes1(yrs) ++ bytes4(id)`.
     */
    function renew(bytes5 input) external payable noBatching {
        uint8 yrs = uint8(bytes1(input[0]));
        bytes4 ID = LibProquint.normalize(bytes4(input << 8));
        uint64 current = expiry[ID];
        require(current + GRACE_PERIOD >= block.timestamp, Expired());

        uint256 remaining = current > uint64(block.timestamp) ? current - block.timestamp : 0;
        uint256 fee = renewPriceWei(yrs, remaining, LibProquint.isTwin(ID));
        require(msg.value >= fee, InsufficientFee());

        uint64 newExpiry = current + uint64(uint256(yrs) * REGISTRATION_PERIOD);
        expiry[ID] = newExpiry;
        emit Renewed(ID, newExpiry);
        if (msg.value > fee) SafeTransferLib.safeTransferETH(msg.sender, msg.value - fee);
    }

    /**
     * @notice Burn a name and receive refund for remaining time.
     * @dev Only callable by owner. Refund = (remaining months) × PRICE_PER_MONTH.
     *      Name must not be in inbox. If it's the primary, it will be cleared.
     * @param id Normalized proquint ID (bytes4).
     */
    function burn(bytes4 id) external noBatching {
        bytes4 ID = LibProquint.normalize(id);
        address owner = _ownerOf[ID];
        require(owner == msg.sender, NotOwner());
        require(_inboxExpiry[ID] == 0, AlreadyInInbox());

        // Calculate refund
        uint256 refund;
        unchecked {
            uint256 remainingMonths = (expiry[ID] - block.timestamp) / MONTH_DURATION;
            refund = remainingMonths * PRICE_PER_MONTH;
        }

        // Clear primary if this is the primary name
        if (_primary[owner] == ID) {
            delete _primary[owner];
            emit PrimaryUpdated(owner, bytes4(0));
        }

        _burn(ID);
        if (refund > 0) SafeTransferLib.safeTransferETH(owner, refund);
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
        if (block.timestamp > expiry[id] + GRACE_PERIOD) return address(0);
        return _ownerOf[id];
    }

    /**
     * @notice Check if record exists (by namehash).
     *  @param node ENS-style namehash.
     *  @return True if within grace period.
     */
    function recordExists(bytes32 node) external view returns (bool) {
        bytes4 id = _nodeToId[node];
        return expiry[id] + GRACE_PERIOD >= block.timestamp;
    }

    /**
     * @notice Check if record exists (by raw ID).
     *  @param id Raw proquint ID.
     *  @return True if within grace period.
     */
    function recordExists(bytes4 id) external view returns (bool) {
        bytes4 ID = LibProquint.normalize(id);
        return expiry[ID] + GRACE_PERIOD >= block.timestamp;
    }

    /**
     * @notice Resolve raw ID to owner.
     *  @param id Raw proquint ID.
     *  @return Owner or address(0) if expired past grace.
     */
    function owner(bytes4 id) external view returns (address) {
        bytes4 ID = LibProquint.normalize(id);
        if (block.timestamp > expiry[ID] + GRACE_PERIOD) return address(0);
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
     * @notice Get expiry timestamp for a proquint ID.
     *  @param id Raw proquint ID (auto-normalized).
     *  @return Expiry unix timestamp (0 if never registered).
     */
    function getExpiry(bytes4 id) external view returns (uint64) {
        return expiry[LibProquint.normalize(id)];
    }

    /**
     * @notice Check if name is fully available (past grace + premium, or never registered).
     *  @param id Raw proquint ID (auto-normalized).
     *  @return True if past grace + premium.
     */
    function isAvailable(bytes4 id) external view returns (bool) {
        return block.timestamp > expiry[LibProquint.normalize(id)] + GRACE_PLUS_PREMIUM;
    }

    /**
     * @notice Check if name is in premium re-registration window.
     *  @param id Raw proquint ID (auto-normalized).
     *  @return True if in premium period.
     */
    function inPremium(bytes4 id) external view returns (bool) {
        uint64 exp = expiry[LibProquint.normalize(id)];
        if (exp == 0) return false;
        unchecked {
            uint256 premiumStart = uint256(exp) + GRACE_PERIOD;
            return block.timestamp >= premiumStart && block.timestamp < premiumStart + PREMIUM_PERIOD;
        }
    }

    /**
     * @notice Unified pricing query. Returns the exact fee for a given name and duration,
     *         accounting for the name's current lifecycle state:
     *         - **Available** (past grace+premium or never registered): base registration price.
     *         - **Premium window** (grace expired, premium active): base fee + decaying premium.
     *         - **Active / in grace** (renewable): marginal renewal price based on remaining time.
     *         - **In grace, not yet premium** (only owner can renew): renewal price.
     *         Returns 0 if `yrs` is invalid (0 or >12) or if renewal would exceed MAX_YEARS.
     * @param id Raw proquint ID (auto-normalized).
     * @param yrs Number of years (1–12).
     * @return fee Price in wei, or 0 if not actionable with given yrs.
     */
    function getPrice(bytes4 id, uint8 yrs) external view returns (uint256 fee) {
        if (yrs == 0 || yrs > MAX_YEARS) return 0;
        bytes4 ID = LibProquint.normalize(id);
        bool twin = LibProquint.isTwin(ID);
        uint64 exp = expiry[ID];

        // Never registered or fully available (past grace + premium)
        if (exp == 0 || block.timestamp > exp + GRACE_PLUS_PREMIUM) {
            return priceWei(yrs, twin);
        }

        // Premium window
        uint256 premiumStart = uint256(exp) + GRACE_PERIOD;
        if (block.timestamp >= premiumStart && block.timestamp < premiumStart + PREMIUM_PERIOD) {
            uint256 base = priceWei(yrs, twin);
            unchecked {
                uint256 premium = (PREMIUM_START * (PREMIUM_PERIOD - (block.timestamp - premiumStart))) / PREMIUM_PERIOD;
                return base + premium;
            }
        }

        // Active or in grace → renewal pricing
        uint256 remaining = exp > uint64(block.timestamp) ? exp - block.timestamp : 0;
        if (remaining == 0) return priceWei(yrs, twin);
        uint256 floored = remaining / REGISTRATION_PERIOD;
        if (floored + yrs > MAX_YEARS) return 0;
        return renewPriceWei(yrs, remaining, twin);
    }

    /**
     * @notice Active primary proquint ID for a user.
     *  @param user Address to query.
     *  @return Proquint bytes4 ID, or bytes4(0) if none.
     */
    function primaryName(address user) external view returns (bytes4) {
        return _primary[user];
    }

    /**
     * @notice Total minted (non-burned) tokens.
     *  @return Token count.
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Withdraw 1% contract ETH to the owner.
     */
    function withdraw() external onlyOwner {
        SafeTransferLib.safeTransferETH(msg.sender, address(this).balance / 100);
    }
}
