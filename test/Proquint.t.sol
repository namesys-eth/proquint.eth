// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.15;

import "forge-std/Test.sol";
import "src/Proquint.sol";

contract ProquintTest is Test {
    Proquint proquint;

    function setUp() public {
        proquint = new Proquint();
    }

    function test_encode_zero() public view {
        string memory n = proquint.encode(bytes4(0), bytes1("-"));
        assertEq(n, "babab-babab");
    }

    function test_encode_max() public view {
        string memory n = proquint.encode(bytes4(type(uint32).max), bytes1("-"));
        assertEq(bytes(n).length, 11);
        assertEq(bytes(n)[5], bytes1("-"));
    }

    function test_encode_dotSeparator() public view {
        string memory n = proquint.encode(bytes4(0), bytes1("."));
        assertEq(n, "babab.babab");
    }

    function testFuzz_roundtrip(bytes4 input) public view {
        string memory encoded = proquint.encode(input, bytes1("-"));
        bytes4 decoded = proquint.decode(encoded);
        assertEq(decoded, input);
    }

    function testFuzz_encode_length(bytes4 input) public view {
        string memory encoded = proquint.encode(input, bytes1("-"));
        assertEq(bytes(encoded).length, 11);
        assertEq(bytes(encoded)[5], bytes1("-"));
    }

    function test_decode_revert_badLength() public {
        vm.expectRevert("BAD_LENGTH");
        proquint.decode("babab");
    }

    function test_decode_revert_badSeparator() public {
        vm.expectRevert("BAD_SEPARATOR");
        proquint.decode("babab_babab");
    }

    function test_decode_dotSeparator() public view {
        bytes4 decoded = proquint.decode("babab.babab");
        assertEq(decoded, bytes4(0));
    }
}
