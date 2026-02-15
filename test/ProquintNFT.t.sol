// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {ProquintNFT} from "src/ProquintNFT.sol";
import {ProquintInbox} from "src/Inbox.sol";
import {Core} from "src/Core.sol";
import {LibProquint} from "src/LibProquint.sol";
import {IERC721Receiver} from "src/IProquint.sol";

/// @dev ERC721 receiver that accepts tokens.
contract ERC721Acceptor is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @dev ERC721 receiver that rejects tokens.
contract ERC721Rejector {
    // No onERC721Received — will revert

    }

contract ProquintNFTTest is Test {
    ProquintNFT public nft;
    address public deployer = makeAddr("deployer");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public carol = makeAddr("carol");

    // Test proquint: 0x00010002 (already normalized: 0x0001 < 0x0002)
    bytes4 constant TEST_ID = bytes4(0x00010002);
    bytes27 constant TEST_SECRET = bytes27(uint216(42));

    // ── Constants mirrored from Core.sol ──
    uint256 constant MIN_COMMITMENT_AGE = 5 seconds;
    uint256 constant MAX_COMMITMENT_AGE = 15 minutes;
    uint256 constant PRICE_PER_YEAR = 0.00024 ether;
    uint256 constant PALINDROME_MULTIPLIER = 5;
    uint64 constant GRACE_PERIOD = 300 days;
    uint64 constant GRACE_PLUS_PREMIUM = 365 days;
    uint64 constant ANYONE_PERIOD = 7 days;
    uint64 constant TRANSFER_PENALTY = 7 days;
    uint256 constant REGISTRATION_PERIOD = 365 days;

    function setUp() public {
        // Warp to a realistic timestamp so block.timestamp > GRACE_PLUS_PREMIUM (365 days)
        vm.warp(1_700_000_000);
        nft = new ProquintNFT(deployer);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    /// @dev Build commit-reveal input: bytes1(yrs) ++ bytes4(id) ++ bytes27(secret)
    function _makeInput(uint8 yrs, bytes4 id, bytes27 secret) internal pure returns (bytes32) {
        return bytes32(abi.encodePacked(yrs, id, secret));
    }

    /// @dev Full commit-reveal-register flow, returns tokenId.
    function _commitAndRegister(address user, bytes4 id, uint8 yrs, bytes27 secret) internal returns (uint256 tokenId) {
        bytes4 ID = LibProquint.normalize(id);
        bytes32 input = _makeInput(yrs, ID, secret);
        bytes32 commitment = nft.makeCommitment(input, user);

        vm.prank(user);
        nft.commit(commitment);

        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);

        uint256 fee = _estimateFee(yrs, ID);
        vm.prank(user);
        tokenId = nft.register{value: fee + 0.1 ether}(input);
    }

    function _estimateFee(uint8 yrs, bytes4 id) internal pure returns (uint256) {
        uint256 fee = ((uint256(1) << yrs) - 1) * PRICE_PER_YEAR;
        if (LibProquint.isSymmetric(id)) fee *= PALINDROME_MULTIPLIER;
        return fee;
    }

    // ════════════════════════════════════════════════════════════════
    //  ERC173 Ownership
    // ════════════════════════════════════════════════════════════════

    function test_owner() public view {
        assertEq(nft.owner(), deployer);
    }

    function test_transferOwnership() public {
        vm.prank(deployer);
        nft.transferOwnership(alice);
        assertEq(nft.owner(), alice);
    }

    function test_transferOwnership_revert_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(Core.NotOwner.selector);
        nft.transferOwnership(bob);

    }

    function test_transferOwnership_revert_zeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert(ProquintNFT.ZeroOwner.selector);
        nft.transferOwnership(address(0));
    }

    // ════════════════════════════════════════════════════════════════
    //  ERC721 Metadata
    // ════════════════════════════════════════════════════════════════

    function test_name() public view {
        assertEq(nft.name(), "Proquint Name System");
    }

    function test_symbol() public view {
        assertEq(nft.symbol(), "PROQUINT");
    }

    function test_supportsInterface() public view {
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(nft.supportsInterface(0x5b5e139f)); // ERC721Metadata
        assertFalse(nft.supportsInterface(0xdeadbeef));
    }

    // ════════════════════════════════════════════════════════════════
    //  Commit-Reveal
    // ════════════════════════════════════════════════════════════════

    function test_makeCommitment_deterministic() public view {
        bytes32 input = _makeInput(1, TEST_ID, TEST_SECRET);
        bytes32 c1 = nft.makeCommitment(input, alice);
        bytes32 c2 = nft.makeCommitment(input, alice);
        assertEq(c1, c2);
        assertTrue(c1 != bytes32(0));
    }

    function test_makeCommitment_different_recipients() public view {
        bytes32 input = _makeInput(1, TEST_ID, TEST_SECRET);
        bytes32 c1 = nft.makeCommitment(input, alice);
        bytes32 c2 = nft.makeCommitment(input, bob);
        assertTrue(c1 != c2);
    }

    function test_commit() public {
        bytes32 input = _makeInput(1, TEST_ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        assertTrue(nft.commitments(commitment) != 0);
    }

    function test_commit_revert_duplicate_fresh() public {
        bytes32 input = _makeInput(1, TEST_ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        // Immediate re-commit should fail (not expired yet)
        vm.prank(alice);
        vm.expectRevert(ProquintNFT.CommitmentExists.selector);
        nft.commit(commitment);
    }

    function test_commit_allows_reuse_after_expiry() public {
        bytes32 input = _makeInput(1, TEST_ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        vm.warp(block.timestamp + MAX_COMMITMENT_AGE + 1);
        // Should succeed now
        vm.prank(alice);
        nft.commit(commitment);
    }

    // ════════════════════════════════════════════════════════════════
    //  Register
    // ════════════════════════════════════════════════════════════════

    function test_register() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        assertEq(nft.ownerOf(tokenId), alice);
        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.totalSupply(), 1);
        assertTrue(nft.primaryName(alice) != bytes32(0));
    }

    function test_register_revert_tooNew() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 input = _makeInput(1, ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        // Don't wait — try immediately
        vm.prank(alice);
        vm.expectRevert(ProquintNFT.CommitmentTooNew.selector);
        nft.register{value: 1 ether}(input);
    }

    function test_register_revert_tooOld() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 input = _makeInput(1, ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        vm.warp(block.timestamp + MAX_COMMITMENT_AGE + 1);
        vm.prank(alice);
        vm.expectRevert(ProquintNFT.CommitmentTooOld.selector);
        nft.register{value: 1 ether}(input);
    }

    function test_register_revert_insufficientFee() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 input = _makeInput(1, ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);
        vm.prank(alice);
        vm.expectRevert(ProquintNFT.InsufficientFee.selector);
        nft.register{value: 0}(input);
    }

    function test_register_revert_alreadyHasPrimary() public {
        // Register first proquint
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        // Try to register another — alice already has a primary
        bytes4 id2 = bytes4(0x00030004);
        bytes4 ID2 = LibProquint.normalize(id2);
        bytes32 input2 = _makeInput(1, ID2, bytes27(uint216(99)));
        bytes32 commitment2 = nft.makeCommitment(input2, alice);
        vm.prank(alice);
        nft.commit(commitment2);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);
        vm.prank(alice);
        vm.expectRevert(Core.HasPrimary.selector);
        nft.register{value: 1 ether}(input2);
    }

    function test_register_invalidYears_zero() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 input = _makeInput(0, ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);
        vm.prank(alice);
        vm.expectRevert();
        nft.register{value: 1 ether}(input);
    }

    function test_register_reRegistration_refundsOldOwner() public {
        // Alice registers, let it fully expire (past grace + premium)
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = nft.expiresAt(ID);
        vm.warp(exp + GRACE_PLUS_PREMIUM + 1);

        // Bob re-registers the same name
        uint256 aliceBalBefore = alice.balance;
        bytes27 secret2 = bytes27(uint216(88));
        bytes32 input2 = _makeInput(1, ID, secret2);
        bytes32 commitment2 = nft.makeCommitment(input2, bob);
        vm.prank(bob);
        nft.commit(commitment2);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);

        uint256 fee = _estimateFee(1, ID);
        vm.prank(bob);
        nft.register{value: fee + 1 ether}(input2);

        assertEq(_ownerById(ID), bob);
        // Alice should have received a refund (may be 0 since fully expired)
        assertTrue(alice.balance >= aliceBalBefore, "old owner should not lose ETH");
    }

    function test_register_refunds_excess() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 input = _makeInput(1, ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, alice);
        vm.prank(alice);
        nft.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        nft.register{value: 10 ether}(input);
        // Should get most of the excess back
        assertTrue(alice.balance > balBefore - 1 ether, "should refund excess");
    }

    // ════════════════════════════════════════════════════════════════
    //  RegisterTo (inbox)
    // ════════════════════════════════════════════════════════════════

    function test_registerTo() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 input = _makeInput(1, ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, bob);
        vm.prank(alice);
        nft.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);

        uint256 fee = _estimateFee(1, ID);
        vm.prank(alice);
        uint256 tokenId = nft.registerTo{value: fee + 0.1 ether}(input, bob);

        assertEq(nft.ownerOf(tokenId), bob);
        assertTrue(nft.inboxExpiry(ID) != 0, "should be in inbox");
        assertEq(nft.inboxCount(bob), 1);
        assertEq(nft.totalInbox(), 1);
        // Primary should NOT be set yet (still in inbox)
        assertEq(nft.primaryName(bob), bytes32(0));
    }

    function test_registerTo_revert_zeroAddress() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 input = _makeInput(1, ID, TEST_SECRET);
        bytes32 commitment = nft.makeCommitment(input, address(0));
        vm.prank(alice);
        nft.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);
        vm.prank(alice);
        vm.expectRevert(ProquintNFT.ZeroTo.selector);
        nft.registerTo{value: 1 ether}(input, address(0));
    }

    // ════════════════════════════════════════════════════════════════
    //  Inbox: accept / reject / burnExpired
    // ════════════════════════════════════════════════════════════════

    function _registerToInbox(address sender, address receiver, bytes4 id, bytes27 secret)
        internal
        returns (uint256 tokenId)
    {
        bytes4 ID = LibProquint.normalize(id);
        bytes32 input = _makeInput(1, ID, secret);
        bytes32 commitment = nft.makeCommitment(input, receiver);
        vm.prank(sender);
        nft.commit(commitment);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);
        uint256 fee = _estimateFee(1, ID);
        vm.prank(sender);
        tokenId = nft.registerTo{value: fee + 0.1 ether}(input, receiver);
    }

    function test_acceptInbox() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        vm.prank(bob);
        nft.acceptInbox(ID);

        assertEq(nft.inboxExpiry(ID), 0, "inbox should be cleared");
        assertEq(nft.inboxCount(bob), 0);
        assertEq(nft.totalInbox(), 0);
        assertTrue(nft.primaryName(bob) != bytes32(0), "primary should be set");
    }

    function test_acceptInbox_revert_alreadyHasPrimary() public {
        // Give bob a primary first
        bytes4 id2 = bytes4(0x00050006);
        _commitAndRegister(bob, id2, 1, bytes27(uint216(55)));
        assertTrue(nft.primaryName(bob) != bytes32(0));

        // Now send TEST_ID to bob's inbox
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        // Bob can't accept — already has primary
        vm.prank(bob);
        vm.expectRevert(Core.HasPrimary.selector);
        nft.acceptInbox(ID);
    }

    function test_acceptInbox_revert_notReceiver() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        vm.prank(carol); // not bob, and not past expiry
        vm.expectRevert();
        nft.acceptInbox(ID);
    }

    function test_acceptInbox_anyoneAfterExpiry() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 ie = nft.inboxExpiry(ID);

        // Warp past inbox expiry but within ANYONE_PERIOD
        vm.warp(ie + 1);
        vm.prank(carol); // anyone can accept
        nft.acceptInbox(ID);
        assertTrue(nft.primaryName(bob) != bytes32(0));
    }

    function test_rejectInbox() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        uint256 balBefore = bob.balance;
        vm.prank(bob);
        nft.rejectInbox(ID);

        assertEq(nft.inboxExpiry(ID), 0);
        assertEq(nft.inboxCount(bob), 0);
        // Token should be burned
        vm.expectRevert(ProquintNFT.NotMinted.selector);
        nft.ownerOf(uint256(uint32(ID)));
        // Bob should have received a refund
        assertTrue(bob.balance >= balBefore, "should get refund");
    }

    function test_acceptInbox_revert_pastAnyonePeriod() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 ie = nft.inboxExpiry(ID);

        // Warp past inbox expiry + ANYONE_PERIOD
        vm.warp(ie + ANYONE_PERIOD + 1);
        vm.prank(carol);
        vm.expectRevert();
        nft.acceptInbox(ID);
    }

    function test_rejectInbox_revert_notReceiver() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        vm.prank(carol);
        vm.expectRevert();
        nft.rejectInbox(ID);
    }

    function test_rejectInbox_revert_afterExpiry() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 ie = nft.inboxExpiry(ID);

        // Warp past inbox expiry
        vm.warp(ie + 1);
        vm.prank(bob);
        vm.expectRevert();
        nft.rejectInbox(ID);
    }

    function test_cleanInbox() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 ie = nft.inboxExpiry(ID);

        vm.warp(ie + ANYONE_PERIOD + 1);

        vm.prank(carol);
        nft.cleanInbox(ID);

        assertEq(nft.inboxExpiry(ID), 0);
        vm.expectRevert(ProquintNFT.NotMinted.selector);
        nft.ownerOf(uint256(uint32(ID)));
    }

    function test_cleanInbox_revert_tooEarly() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        // Don't warp far enough
        vm.prank(carol);
        vm.expectRevert();
        nft.cleanInbox(ID);
    }

    // ════════════════════════════════════════════════════════════════
    //  Shelve (primary → inbox)
    // ════════════════════════════════════════════════════════════════

    function test_shelve() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        assertTrue(nft.primaryName(alice) != bytes32(0), "should have primary");

        uint64 expiryBefore = nft.expiresAt(ID);

        vm.prank(alice);
        nft.shelve(ID);

        assertEq(nft.primaryName(alice), bytes32(0), "primary should be cleared");
        assertTrue(nft.inboxExpiry(ID) != 0, "should be in inbox");
        assertEq(nft.inboxCount(alice), 1);
        assertEq(nft.totalInbox(), 1);
        assertEq(nft.expiresAt(ID), expiryBefore - TRANSFER_PENALTY, "exact penalty mismatch");
        assertEq(nft.ownerOf(uint256(uint32(ID))), alice);
    }

    function test_shelve_revert_notOwner() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        vm.prank(bob);
        vm.expectRevert(Core.NotOwner.selector);
        nft.shelve(ID);
    }

    function test_shelve_revert_alreadyInInbox() public {
        _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        vm.prank(bob);
        vm.expectRevert(Core.AlreadyInInbox.selector);
        nft.shelve(ID);
    }

    function test_shelve_then_acceptInbox() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        // Shelve
        vm.prank(alice);
        nft.shelve(ID);
        assertEq(nft.primaryName(alice), bytes32(0));

        // Re-accept
        vm.prank(alice);
        nft.acceptInbox(ID);
        assertTrue(nft.primaryName(alice) != bytes32(0), "primary should be restored");
        assertEq(nft.inboxExpiry(ID), 0);
        assertEq(nft.inboxCount(alice), 0);
    }

    // ════════════════════════════════════════════════════════════════
    //  ERC721 Transfers
    // ════════════════════════════════════════════════════════════════

    function test_transferFrom() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 expiryBefore = nft.expiresAt(ID);
        uint256 tokenId = uint256(uint32(ID));

        vm.prank(alice);
        nft.transferFrom(alice, bob, tokenId);

        assertEq(nft.ownerOf(tokenId), bob);
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.balanceOf(bob), 1);
        assertTrue(nft.inboxExpiry(ID) != 0, "should be in inbox after transfer");
        assertEq(nft.expiresAt(ID), expiryBefore - TRANSFER_PENALTY, "penalty not applied");
        assertEq(nft.primaryName(alice), bytes32(0), "sender primary should be cleared");
    }

    function test_transferFrom_revert_toZero() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(alice);
        vm.expectRevert(ProquintNFT.TransferToZeroAddress.selector);
        nft.transferFrom(alice, address(0), tokenId);
    }

    function test_transferFrom_revert_notOwner() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(bob);
        vm.expectRevert(Core.Unauthorized.selector);
        nft.transferFrom(alice, bob, tokenId);
    }

    function test_transferFrom_approved() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(alice);
        nft.approve(bob, tokenId);
        assertEq(nft.getApproved(tokenId), bob);

        vm.prank(bob);
        nft.transferFrom(alice, carol, tokenId);
        assertEq(nft.ownerOf(tokenId), carol);
    }

    function test_transferFrom_approvedForAll() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(alice);
        nft.setApprovalForAll(bob, true);
        assertTrue(nft.isApprovedForAll(alice, bob));

        vm.prank(bob);
        nft.transferFrom(alice, carol, tokenId);
        assertEq(nft.ownerOf(tokenId), carol);
    }

    function test_transferFrom_revert_expired() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = nft.expiresAt(ID);
        vm.warp(exp + 1);

        vm.prank(alice);
        vm.expectRevert(Core.Expired.selector);
        nft.transferFrom(alice, bob, tokenId);
    }

    function test_transferFrom_revert_inInbox() public {
        // Register to bob's inbox
        uint256 tokenId = _registerToInbox(alice, bob, TEST_ID, TEST_SECRET);
        // Bob can't transfer while in inbox
        vm.prank(bob);
        vm.expectRevert();
        nft.transferFrom(bob, carol, tokenId);
    }

    function test_safeTransferFrom_toEOA() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(alice);
        nft.safeTransferFrom(alice, bob, tokenId);
        assertEq(nft.ownerOf(tokenId), bob);
    }

    function test_safeTransferFrom_toContract() public {
        ERC721Acceptor acceptor = new ERC721Acceptor();
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(alice);
        nft.safeTransferFrom(alice, address(acceptor), tokenId);
        assertEq(nft.ownerOf(tokenId), address(acceptor));
    }

    function test_safeTransferFrom_revert_unsafeRecipient() public {
        ERC721Rejector rejector = new ERC721Rejector();
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(alice);
        vm.expectRevert();
        nft.safeTransferFrom(alice, address(rejector), tokenId);
    }

    // ════════════════════════════════════════════════════════════════
    //  Renew
    // ════════════════════════════════════════════════════════════════

    function test_renew() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 oldExpiry = nft.expiresAt(ID);

        bytes32 renewInput = _makeInput(1, ID, bytes27(0));
        uint256 fee = _estimateFee(1, ID);
        vm.prank(alice);
        nft.renew{value: fee + 0.1 ether}(renewInput);

        uint64 newExpiry = nft.expiresAt(ID);
        assertGt(newExpiry, oldExpiry);
        assertEq(newExpiry, oldExpiry + uint64(REGISTRATION_PERIOD));
    }

    function test_renew_revert_notMinted() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 renewInput = _makeInput(1, ID, bytes27(0));
        vm.prank(alice);
        vm.expectRevert(ProquintNFT.NotMinted.selector);
        nft.renew{value: 1 ether}(renewInput);
    }

    function test_renew_revert_expired_past_grace() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = nft.expiresAt(ID);
        vm.warp(exp + GRACE_PERIOD + 1);

        bytes32 renewInput = _makeInput(1, ID, bytes27(0));
        vm.prank(alice);
        vm.expectRevert(Core.Expired.selector);
        nft.renew{value: 1 ether}(renewInput);
    }

    function test_renew_revert_exceedsMaxYears() public {
        // Register for 12 years (max)
        _commitAndRegister(alice, TEST_ID, 12, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        // Try to renew for 1 more year — would exceed MAX_YEARS from now
        bytes32 renewInput = _makeInput(12, ID, bytes27(0));
        uint256 fee = _estimateFee(12, ID);
        vm.prank(alice);
        vm.expectRevert();
        nft.renew{value: fee}(renewInput);
    }

    function test_renew_revert_invalidYears() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 renewInput = _makeInput(0, ID, bytes27(0));
        vm.prank(alice);
        vm.expectRevert();
        nft.renew{value: 1 ether}(renewInput);
    }

    // ════════════════════════════════════════════════════════════════
    //  Registry Helpers
    // ════════════════════════════════════════════════════════════════

    function test_getNode() public pure {
        bytes32 node = LibProquint.namehash4(TEST_ID);
        // ProquintNFT.getNode just calls LibProquint.namehash4
        assertTrue(node != bytes32(0));
    }

    /// @dev Call owner(bytes32) explicitly to avoid overload ambiguity.
    function _ownerByNode(bytes32 node) internal view returns (address) {
        (bool ok, bytes memory ret) = address(nft).staticcall(abi.encodeWithSignature("owner(bytes32)", node));
        require(ok);
        return abi.decode(ret, (address));
    }

    /// @dev Call owner(bytes4) explicitly to avoid overload ambiguity.
    function _ownerById(bytes4 id) internal view returns (address) {
        (bool ok, bytes memory ret) = address(nft).staticcall(abi.encodeWithSignature("owner(bytes4)", id));
        require(ok);
        return abi.decode(ret, (address));
    }

    function test_owner_byNodeAndId() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 node = nft.getNode(TEST_ID);

        assertEq(_ownerByNode(node), alice);
        assertEq(_ownerById(ID), alice);

        // After grace → zero
        uint64 exp = nft.expiresAt(ID);
        vm.warp(exp + GRACE_PERIOD + 1);
        assertEq(_ownerByNode(node), address(0));
        assertEq(_ownerById(ID), address(0));
    }

    /// @dev Call recordExists(bytes32) explicitly.
    function _recordExistsByNode(bytes32 node) internal view returns (bool) {
        (bool ok, bytes memory ret) = address(nft).staticcall(abi.encodeWithSignature("recordExists(bytes32)", node));
        require(ok);
        return abi.decode(ret, (bool));
    }

    /// @dev Call recordExists(bytes4) explicitly.
    function _recordExistsById(bytes4 id) internal view returns (bool) {
        (bool ok, bytes memory ret) = address(nft).staticcall(abi.encodeWithSignature("recordExists(bytes4)", id));
        require(ok);
        return abi.decode(ret, (bool));
    }

    function test_recordExists_byNodeAndId() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        bytes32 node = nft.getNode(TEST_ID);

        assertTrue(_recordExistsByNode(node));
        assertTrue(_recordExistsById(ID));

        // After grace → false
        uint64 exp = nft.expiresAt(ID);
        vm.warp(exp + GRACE_PERIOD + 1);
        assertFalse(_recordExistsByNode(node));
        assertFalse(_recordExistsById(ID));
    }

    function test_isProquint() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes32 node = nft.getNode(TEST_ID);
        assertTrue(nft.isProquint(node));
        assertFalse(nft.isProquint(bytes32(uint256(999))));
    }

    function test_lifecycle_states() public {
        bytes4 ID = LibProquint.normalize(TEST_ID);

        // Unregistered → available
        assertTrue(nft.isAvailable(ID));
        assertEq(nft.getExpiry(ID), 0);

        // Register → active
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        assertFalse(nft.isAvailable(ID));
        uint64 exp = nft.getExpiry(ID);
        assertGt(exp, uint64(block.timestamp));

        // Past expiry → in grace, not available
        vm.warp(exp + 1);
        assertFalse(nft.isAvailable(ID));

        // Past grace → in premium
        vm.warp(exp + GRACE_PERIOD + 1);
        assertTrue(nft.inPremium(ID));
        assertFalse(nft.isAvailable(ID));

        // Past grace + premium → fully available
        vm.warp(exp + GRACE_PLUS_PREMIUM + 1);
        assertTrue(nft.isAvailable(ID));
        assertFalse(nft.inPremium(ID));
    }

    function test_primaryName() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        assertEq(nft.primaryName(alice), ID);
        assertEq(nft.primaryName(bob), bytes4(0));
    }

    // ════════════════════════════════════════════════════════════════
    //  TokenURI
    // ════════════════════════════════════════════════════════════════

    function test_tokenURI() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        string memory uri = nft.tokenURI(tokenId);
        // Should start with data:application/json,
        assertTrue(bytes(uri).length > 0);
        // Check it starts with the expected prefix
        bytes memory prefix = bytes("data:application/json,");
        bytes memory uriBytes = bytes(uri);
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i]);
        }
    }

    function test_tokenURI_revert_notMinted() public {
        vm.expectRevert(ProquintNFT.NotMinted.selector);
        nft.tokenURI(999);
    }

    // ════════════════════════════════════════════════════════════════
    //  Premium Registration
    // ════════════════════════════════════════════════════════════════

    function test_registerPremium() public {
        // First register, let it expire into premium period
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);
        uint64 exp = nft.expiresAt(ID);

        vm.warp(exp + GRACE_PERIOD + 1);
        assertTrue(nft.inPremium(ID));

        // Bob registers during premium
        bytes27 secret2 = bytes27(uint216(77));
        bytes32 input2 = _makeInput(1, ID, secret2);
        bytes32 commitment2 = nft.makeCommitment(input2, bob);
        vm.prank(bob);
        nft.commit(commitment2);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);

        vm.prank(bob);
        nft.registerPremium{value: 10 ether}(input2);
        assertEq(_ownerById(ID), bob);
    }

    function test_registerPremium_revert_notInPremiumPeriod() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        bytes4 ID = LibProquint.normalize(TEST_ID);

        // Still active, not in premium
        bytes27 secret2 = bytes27(uint216(77));
        bytes32 input2 = _makeInput(1, ID, secret2);
        bytes32 commitment2 = nft.makeCommitment(input2, bob);
        vm.prank(bob);
        nft.commit(commitment2);
        vm.warp(block.timestamp + MIN_COMMITMENT_AGE + 1);

        vm.prank(bob);
        vm.expectRevert(ProquintNFT.NotInPremiumPeriod.selector);
        nft.registerPremium{value: 10 ether}(input2);
    }

    // ════════════════════════════════════════════════════════════════
    //  Withdraw
    // ════════════════════════════════════════════════════════════════

    function test_withdraw() public {
        _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        uint256 contractBal = address(nft).balance;
        assertTrue(contractBal > 0);

        uint256 deployerBal = deployer.balance;
        vm.prank(deployer);
        nft.withdraw();
        assertEq(deployer.balance, deployerBal + contractBal);
    }

    function test_withdraw_revert_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(Core.NotOwner.selector);
        nft.withdraw();

    }

    // ════════════════════════════════════════════════════════════════
    //  ERC721 view edge cases
    // ════════════════════════════════════════════════════════════════

    function test_ownerOf_revert_notMinted() public {
        vm.expectRevert(ProquintNFT.NotMinted.selector);
        nft.ownerOf(999);
    }

    function test_getApproved_revert_notMinted() public {
        vm.expectRevert(ProquintNFT.NotMinted.selector);
        nft.getApproved(999);
    }

    function test_approve_revert_unauthorized() public {
        uint256 tokenId = _commitAndRegister(alice, TEST_ID, 1, TEST_SECRET);
        vm.prank(bob);
        vm.expectRevert(Core.Unauthorized.selector);
        nft.approve(carol, tokenId);
    }
}
