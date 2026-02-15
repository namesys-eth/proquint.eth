// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {ProquintNFT} from "src/ProquintNFT.sol";
import {LibProquint} from "src/LibProquint.sol";

/// @dev Harness to expose Core internals for testing.
contract CoreHarness is ProquintNFT {
    constructor(address owner_) ProquintNFT(owner_) {}

    function exposed_refundAmount(bytes4 id) external view returns (uint256) {
        return _refundAmount(id);
    }

    function exposed_inboxDuration(uint8 count) external pure returns (uint256) {
        return _inboxDuration(count);
    }

    function exposed_priceWei(uint8 yrs, bool isPalindrome) external pure returns (uint256) {
        return priceWei(yrs, isPalindrome);
    }
}

contract CoreTest is Test {
    CoreHarness public harness;
    address public deployer = makeAddr("deployer");
    address public alice = makeAddr("alice");

    bytes4 constant TEST_ID = bytes4(0x00010002);
    bytes27 constant TEST_SECRET = bytes27(uint216(42));
    uint256 constant MIN_COMMITMENT_AGE = 5 seconds;

    function setUp() public {
        vm.warp(1_700_000_000);
        harness = new CoreHarness(deployer);
        vm.deal(alice, 100 ether);
    }

    function _commitAndRegister(address user, bytes4 id, uint8 yrs, bytes27 secret) internal returns (uint256 tokenId) {
        bytes4 ID = LibProquint.normalize(id);
        bytes32 input = bytes32(abi.encodePacked(yrs, ID, secret));
        bytes32 commitment = harness.makeCommitment(input, user);
        vm.prank(user);
        harness.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);
        uint256 fee = harness.exposed_priceWei(yrs, LibProquint.isSymmetric(ID));
        vm.prank(user);
        tokenId = harness.register{value: fee + 0.5 ether}(input);
    }

    // ════════════════════════════════════════════════════════════════
    //  Pricing
    // ════════════════════════════════════════════════════════════════

    function test_priceWei_1year() public view {
        uint256 price = harness.exposed_priceWei(1, false);
        // 1 year: (2^1 - 1) * 0.00024 ether = 0.00024 ether
        assertEq(price, 0.00024 ether);
    }

    function test_priceWei_2years() public view {
        uint256 price = harness.exposed_priceWei(2, false);
        // 2 years: (2^2 - 1) * 0.00024 ether = 3 * 0.00024 = 0.00072 ether
        assertEq(price, 0.00072 ether);
    }

    function test_priceWei_palindrome_multiplier() public view {
        uint256 normal = harness.exposed_priceWei(1, false);
        uint256 palindrome = harness.exposed_priceWei(1, true);
        assertEq(palindrome, normal * 5);
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
        bytes4 ID = LibProquint.normalize(TEST_ID);
        assertEq(harness.exposed_refundAmount(ID), 0);
    }

    function test_refundAmount_justRegistered() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint256 refund = harness.exposed_refundAmount(ID);
        // 1 year = 365 days / 30 = 12 months remaining
        // 12 * 0.00002 ether = 0.00024 ether
        assertEq(refund, 12 * 0.00002 ether);
    }

    function test_refundAmount_halfwayThrough() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        // Warp ~6 months forward
        vm.warp(block.timestamp + 180 days);
        uint256 refund = harness.exposed_refundAmount(ID);
        // ~185 days remaining / 30 = 6 months
        assertEq(refund, 6 * 0.00002 ether);
    }

    function test_refundAmount_expired() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = harness.expiresAt(ID);
        vm.warp(exp + 1);
        assertEq(harness.exposed_refundAmount(ID), 0);
    }

    function test_refundAmount_lessThanOneMonth() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = harness.expiresAt(ID);
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
        // count=255 → BASE - range*(254)/255 ≈ MIN_PENDING_PERIOD (7 days)
        uint256 dur = harness.exposed_inboxDuration(255);
        // Should be very close to MIN_PENDING_PERIOD
        assertTrue(dur >= 7 days);
        assertTrue(dur <= 7 days + 1 days); // within ~1 day of minimum
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
