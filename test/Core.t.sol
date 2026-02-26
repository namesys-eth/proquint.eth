// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {Proquint} from "src/Proquint.sol";
import {LibProquint} from "src/LibProquint.sol";

/// @dev Harness to expose Core internals for testing.
contract CoreHarness is Proquint {
    constructor(address owner_) Proquint(owner_) {}

    function exposed_refundAmount(bytes4 id) external view returns (uint256) {
        uint64 exp = expiry[id];
        if (block.timestamp >= exp) return 0;
        unchecked {
            uint256 remainingMonths = (exp - block.timestamp) / 30 days;
            return remainingMonths * PRICE_PER_MONTH;
        }
    }

    function exposed_inboxDuration(uint8 count) external pure returns (uint256) {
        if (count == 0) return BASE_PENDING_PERIOD;
        unchecked {
            return BASE_PENDING_PERIOD - (INBOX_DURATION_RANGE * (count - 1)) / (MAX_INBOX_COUNT - 1);
        }
    }

    function exposed_priceWei(uint8 yrs, bool isTwin) external pure returns (uint256) {
        return priceWei(yrs, isTwin);
    }

    function exposed_renewPriceWei(uint8 yrs, uint256 remaining, bool isTwin) external pure returns (uint256) {
        return renewPriceWei(yrs, remaining, isTwin);
    }
}

contract CoreTest is Test {
    CoreHarness public harness;
    address public deployer = makeAddr("deployer");
    address public alice = makeAddr("alice");

    bytes4 constant TEST_ID = bytes4(0x00010002);
    bytes27 constant TEST_SECRET = bytes27(uint216(42));
    uint256 constant MIN_COMMITMENT_AGE = 25 seconds;

    function setUp() public {
        vm.warp(1_700_000_000);
        harness = new CoreHarness(deployer);
        vm.deal(alice, 100 ether);
    }

    function _commitAndRegister(address user, bytes4 id, uint8 yrs, bytes27 secret) internal returns (uint256 tokenId) {
        bytes4 ID = LibProquint.normalize(id);
        bytes32 input = bytes32(abi.encodePacked(yrs, ID, secret));
        bytes32 commitment = harness.makeCommitment(ID, secret, user);
        vm.prank(user);
        harness.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);
        uint256 fee = harness.exposed_priceWei(yrs, LibProquint.isTwin(ID));
        vm.prank(user);
        harness.register{value: fee + 0.5 ether}(input);
        tokenId = uint256(uint32(ID));
    }

    // ════════════════════════════════════════════════════════════════
    //  Pricing
    // ════════════════════════════════════════════════════════════════

    function test_priceWei_1year() public view {
        uint256 price = harness.exposed_priceWei(1, false);
        // 1 year: (2^1 - 1) * 0.00036 ether = 0.00036 ether
        assertEq(price, 0.00036 ether);
    }

    function test_priceWei_2years() public view {
        uint256 price = harness.exposed_priceWei(2, false);
        // 2 years: (2^2 - 1) * 0.00036 ether = 3 * 0.00036 = 0.00108 ether
        assertEq(price, 0.00108 ether);
    }

    function test_priceWei_Twin_multiplier() public view {
        uint256 normal = harness.exposed_priceWei(1, false);
        uint256 Twin = harness.exposed_priceWei(1, true);
        assertEq(Twin, normal * 5);
    }

    function test_priceWei_maxYears() public view {
        uint256 price = harness.exposed_priceWei(12, false);
        assertTrue(price > 0);
    }

    function test_priceWei_revert_zeroYears() public {
        vm.expectRevert();
        harness.exposed_priceWei(0, false);
    }

    function test_priceWei_revert_tooManyYears() public {
        vm.expectRevert();
        harness.exposed_priceWei(13, false);
    }

    // ════════════════════════════════════════════════════════════════
    //  Refund Calculation (PRICE_PER_MONTH * remaining months)
    // ════════════════════════════════════════════════════════════════

    function test_refundAmount_unregistered() public view {
        bytes4 id = bytes4(0xdeadbeef);
        uint256 refund = harness.exposed_refundAmount(id);
        assertEq(refund, 0);
    }

    function test_refundAmount_justRegistered() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint256 refund = harness.exposed_refundAmount(ID);
        // 1 year = 365 days / 30 = 12 months remaining
        // 12 * 0.00003 ether = 0.00036 ether
        assertEq(refund, 12 * 0.00003 ether);
    }

    function test_refundAmount_halfwayThrough() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        // Warp ~6 months forward
        vm.warp(block.timestamp + 180 days);
        uint256 refund = harness.exposed_refundAmount(ID);
        // ~6 months remaining
        // 6 * 0.00003 ether = 0.00018 ether
        assertEq(refund, 6 * 0.00003 ether);
    }

    function test_refundAmount_expired() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = harness.expiry(ID);
        vm.warp(exp + 1);
        assertEq(harness.exposed_refundAmount(ID), 0);
    }

    function test_refundAmount_lessThanOneMonth() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = harness.expiry(ID);
        // Warp to 20 days before expiry (< 30 days = 0 months)
        vm.warp(exp - 20 days);
        assertEq(harness.exposed_refundAmount(ID), 0);
    }

    // ════════════════════════════════════════════════════════════════
    //  Inbox Duration
    // ════════════════════════════════════════════════════════════════

    function test_calculateInboxDuration_zero() public view {
        // count=0 → BASE_PENDING_PERIOD (42 days)
        assertEq(harness.exposed_inboxDuration(0), 42 days);
    }

    function test_calculateInboxDuration_one() public view {
        // count=1 → BASE_PENDING_PERIOD - 0 = 42 days (range * 0 / 255)
        assertEq(harness.exposed_inboxDuration(1), 42 days);
    }

    function test_calculateInboxDuration_max() public view {
        // count=45 → BASE - range*(44)/44 = MIN_PENDING_PERIOD (7 days)
        uint256 dur = harness.exposed_inboxDuration(45);
        // Should be exactly MIN_PENDING_PERIOD
        assertEq(dur, 7 days);
    }

    function test_calculateInboxDuration_monotonically_decreasing() public view {
        uint256 prev = harness.exposed_inboxDuration(0);
        for (uint8 i = 1; i < 10; i++) {
            uint256 curr = harness.exposed_inboxDuration(i);
            assertTrue(curr <= prev, "duration should decrease with count");
            prev = curr;
        }
    }
}
