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
 *      - **Primary**: `_primaryName[owner] == ID` — active primary name.
 *
 *      Tokens enter inbox via `transferFrom`, `registerTo`, or `shelve`.
 *      Tokens leave inbox via `acceptInbox` (→ primary), `rejectInbox` (→ burned),
 *      or `cleanInbox` (→ burned with reward split).
 */
abstract contract ProquintInbox is Core {
    /**
     * @notice Pending inbox count.
     *  @param user Address to query.
     *  @return Count (max 255).
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
     * @dev Callable by the receiver before inbox expiry, or by anyone during the
     *      ANYONE_PERIOD window after expiry (to help activate on behalf of receiver).
     *      Reverts if the receiver already has a primary name.
     * @param id Raw proquint ID (auto-normalized).
     */
    function acceptInbox(bytes4 id) external {
        bytes4 ID = LibProquint.normalize(id);
        uint64 ie = _inboxExpiry[ID];
        require(ie != 0, NotInInbox());

        address receiver = _ownerOf[ID];
        require(receiver != address(0), NotInInbox());

        bool ok = (ie >= block.timestamp && msg.sender == receiver)
            || (block.timestamp > ie && ie + ANYONE_PERIOD >= block.timestamp);
        require(ok, NotReceiver());
        require(_primaryName[receiver] == bytes4(0), HasPrimary());

        // Transition: inbox → primary
        delete _inboxExpiry[ID];
        unchecked {
            --_inboxCount[receiver];
            --_totalInbox;
        }
        _primaryName[receiver] = ID;
        emit InboxUpdated(receiver, ID, 0);
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
        require(_primaryName[o] == ID, NotPrimary());
        require(expiresAt[ID] > block.timestamp, Expired());
        require(_inboxCount[o] < type(uint8).max, InboxFull());

        // Clear primary
        delete _primaryName[o];

        // Apply transfer penalty
        unchecked {
            expiresAt[ID] -= TRANSFER_PENALTY;
        }

        // Compute inbox duration BEFORE incrementing count
        uint64 ie = uint64(block.timestamp + _inboxDuration(_inboxCount[o]));
        _inboxExpiry[ID] = ie;
        unchecked {
            ++_inboxCount[o];
            ++_totalInbox;
        }
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

        address receiver = _ownerOf[ID];
        require(receiver == msg.sender, NotReceiver());
        require(ie >= block.timestamp, InboxExpired());

        uint256 refund = _refundAmount(ID);

        // Clear inbox state
        delete _inboxExpiry[ID];
        unchecked {
            --_inboxCount[receiver];
            --_totalInbox;
        }

        _burn(ID);
        emit InboxUpdated(receiver, ID, 0);
        if (refund > 0) SafeTransferLib.safeTransferETH(receiver, refund);
    }

    /**
     * @notice Burn an inbox item that has passed both inbox expiry and ANYONE_PERIOD.
     * @dev Callable by anyone as a public good. Reward split:
     *      - If refund > PRICE_PER_MONTH and receiver exists: 50% burner, 50% receiver.
     *      - Otherwise: 100% to the caller (burner).
     * @param id Raw proquint ID (auto-normalized).
     */
    function cleanInbox(bytes4 id) external {
        bytes4 ID = LibProquint.normalize(id);
        uint64 ie = _inboxExpiry[ID];
        require(ie != 0 && block.timestamp > ie + ANYONE_PERIOD, InboxNotExpired());

        uint256 totalRefund = _refundAmount(ID);

        // Clear inbox state
        delete _inboxExpiry[ID];
        address receiver = _ownerOf[ID];
        if (receiver != address(0)) {
            unchecked {
                --_inboxCount[receiver];
                --_totalInbox;
            }
        }

        _burn(ID);
        emit InboxUpdated(receiver, ID, 0);

        // Split: >1 month remaining (totalRefund > PRICE_PER_MONTH) → 50/50, else 100% burner
        uint256 burnerReward;
        if (totalRefund > 0) {
            if (totalRefund > PRICE_PER_MONTH && receiver != address(0)) {
                burnerReward = totalRefund / 2;
                SafeTransferLib.safeTransferETH(receiver, burnerReward);
            } else {
                burnerReward = totalRefund;
            }
            SafeTransferLib.safeTransferETH(msg.sender, burnerReward);
        }
    }
}
