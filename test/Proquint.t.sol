// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.15;

import "forge-std/Test.sol";
import "src/Proquint.sol";

contract ProquintTest is Test {
    Proquint proquint;

    function setUp() public {
        proquint = new Proquint();
        payable(address(0)).transfer(1);
    }

    function testOne() public {
        bytes4 p = 0x00000000;
        string memory n = proquint.encode(p, bytes1("-"));
        assertEq(n, string("babab-babab"));
    }

    function test16max() public {
        bytes32 x = blockhash(block.number - 1);
        for (uint32 i = 1; i < type(uint16).max; i++) {
            x = keccak256(abi.encodePacked(i, x));
            string memory n = proquint.encode(bytes4(x), bytes1("-"));
            assertEq(bytes4(x), proquint.decode(n));
            console.log(n);
        }
    }
}
/*

    function test3() public {
        uint32 x = 3;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }

    function test4() public {
        uint32 x = 4;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }

    function tes5() public {
        uint32 x = 5;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }

    function test6() public {
        uint32 x = 6;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test7() public {
        uint32 x = 7;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test8() public {
        uint32 x = 8;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test9() public {
        uint32 x = 9;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test10() public {
        uint32 x = 10;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test11() public {
        uint32 x = 11;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test12() public {
        uint32 x = 12;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test13() public {
        uint32 x = 13;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test14() public {
        uint32 x = 14;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test15() public {
        uint32 x = 15;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    }
    function test16() public {
        uint32 x = 16;
        uint32 i = type(uint16).max + (150000 * (x-1));
        uint32 j = type(uint16).max + (150000 * x);
        while (i < j) {
            string memory n = proquint.encode(bytes4(i), bytes1("-"));
            assertEq(bytes4(i++), proquint.decode(n));
        }
    } */
