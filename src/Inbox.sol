// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import {Core} from "./Core.sol";
import {LibProquint} from "./LibProquint.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/**
 * @title ProquintInbox
 * @notice Inbox system for proquint name transfers and state management.
 * @dev Each token is in exactly one of two states:
 *      - **Inbox**: `_inboxExpiry[ID] != 0` — pending acceptance by the receiver.
 *      - **Primary**: `_primary[owner] == ID` — active primary name.
 *
 *      Tokens enter inbox via `transferFrom`, `registerTo`, or `shelve`.
 *      Tokens leave inbox via `acceptInbox` (→ primary), `rejectInbox` (→ burned),
 *      or `cleanInbox` (→ burned with reward split).
 */
abstract contract ProquintInbox is Core {
    error InvalidLength();
    
    /**
     * @notice Pending inbox count.
     *  @param user Address to query.
     *  @return Count (max 45).
     */
    function inboxCount(address user) external view returns (uint8) {
        return _inboxCount[user];
    }

    /**
     * @notice Inbox expiry for a proquint ID.
     *  @param id Raw proquint ID.
     *  @return Expiry timestamp (0 if not in inbox).
     */
    function inboxExpiry(bytes4 id) external view returns (uint64) {
        return _inboxExpiry[LibProquint.normalize(id)];
    }

    /**
     * @notice Global inbox token count.
     *  @return Total tokens in inbox state.
     */
    function totalInbox() external view returns (uint256) {
        return _totalInbox;
    }

    /**
     * @notice Accept an inbox item, promoting it to the receiver's primary name.
     * @dev Only callable by the receiver before inbox expiry.
     *      Reverts if the receiver already has a primary name.
     * @param id Raw proquint ID (auto-normalized).
     */
    function acceptInbox(bytes4 id) external {
        bytes4 ID = LibProquint.normalize(id);
        uint64 ie = _inboxExpiry[ID];
        require(ie >= block.timestamp, InboxExpired());

        address receiver = _ownerOf[ID];
        require(receiver == msg.sender, NotReceiver());
        require(_primary[receiver] == bytes4(0), HasPrimary());

        // Transition: inbox → primary
        delete _inboxExpiry[ID];
        unchecked {
            --_inboxCount[receiver];
            --_totalInbox;
        }
        _primary[receiver] = ID;
        emit PrimaryUpdated(receiver, ID);
    }

    /**
     * @notice Accept an inbox item on behalf of the receiver during ANYONE_PERIOD.
     * @dev Only callable during the ANYONE_PERIOD window after inbox expiry.
     *      Helps activate names for receivers who haven't claimed them.
     * @param id Raw proquint ID (auto-normalized).
     */
    function acceptInboxOnBehalf(bytes4 id) external {
        bytes4 ID = LibProquint.normalize(id);
        uint64 ie = _inboxExpiry[ID];
        require(block.timestamp > ie && ie + ANYONE_PERIOD >= block.timestamp, InboxExpired());

        address receiver = _ownerOf[ID];
        require(_primary[receiver] == bytes4(0), HasPrimary());

        // Transition: inbox → primary
        delete _inboxExpiry[ID];
        unchecked {
            --_inboxCount[receiver];
            --_totalInbox;
        }
        _primary[receiver] = ID;
        emit PrimaryUpdated(receiver, ID);
    }

    /**
     * @notice Move the caller's primary name back to inbox.
     * @dev Applies TRANSFER_PENALTY to expiry and computes a new inbox duration
     *      based on the caller's current inbox count. Frees the primary slot so
     *      the caller can accept or register a different name.
     * @param id Raw proquint ID (auto-normalized).
     */
    function shelve(bytes4 id) external {
        bytes4 ID = LibProquint.normalize(id);
        address o = _ownerOf[ID];
        require(o == msg.sender, NotOwner());
        require(_inboxExpiry[ID] == 0, AlreadyInInbox());
        require(_primary[o] == ID, NotPrimary());
        require(expiry[ID] > block.timestamp, Expired());
        require(_inboxCount[o] < MAX_INBOX_COUNT, InboxFull());

        // Clear primary
        delete _primary[o];

        // Apply transfer penalty
        unchecked {
            expiry[ID] -= TRANSFER_PENALTY;
        }

        // Increment count BEFORE calculating duration
        uint8 count;
        unchecked {
            count = ++_inboxCount[o];
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
        emit PrimaryUpdated(o, bytes4(0));
        emit InboxUpdated(o, ID, ie);
    }

    /**
     * @notice Reject an inbox item. Burns the token and refunds the receiver
     *         proportionally (PRICE_PER_MONTH × remaining whole months).
     * @dev Only callable by the receiver before inbox expiry.
     * @param id Raw proquint ID (auto-normalized).
     */
    function rejectInbox(bytes4 id) external {
        bytes4 ID = LibProquint.normalize(id);
        uint64 ie = _inboxExpiry[ID];
        require(ie != 0, NotInInbox());

        address _o = _ownerOf[ID];
        require(_o == msg.sender, NotOwner());
        require(ie >= block.timestamp, InboxExpired());

        // Inline refund calculation
        uint256 refund;
        unchecked {
            uint256 remainingMonths = (expiry[ID] - block.timestamp) / MONTH_DURATION;
            refund = remainingMonths * PRICE_PER_MONTH;
        }

        _burn(ID);
        if (refund > 0) SafeTransferLib.safeTransferETH(_o, refund);
    }

    /**
     * @notice Burn an inbox item that has passed both inbox expiry and ANYONE_PERIOD.
     * @dev Callable by anyone as a public good. Reward split:
     *      - If refund > PRICE_PER_MONTH and receiver exists: 50% burner, 50% receiver.
     *      - If refund == 0: caller gets 1 month worth of fees as reward.
     *      - Otherwise: 100% to the caller (burner).
     * @param id Raw proquint ID (auto-normalized).
     */
    function cleanInbox(bytes4 id) external {
        bytes4 ID = LibProquint.normalize(id);
        uint64 ie = _inboxExpiry[ID];
        require(ie != 0 && block.timestamp > ie + ANYONE_PERIOD, InboxNotExpired());

        // Inline refund calculation
        uint256 totalRefund;
        uint64 exp = expiry[ID];
        if (exp > block.timestamp) {
            unchecked {
                totalRefund = ((exp - block.timestamp) / MONTH_DURATION) * PRICE_PER_MONTH;
            }
        }

        address receiver = _ownerOf[ID];
        _burn(ID);

        // Reward logic
        if (totalRefund > PRICE_PER_MONTH) {
            // >1 month → split 50/50
            uint256 half = totalRefund / 2;
            SafeTransferLib.forceSafeTransferETH(receiver, half);
            SafeTransferLib.safeTransferETH(msg.sender, half);
        } else {
            // ≤1 month → caller gets PRICE_PER_MONTH
            SafeTransferLib.safeTransferETH(msg.sender, PRICE_PER_MONTH);
        }
    }

    /**
     * @notice Batch clean multiple inbox items in a single transaction.
     * @dev Calls cleanInbox for each ID. Reverts if any single clean fails.
     * @param input Packed bytes4 IDs (length must be multiple of 4).
     */
    function batchCleanInbox(bytes calldata input) external {
        uint256 len = input.length;
        require(len % 4 == 0, InvalidLength());
        uint256 totalBurnerReward;
        
        for (uint256 i = 0; i < len;) {
            bytes4 ID = LibProquint.normalize(bytes4(input[i:i+4]));
            uint64 ie = _inboxExpiry[ID];
            require(ie != 0 && block.timestamp > ie + ANYONE_PERIOD, InboxNotExpired());

            // Inline refund calculation
            uint256 totalRefund;
            uint64 exp = expiry[ID];
            if (exp > block.timestamp) {
                unchecked {
                    totalRefund = ((exp - block.timestamp) / MONTH_DURATION) * PRICE_PER_MONTH;
                }
            }

            address receiver = _ownerOf[ID];
            _burn(ID);

            // Accumulate rewards
            if (totalRefund > PRICE_PER_MONTH) {
                // >1 month → split 50/50
                uint256 half = totalRefund / 2;
                SafeTransferLib.forceSafeTransferETH(receiver, half);
                unchecked { totalBurnerReward += half; }
            } else {
                // ≤1 month → caller gets PRICE_PER_MONTH
                unchecked { totalBurnerReward += PRICE_PER_MONTH; }
            }

            unchecked { i += 4; }
        }
        
        // Send accumulated reward once
        if (totalBurnerReward > 0) {
            SafeTransferLib.safeTransferETH(msg.sender, totalBurnerReward);
        }
    }
}
