// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import {Base64} from "solady/utils/Base64.sol";
import {LibString} from "solady/utils/LibString.sol";
import {LibProquint} from "./LibProquint.sol";
import {Blockies} from "./Blockies.sol";

/**
 * @title TokenURI
 * @notice Generates on-chain metadata and SVG artwork for proquint NFTs using Blockies identicons.
 * @dev Returns a `data:application/json` URI with embedded base64 SVG image.
 */
contract TokenURI {
    using LibString for string;
    using LibString for uint256;

    /**
     * @notice Build a fully on-chain ERC-721 metadata JSON URI.
     * @param tokenId ERC-721 token ID (`uint256(uint32(bytes4 ID))`).
     * @param owner Current owner address (used for Blockies generation).
     * @return data URI containing JSON metadata with embedded SVG image.
     */
    function tokenURI(uint256 tokenId, address owner) public pure returns (string memory) {
        bytes4 proquintId = bytes4(uint32(tokenId));
        bytes4 ID = LibProquint.normalize(proquintId);
        string memory hexId = LibString.toHexString(abi.encodePacked(ID));
        bytes5 p1Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) >> 16)));
        bytes5 p2Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) & 0xFFFF)));
        string memory p1 = string(abi.encodePacked(p1Bytes));
        string memory p2 = string(abi.encodePacked(p2Bytes));
        string memory fullName = string.concat(p1, "-", p2);
        
        (string memory blockiesSvg, string memory bgColor) = Blockies.generate(owner);
        
        string memory svg = string.concat(
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
        
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));
        
        string memory attributes = string.concat(
            '{"trait_type":"Name","value":"',
            fullName,
            '"},{"trait_type":"Length","value":"11"},{"trait_type":"Bytes4","value":"',
            hexId,
            '"},{"trait_type":"Symmetric","value":"',
            LibProquint.isTwin(ID) ? "true" : "false",
            '"},{"trait_type":"P1","value":"',
            p1,
            '"},{"trait_type":"P2","value":"',
            p2,
            '"}'
        );
        
        return string.concat(
            "data:application/json,",
            string.concat(
                '{"name":"',
                fullName,
                '","description":"Proquint - human-readable pronouncable identifier",',
                '"image":"',
                image,
                '","attributes":[',
                attributes,
                "]}"
            )
        );
    }
}
