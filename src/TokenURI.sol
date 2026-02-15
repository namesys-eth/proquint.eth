// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import {Base64} from "solady/utils/Base64.sol";
import {LibString} from "solady/utils/LibString.sol";
import {LibProquint} from "./LibProquint.sol";
import {LibPhonetic} from "./LibPhonetic.sol";

/**
 * @title SVG
 * @notice On-chain SVG generator for proquint NFT artwork.
 * @dev Produces animated gradient backgrounds with per-character tile layout.
 */
library SVG {
    /**
     * @notice Derive 12 deterministic hex colors from a proquint name.
     * @param name Full proquint label (e.g. `babab-dabab`).
     * @return _output Array of 12 three-character hex color strings.
     */
    function toHexColor(string memory name) public pure returns (string[12] memory _output) {
        bytes32 hash = keccak256(abi.encodePacked(name));
        bytes memory _base = "0123456789abcdef";
        unchecked {
            for (uint256 i; i < 12; i++) {
                uint8 byte1 = uint8(hash[i * 2]);
                uint8 byte2 = uint8(hash[i * 2 + 1]);
                _output[i] = string(abi.encodePacked(_base[byte1 / 16], _base[byte1 % 16], _base[byte2 / 16]));
            }
        }
    }

    /**
     * @notice Generate a complete SVG image from two proquint quints.
     * @param p1 First 5-char quint.
     * @param p2 Second 5-char quint.
     * @return Full SVG markup string.
     */
    function generateSVGFromParts(string memory p1, string memory p2) internal pure returns (string memory) {
        string memory fullName = string.concat(p1, "-", p2);
        string[12] memory colors = toHexColor(fullName);
        return string.concat(
            _svgHeader(),
            generateDefs(),
            generateAnimatedGradient("a", colors[0], colors[1], colors[2], colors[3]),
            generateAnimatedGradient("b", colors[4], colors[5], colors[6], colors[7]),
            generateAnimatedGradient("c", colors[8], colors[9], colors[10], colors[11]),
            _svgContent(p1, p2, colors),
            genScrollText(fullName),
            "</svg>"
        );
    }

    function _svgHeader() internal pure returns (string memory) {
        return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" style="user-select:none;font-family:monospace">';
    }

    function _svgContent(string memory p1, string memory p2, string[12] memory colors)
        internal
        pure
        returns (string memory)
    {
        return string.concat(
            '<rect width="100" height="100" rx="10" fill="#111"/>',
            '<rect x="5" y="5" width="90" height="90" rx="8" class="bg"/>',
            '<rect x="10" y="10" width="80" height="80" rx="5" class="bg2"/>',
            '<rect x="15" y="15" width="70" height="70" rx="5" class="bg" opacity=".9"/>',
            '<rect x="18" y="22" width="12" height="15" rx="3" fill="#',
            colors[0],
            '" opacity=".7"/><text x="24" y="29.5" class="ch">',
            string(abi.encodePacked(bytes(p1)[0])),
            "</text>",
            '<rect x="31" y="22" width="12" height="15" rx="3" fill="#',
            colors[1],
            '" opacity=".7"/><text x="37" y="29.5" class="ch">',
            string(abi.encodePacked(bytes(p1)[1])),
            "</text>",
            '<rect x="44" y="22" width="12" height="15" rx="3" fill="#',
            colors[2],
            '" opacity=".7"/><text x="50" y="29.5" class="ch">',
            string(abi.encodePacked(bytes(p1)[2])),
            "</text>",
            '<rect x="57" y="22" width="12" height="15" rx="3" fill="#',
            colors[3],
            '" opacity=".7"/><text x="63" y="29.5" class="ch">',
            string(abi.encodePacked(bytes(p1)[3])),
            "</text>",
            '<rect x="70" y="22" width="12" height="15" rx="3" fill="#',
            colors[4],
            '" opacity=".7"/><text x="76" y="29.5" class="ch">',
            string(abi.encodePacked(bytes(p1)[4])),
            "</text>",
            '<rect x="18" y="44" width="12" height="15" rx="3" fill="#',
            colors[5],
            '" opacity=".7"/><text x="24" y="51.5" class="ch">',
            string(abi.encodePacked(bytes(p2)[0])),
            "</text>",
            '<rect x="31" y="44" width="12" height="15" rx="3" fill="#',
            colors[6],
            '" opacity=".7"/><text x="37" y="51.5" class="ch">',
            string(abi.encodePacked(bytes(p2)[1])),
            "</text>",
            '<rect x="44" y="44" width="12" height="15" rx="3" fill="#',
            colors[7],
            '" opacity=".7"/><text x="50" y="51.5" class="ch">',
            string(abi.encodePacked(bytes(p2)[2])),
            "</text>",
            '<rect x="57" y="44" width="12" height="15" rx="3" fill="#',
            colors[8],
            '" opacity=".7"/><text x="63" y="51.5" class="ch">',
            string(abi.encodePacked(bytes(p2)[3])),
            "</text>",
            '<rect x="70" y="44" width="12" height="15" rx="3" fill="#',
            colors[9],
            '" opacity=".7"/><text x="76" y="51.5" class="ch">',
            string(abi.encodePacked(bytes(p2)[4])),
            "</text>",
            '<rect x="18" y="66" width="64" height="15" rx="4" fill="#222" stroke="#555" stroke-width=".5" opacity=".7"/>',
            '<text x="50" y="75" class="inf" fill="#ccc">',
            p1,
            "-",
            p2,
            "</text>"
        );
    }

    function genScrollText(string memory name) internal pure returns (string memory) {
        string memory scroll = string.concat(LibString.repeat(string.concat(name, " "), 4), name);
        return string.concat(
            '<text fill="url(#c)" text-rendering="optimizeSpeed" class="sc">',
            '<textPath startOffset="-100%" xlink:href="#p">',
            scroll,
            '<animate attributeName="startOffset" from="0%" to="100%" begin="0s" dur="42s" repeatCount="indefinite" additive="sum"/></textPath>',
            '<textPath startOffset="0%" xlink:href="#p">',
            scroll,
            '<animate attributeName="startOffset" from="0%" to="100%" begin="0s" dur="42s" repeatCount="indefinite" additive="sum"/></textPath>',
            "</text>"
        );
    }

    function generateAnimatedGradient(
        string memory id,
        string memory color1,
        string memory color2,
        string memory color3,
        string memory color4
    ) internal pure returns (string memory) {
        bytes memory idBytes = bytes(id);
        string memory direction =
            idBytes[0] == 0x62 ? 'x1="100%" y1="0%" x2="0%" y2="100%"' : 'x1="0%" y1="0%" x2="100%" y2="100%"';
        string memory duration = idBytes[0] == 0x62 ? "5s" : "10s";
        return string.concat(
            '<linearGradient id="',
            id,
            '" ',
            direction,
            ">",
            '<stop offset="0%" stop-color="#',
            color1,
            '"><animate attributeName="stop-color" values="#',
            color1,
            ";#",
            color2,
            ";#",
            color3,
            ";#",
            color4,
            ";#",
            color1,
            '" dur="',
            duration,
            '" repeatCount="indefinite"/></stop>',
            '<stop offset="33%" stop-color="#',
            color2,
            '"><animate attributeName="stop-color" values="#',
            color2,
            ";#",
            color3,
            ";#",
            color4,
            ";#",
            color1,
            ";#",
            color2,
            '" dur="',
            duration,
            '" repeatCount="indefinite"/></stop>',
            '<stop offset="66%" stop-color="#',
            color3,
            '"><animate attributeName="stop-color" values="#',
            color3,
            ";#",
            color4,
            ";#",
            color1,
            ";#",
            color2,
            ";#",
            color3,
            '" dur="',
            duration,
            '" repeatCount="indefinite"/></stop>',
            '<stop offset="100%" stop-color="#',
            color4,
            '"><animate attributeName="stop-color" values="#',
            color4,
            ";#",
            color1,
            ";#",
            color2,
            ";#",
            color3,
            ";#",
            color4,
            '" dur="',
            duration,
            '" repeatCount="indefinite"/></stop>',
            "</linearGradient>"
        );
    }

    function generateDefs() internal pure returns (string memory) {
        return string.concat(
            "<defs>",
            '<filter id="s"><feDropShadow dx=".5" dy=".5" stdDeviation=".5" flood-color="rgba(0,0,0,.5)"/></filter>',
            '<path id="p" d="M12,4 H88 A8,8 0 0 1 96,12 V88 A8,8 0 0 1 88,96 H12 A8,8 0 0 1 4,88 V12 A8,8 0 0 1 12,4 Z"/>',
            "<style>.bg{fill:url(#a)}.bg2{fill:url(#b)}.ch{fill:#fff;text-anchor:middle;font-size:14px;font-weight:bold;text-transform:uppercase;filter:url(#s);dominant-baseline:central;font-family:monospace}.sc{font-size:1.95px;filter:url(#s);text-transform:uppercase;font-family:monospace}.inf{font-family:monospace;font-size:6px;filter: url(#s);font-weight:normal;text-anchor:middle}</style>",
            "</defs>"
        );
    }
}

