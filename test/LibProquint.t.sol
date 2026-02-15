// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {LibProquint} from "src/LibProquint.sol";

/// @dev Mock wrapper so forge --gas-report can measure library function gas.
contract LibProquintMock {
    function encode1(bytes2 h) external pure returns (bytes5) {
        return LibProquint.encode1(h);
    }

    function decode1(bytes5 h) external pure returns (bytes2) {
        return LibProquint.decode1(h);
    }

    function encode(bytes4 id) external pure returns (bytes11) {
        return LibProquint.encode(id);
    }

    function decode(bytes11 input) external pure returns (bytes4) {
        return LibProquint.decode(input);
    }

    function decodeFromCalldata(bytes calldata b, uint256 start) external pure returns (bytes4) {
        return LibProquint.decodeFromCalldata(b, start);
    }

    function normalize(bytes4 id) external pure returns (bytes4) {
        return LibProquint.normalize(id);
    }

    function isSymmetric(bytes4 id) external pure returns (bool) {
        return LibProquint.isSymmetric(id);
    }

    function hashID(bytes4 id) external pure returns (bytes11, bytes32) {
        return LibProquint.hashID(id);
    }

    function namehash4(bytes4 id) external pure returns (bytes32) {
        return LibProquint.namehash4(id);
    }

    function namehash(bytes11 label) external pure returns (bytes32) {
        return LibProquint.namehash(label);
    }
}

