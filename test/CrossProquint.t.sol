// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {SimpleProquint} from "test/SimpleProquint.sol";
import {LibProquint} from "src/LibProquint.sol";

/// @dev Wrapper so forge --gas-report measures LibProquint library calls.
contract LibProquintMock {
    function encode(bytes4 id) external pure returns (bytes11) {
        return LibProquint.encode(id);
    }

    function decode(bytes11 input) external pure returns (bytes4) {
        return LibProquint.decode(input);
    }

    function encode1(bytes2 h) external pure returns (bytes5) {
        return LibProquint.encode1(h);
    }

    function decode1(bytes5 h) external pure returns (bytes2) {
        return LibProquint.decode1(h);
    }

    function normalize(bytes4 id) external pure returns (bytes4) {
        return LibProquint.normalize(id);
    }
}

/// @title CrossProquintTest
/// @notice Cross-test: SimpleProquint (Solidity reference) vs LibProquint (assembly-optimized).
///         Run with `forge test --mc CrossProquint --gas-report` to compare gas.
contract CrossProquintTest is Test {
    SimpleProquint simple;
    LibProquintMock lib;

    function setUp() public {
        simple = new SimpleProquint();
        lib = new LibProquintMock();
    }

    // ════════════════════════════════════════════════════════════════
    //  Encode correctness: SimpleProquint.encode == LibProquint.encode
    // ════════════════════════════════════════════════════════════════

    function test_cross_encode_zero() public view {
        string memory sEnc = simple.encode(bytes4(0), bytes1("-"));
        bytes11 lEnc = lib.encode(bytes4(0));
        assertEq(sEnc, string(abi.encodePacked(lEnc)));
    }

    function test_cross_encode_max() public view {
        bytes4 id = bytes4(type(uint32).max);
        bytes4 norm = lib.normalize(id);
        string memory sEnc = simple.encode(norm, bytes1("-"));
        bytes11 lEnc = lib.encode(norm);
        assertEq(sEnc, string(abi.encodePacked(lEnc)));
    }

    function test_cross_encode_samples() public view {
        bytes4[6] memory samples = [
            bytes4(0x00010002),
            bytes4(0xDEADBEEF),
            bytes4(0x12345678),
            bytes4(0xCAFEBABE),
            bytes4(0xABCDABCD), // twin (hi == lo)
            bytes4(0xABCD0000)
        ];
        for (uint256 i = 0; i < samples.length; i++) {
            bytes4 norm = lib.normalize(samples[i]);
            string memory sEnc = simple.encode(norm, bytes1("-"));
            bytes11 lEnc = lib.encode(norm);
            assertEq(sEnc, string(abi.encodePacked(lEnc)), "encode mismatch");
        }
    }

    function testFuzz_cross_encode(bytes4 id) public view {
        bytes4 norm = lib.normalize(id);
        string memory sEnc = simple.encode(norm, bytes1("-"));
        bytes11 lEnc = lib.encode(norm);
        assertEq(sEnc, string(abi.encodePacked(lEnc)));
    }

    // ════════════════════════════════════════════════════════════════
    //  Decode correctness: SimpleProquint.decode == LibProquint.decode
    // ════════════════════════════════════════════════════════════════

    function test_cross_decode_babab() public view {
        bytes4 sDec = simple.decode("babab-babab");
        bytes4 lDec = lib.decode(bytes11("babab-babab"));
        assertEq(sDec, lDec);
    }

    function test_cross_decode_samples() public view {
        string[4] memory labels = ["babab-dabab", "zuzuz-zuzuz", "babab-zuzuz", "lidoh-mafuv"];
        for (uint256 i = 0; i < labels.length; i++) {
            bytes4 sDec = simple.decode(labels[i]);
            bytes4 lDec = lib.decode(bytes11(bytes(labels[i])));
            assertEq(sDec, lDec, "decode mismatch");
        }
    }

    // ════════════════════════════════════════════════════════════════
    //  Roundtrip: encode with one, decode with the other
    // ════════════════════════════════════════════════════════════════

    function testFuzz_cross_roundtrip_simple_encode_lib_decode(bytes4 id) public view {
        bytes4 norm = lib.normalize(id);
        string memory sEnc = simple.encode(norm, bytes1("-"));
        bytes4 lDec = lib.decode(bytes11(bytes(sEnc)));
        assertEq(lDec, norm, "simple-encode -> lib-decode roundtrip failed");
    }

    function testFuzz_cross_roundtrip_lib_encode_simple_decode(bytes4 id) public view {
        bytes4 norm = lib.normalize(id);
        bytes11 lEnc = lib.encode(norm);
        bytes4 sDec = simple.decode(string(abi.encodePacked(lEnc)));
        assertEq(sDec, norm, "lib-encode -> simple-decode roundtrip failed");
    }

    // ════════════════════════════════════════════════════════════════
    //  Gas benchmarks (run with --gas-report)
    //  These call each implementation so the gas report shows per-contract costs.
    // ════════════════════════════════════════════════════════════════

    function test_gas_simple_encode() public view {
        simple.encode(bytes4(0x12345678), bytes1("-"));
    }

    function test_gas_lib_encode() public view {
        lib.encode(bytes4(0x12345678));
    }

    function test_gas_simple_decode() public view {
        simple.decode("lidoh-mafuv");
    }

    function test_gas_lib_decode() public view {
        lib.decode(bytes11("lidoh-mafuv"));
    }

    function test_gas_simple_encode1() public view {
        simple.encode(bytes4(0x12340000), bytes1("-"));
    }

    function test_gas_lib_encode1() public view {
        lib.encode1(bytes2(0x1234));
    }

    function test_gas_lib_decode1() public view {
        lib.decode1(bytes5("lidoh"));
    }
}