/**
 * @title TokenURI
 * @notice Generates on-chain metadata and SVG artwork for proquint NFTs.
 * @dev Returns a `data:application/json` URI with embedded base64 SVG image.
 */
contract TokenURI is LibPhonetic {
    using LibString for string;
    using LibString for uint256;

    /**
     * @notice Build a fully on-chain ERC-721 metadata JSON URI.
     * @param tokenId ERC-721 token ID (`uint256(uint32(bytes4 ID))`).
     * @return data URI containing JSON metadata with embedded SVG image.
     */
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        bytes4 proquintId = bytes4(uint32(tokenId));
        bytes4 ID = LibProquint.normalize(proquintId);
        string memory hexId = LibString.toHexString(abi.encodePacked(ID));
        bytes5 p1Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) >> 16)));
        bytes5 p2Bytes = LibProquint.encode1(bytes2(uint16(uint32(ID) & 0xFFFF)));
        string memory p1 = string(abi.encodePacked(p1Bytes));
        string memory p2 = string(abi.encodePacked(p2Bytes));
        string memory fullName = string.concat(p1, "-", p2);
        string memory image =
            string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(SVG.generateSVGFromParts(p1, p2))));
        string memory attributes = string.concat(
            '{"trait_type":"Name","value":"',
            fullName,
            '"},{"trait_type":"Length","value":"11"},{"trait_type":"Bytes4","value":"',
            hexId,
            '"},{"trait_type":"Symmetric","value":"',
            LibProquint.isSymmetric(ID) ? "true" : "false",
            '"},{"trait_type":"P1","value":"',
            p1,
            '"},{"trait_type":"P2","value":"',
            p2,
            '"},{"trait_type":"Phonetic","value":"',
            // toPhonetic(fullName),
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