contract LibProquintTest is Test {
    LibProquintMock mock;

    function setUp() public {
        mock = new LibProquintMock();
    }

    // ── encode1 / decode1 roundtrip ─────────────────────────────────

    function test_encode1_zero() public view {
        assertEq(mock.encode1(bytes2(0x0000)), bytes5("babab"));
    }

    function test_encode1_max() public view {
        assertEq(mock.encode1(bytes2(0xFFFF)), bytes5("zuzuz"));
    }

    function test_decode1_babab() public view {
        assertEq(mock.decode1(bytes5("babab")), bytes2(0x0000));
    }

    function test_decode1_zuzuz() public view {
        assertEq(mock.decode1(bytes5("zuzuz")), bytes2(0xFFFF));
    }

    function test_encode1_decode1_roundtrip() public view {
        bytes2[5] memory vals = [bytes2(0x0000), bytes2(0x00FF), bytes2(0xFF00), bytes2(0xFFFF), bytes2(0x1234)];
        for (uint256 i = 0; i < vals.length; i++) {
            bytes5 encoded = mock.encode1(vals[i]);
            bytes2 decoded = mock.decode1(encoded);
            assertEq(decoded, vals[i], "encode1/decode1 roundtrip failed");
        }
    }

    // ── encode / decode roundtrip (bytes4 → bytes11) ────────────────

    function test_encode_zero() public view {
        assertEq(mock.encode(bytes4(0x00000000)), bytes11("babab-babab"));
    }

    function test_encode_decode_roundtrip_basic() public view {
        bytes4 norm = mock.normalize(bytes4(0x12345678));
        bytes11 encoded = mock.encode(norm);
        bytes4 decoded = mock.decode(encoded);
        assertEq(decoded, norm, "encode/decode roundtrip failed");
    }

    function test_decode_rejects_bad_separator() public {
        bytes11 bad = bytes11("babab_babab");
        vm.expectRevert(abi.encodePacked(bytes4(0x5c427cd9)));
        mock.decode(bad);
    }

    function test_encode_normalizes_halves() public view {
        bytes11 enc1 = mock.encode(bytes4(0xFFFF0000));
        bytes11 enc2 = mock.encode(bytes4(0x0000FFFF));
        assertEq(enc1, enc2, "encode should normalize half order");
    }

    function testFuzz_encode_decode_roundtrip(bytes4 id) public view {
        bytes4 norm = mock.normalize(id);
        bytes11 encoded = mock.encode(norm);
        bytes4 decoded = mock.decode(encoded);
        assertEq(decoded, norm);
    }

    // ── normalize ───────────────────────────────────────────────────

    function test_normalize_already_sorted() public view {
        assertEq(mock.normalize(bytes4(0x00010002)), bytes4(0x00010002));
    }

    function test_normalize_swaps() public view {
        assertEq(mock.normalize(bytes4(0x00020001)), bytes4(0x00010002));
    }

    function test_normalize_equal_halves() public view {
        assertEq(mock.normalize(bytes4(0x00010001)), bytes4(0x00010001));
    }

    function test_normalize_idempotent() public view {
        bytes4 norm1 = mock.normalize(bytes4(0xABCD1234));
        bytes4 norm2 = mock.normalize(norm1);
        assertEq(norm1, norm2, "normalize should be idempotent");
    }

    function testFuzz_normalize_idempotent(bytes4 id) public view {
        bytes4 norm1 = mock.normalize(id);
        bytes4 norm2 = mock.normalize(norm1);
        assertEq(norm1, norm2);
    }

    function testFuzz_normalize_commutative(bytes2 a, bytes2 b) public view {
        bytes4 id1 = bytes4(abi.encodePacked(a, b));
        bytes4 id2 = bytes4(abi.encodePacked(b, a));
        assertEq(mock.normalize(id1), mock.normalize(id2));
    }

    // ── isSymmetric ─────────────────────────────────────────────────

    function test_isSymmetric_true() public view {
        assertTrue(mock.isSymmetric(bytes4(0x01020201)));
    }

    function test_isSymmetric_zero() public view {
        assertTrue(mock.isSymmetric(bytes4(0x00000000)));
    }

    function test_isSymmetric_false() public view {
        assertFalse(mock.isSymmetric(bytes4(0x01020304)));
    }

    function test_isSymmetric_half_match() public view {
        assertFalse(mock.isSymmetric(bytes4(0x01030201)));
    }

    // ── namehash / hashID ───────────────────────────────────────────

    function test_namehash4_deterministic() public view {
        bytes32 h1 = mock.namehash4(bytes4(0x12345678));
        bytes32 h2 = mock.namehash4(bytes4(0x12345678));
        assertEq(h1, h2);
        assertTrue(h1 != bytes32(0));
    }

    function test_namehash4_normalizes() public view {
        assertEq(mock.namehash4(bytes4(0xFFFF0000)), mock.namehash4(bytes4(0x0000FFFF)));
    }

    function test_hashID_matches_namehash4() public view {
        (, bytes32 node) = mock.hashID(bytes4(0x12345678));
        bytes32 nh = mock.namehash4(bytes4(0x12345678));
        assertEq(node, nh);
    }

    function test_hashID_returns_label() public view {
        (bytes11 label, bytes32 node) = mock.hashID(bytes4(0x12345678));
        bytes11 encoded = mock.encode(mock.normalize(bytes4(0x12345678)));
        assertEq(label, encoded);
        assertTrue(node != bytes32(0));
    }

    function test_namehash_from_label() public view {
        bytes4 norm = mock.normalize(bytes4(0x12345678));
        bytes11 label = mock.encode(norm);
        bytes32 nh1 = mock.namehash(label);
        bytes32 nh2 = mock.namehash4(bytes4(0x12345678));
        assertEq(nh1, nh2);
    }

    function test_namehash_is_ens_style() public view {
        bytes4 norm = mock.normalize(bytes4(0x12345678));
        bytes11 label = mock.encode(norm);
        bytes32 labelhash = keccak256(abi.encodePacked(label));
        bytes32 expected = keccak256(abi.encodePacked(bytes32(0), labelhash));
        assertEq(mock.namehash4(bytes4(0x12345678)), expected);
    }

    function testFuzz_different_ids_different_hashes(bytes4 a, bytes4 b) public view {
        bytes4 na = mock.normalize(a);
        bytes4 nb = mock.normalize(b);
        vm.assume(na != nb);
        assertTrue(mock.namehash4(a) != mock.namehash4(b));
    }

    // ── decodeFromCalldata ──────────────────────────────────────────

    function test_decodeFromCalldata() public view {
        bytes4 norm = mock.normalize(bytes4(0x12345678));
        bytes11 label = mock.encode(norm);
        bytes memory data = abi.encodePacked(label);
        bytes4 decoded = mock.decodeFromCalldata(data, 0);
        assertEq(decoded, norm);
    }

    function test_decodeFromCalldata_with_offset() public view {
        bytes4 norm = mock.normalize(bytes4(0x12345678));
        bytes11 label = mock.encode(norm);
        bytes memory data = abi.encodePacked(bytes5(0x0000000000), label);
        bytes4 decoded = mock.decodeFromCalldata(data, 5);
        assertEq(decoded, norm);
    }

    function test_decodeFromCalldata_reverts_short() public {
        bytes memory data = hex"0102030405060708090a"; // 10 bytes, need 11
        vm.expectRevert("LibProquint: len");
        mock.decodeFromCalldata(data, 0);
    }
}
