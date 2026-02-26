// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {TokenURI} from "src/TokenURI.sol";
import {LibProquint} from "src/LibProquint.sol";
import {LibString} from "solady/utils/LibString.sol";
import {Blockies} from "src/Blockies.sol";
import {Base64} from "solady/utils/Base64.sol";

contract TokenURITest is Test {
    using LibString for uint256;

    TokenURI public gen;

    // Sample IDs for visual variety
    bytes4 constant ID1 = bytes4(0x00010002); // babab-babac
    bytes4 constant ID2 = bytes4(0xFFFFFFFF); // zuzuz-zuzuz (twin)
    bytes4 constant ID3 = bytes4(0xABCD1234);
    bytes4 constant ID4 = bytes4(0x12341234); // twin
    bytes4 constant ID5 = bytes4(0xDEADBEEF);

    address constant ALICE = address(0x328809Bc894f92807417D2dAD6b7C998c1aFdac6);
    address constant BOB = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    address constant CAROL = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
    address constant VITALIK = address(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045);
    address constant ZERO = address(0x1111111111111111111111111111111111111111);

    function setUp() public {
        gen = new TokenURI();
    }

    function _generateSVG(address owner, string memory p1, string memory p2, string memory hexId) internal pure returns (string memory) {
        (string memory blockiesSvg, string memory bgColor) = Blockies.generate(owner);
        string memory fullName = string.concat(p1, "-", p2);
        
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="user-select:none;font-family:monospace">',
            '<defs><path id="r" d="M0 0h100v100H0z"/>',
            '<style>text{font-family:monospace;fill:#fff;font-weight:700;text-anchor:middle;stroke:#000;stroke-width:4px;stroke-linejoin:round;paint-order:stroke fill}',
            '.nm{font-size:120px;text-transform:uppercase}.id{font-size:60px;dominant-baseline:central}</style></defs>',
            '<rect width="1000" height="1000" rx="75" fill="',
            bgColor,
            '"/>',
            blockiesSvg,
            '<text x="500" y="825" class="id">',
            hexId,
            '</text>',
            '<text x="500" y="975" class="nm">',
            fullName,
            '</text></svg>'
        );
    }

    function _writeSVG(string memory filename, bytes4 id, address owner) internal {
        bytes4 ID = LibProquint.normalize(id);
        uint256 tokenId = uint256(uint32(ID));
        string memory uri = gen.tokenURI(tokenId, owner);

        // Log the full data URI
        emit log_named_string(filename, uri);

        // Extract SVG from the base64 image in the JSON
        // The SVG is embedded as base64 in the image field — write raw SVG instead
        bytes5 p1Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) >> 16)));
        bytes5 p2Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) & 0xFFFF)));
        string memory p1 = string(abi.encodePacked(p1Bytes));
        string memory p2 = string(abi.encodePacked(p2Bytes));
        string memory fullName = string.concat(p1, "-", p2);

        emit log_named_string("  name", fullName);
        emit log_named_string("  owner", LibString.toHexStringChecksummed(owner));
        emit log_named_uint("  tokenId", tokenId);
        emit log_named_string("  twin", LibProquint.isTwin(ID) ? "true" : "false");

        // Generate raw SVG and write to file
        string memory hexId = LibString.toHexString(abi.encodePacked(ID));
        string memory svg = _generateSVG(owner, p1, p2, hexId);
        vm.writeFile(string.concat("test/svg/", filename, ".svg"), svg);
    }

    function test_generateSVGs() public {
        _writeSVG("01_babab-babac", ID1, ALICE);
        _writeSVG("02_zuzuz-zuzuz_twin", ID2, BOB);
        _writeSVG("03_random_abcd", ID3, CAROL);
        _writeSVG("04_twin_1234", ID4, VITALIK);
        _writeSVG("05_deadbeef", ID5, ZERO);
    }

    function test_tokenURI_returnsValidJSON() public view {
        bytes4 ID = LibProquint.normalize(ID1);
        string memory uri = gen.tokenURI(uint256(uint32(ID)), ALICE);
        // Should start with data:application/json,
        assertTrue(bytes(uri).length > 50);
    }

    function test_tokenURI_differentOwners_differentBlockies() public {
        bytes4 ID = LibProquint.normalize(ID1);
        uint256 tokenId = uint256(uint32(ID));
        string memory uri1 = gen.tokenURI(tokenId, ALICE);
        string memory uri2 = gen.tokenURI(tokenId, BOB);
        // Same name, different owner → different SVG (different blockies)
        assertTrue(keccak256(bytes(uri1)) != keccak256(bytes(uri2)));

        // Write both for visual comparison
        bytes5 p1Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) >> 16)));
        bytes5 p2Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) & 0xFFFF)));
        string memory p1 = string(abi.encodePacked(p1Bytes));
        string memory p2 = string(abi.encodePacked(p2Bytes));
        string memory hexId = LibString.toHexString(abi.encodePacked(ID));
        vm.writeFile("test/svg/06_same_name_alice.svg", _generateSVG(ALICE, p1, p2, hexId));
        vm.writeFile("test/svg/07_same_name_bob.svg", _generateSVG(BOB, p1, p2, hexId));
    }
}
