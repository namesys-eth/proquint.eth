// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import "solady/utils/LibString.sol";

/**
 * @title Blockies
 * @notice Generates deterministic identicon SVG graphics from Ethereum addresses
 * @dev Based on @wighawag's Blockies NFT implementation
 *      https://github.com/wighawag/blockies-nft/blob/main/src/Blockies.sol
 *      ~50% optimized by mirroring left to right & skipping background pixels
 */
library Blockies {
    using LibString for *;

    /**
     * @dev Initializes PRNG state from seed bytes
     * @param seed Input bytes (typically hex-encoded address)
     * @return packed Four int32 lanes packed into bytes32
     */
    function _seedrand(bytes memory seed) internal pure returns (bytes32 packed) {
        unchecked {
            uint256 len = seed.length;
            if (len == 0) return bytes32(0);
            assembly ("memory-safe") {
                let s0 := 0
                let s1 := 0
                let s2 := 0
                let s3 := 0
                let seedPtr := add(seed, 0x20)
                for { let i := 0 } lt(i, len) { i := add(i, 1) } {
                    let v := byte(0, mload(add(seedPtr, i)))
                    switch and(i, 3)
                    case 0 { s0 := signextend(3, add(sub(shl(5, s0), s0), v)) }
                    case 1 { s1 := signextend(3, add(sub(shl(5, s1), s1), v)) }
                    case 2 { s2 := signextend(3, add(sub(shl(5, s2), s2), v)) }
                    default { s3 := signextend(3, add(sub(shl(5, s3), s3), v)) }
                }
                packed := or(
                    or(and(s0, 0xffffffff), shl(32, and(s1, 0xffffffff))),
                    or(shl(64, and(s2, 0xffffffff)), shl(96, and(s3, 0xffffffff)))
                )
            }
        }
    }

    /**
     * @dev Xorshift128 PRNG step
     * @param packed Current PRNG state
     * @return r Random uint256 value
     * @return s Next PRNG state
     */
    function _rand(bytes32 packed) internal pure returns (uint256 r, bytes32 s) {
        assembly ("memory-safe") {
            let x := packed
            let s0 := signextend(3, and(x, 0xffffffff))
            let s1 := signextend(3, and(shr(32, x), 0xffffffff))
            let s2 := signextend(3, and(shr(64, x), 0xffffffff))
            let s3 := signextend(3, and(shr(96, x), 0xffffffff))

            let t := signextend(3, and(xor(s0, shl(11, s0)), 0xffffffff))

            s0 := s1
            s1 := s2
            s2 := s3

            s3 := xor(s3, sar(19, s3))
            s3 := signextend(3, and(xor(xor(s3, t), sar(8, t)), 0xffffffff))

            r := and(s3, 0xffffffff)

            s := or(
                or(or(and(s0, 0xffffffff), shl(32, and(s1, 0xffffffff))), shl(64, and(s2, 0xffffffff))),
                shl(96, and(s3, 0xffffffff))
            )
        }
    }

    /**
     * @dev Generates HSL color string from PRNG state
     * @param seed Current PRNG state
     * @return _out HSL color string (e.g., "hsl(180,50%,25%)")
     * @return s Next PRNG state
     */
    function _setColor(bytes32 seed) internal pure returns (string memory _out, bytes32 s) {
        uint256 r;
        (r, s) = _rand(seed);
        uint16 hue = uint16((r * 360) / 2147483648);
        (r, s) = _rand(s);
        uint8 saturation = uint8((r * 60) / 2147483648 + 40);
        uint256 acc;
        (r, s) = _rand(s);
        acc = r;
        (r, s) = _rand(s);
        acc += r;
        (r, s) = _rand(s);
        acc += r;
        (r, s) = _rand(s);
        _out = string.concat(
            "hsl(",
            uint256(hue).toString(),
            ",",
            uint256(saturation).toString(),
            "%",
            ",",
            uint256(uint8(((acc + r) * 25) / 2147483648)).toString(),
            "%)"
        );
    }

    /**
     * @notice Generates a Blockies identicon SVG fragment for an address
     * @dev Creates an 8x8 mirrored pixel grid with deterministic colors
     * @param who The Ethereum address to generate identicon for
     * @return svg SVG fragment (rect + groups) without outer <svg> tag
     * @return bgColor Background HSL color string (e.g. "hsl(180,50%,25%)")
     */
    function generate(address who) internal pure returns (string memory svg, string memory bgColor) {
        bytes memory seed = bytes(LibString.toHexString(who));
        bytes32 s = _seedrand(seed);
        string[] memory _colors = new string[](3);
        (_colors[1], s) = _setColor(s);
        (_colors[0], s) = _setColor(s);
        (_colors[2], s) = _setColor(s);

        string[] memory data = new string[](3);
        string memory z;
        uint256 r;
        for (uint256 y = 0; y < 8; y++) {
            (r, s) = _rand(s);
            uint8 p0 = uint8(((r * 23) / 2147483648) / 10);
            (r, s) = _rand(s);
            uint8 p1 = uint8(((r * 23) / 2147483648) / 10);
            (r, s) = _rand(s);
            uint8 p2 = uint8(((r * 23) / 2147483648) / 10);
            (r, s) = _rand(s);
            uint8 p3 = uint8(((r * 23) / 2147483648) / 10);
            z = ((y * 100) + 75).toString();
            if (p0 > 0) data[p0] = string.concat(data[p0], '<use href="#r" x="100" y="', z, '"/>');
            if (p1 > 0) data[p1] = string.concat(data[p1], '<use href="#r" x="200" y="', z, '"/>');
            if (p2 > 0) data[p2] = string.concat(data[p2], '<use href="#r" x="300" y="', z, '"/>');
            if (p3 > 0) data[p3] = string.concat(data[p3], '<use href="#r" x="400" y="', z, '"/>');
        }
        bgColor = _colors[0];
        svg = string.concat(
            '<g id="k"><g fill="',
            _colors[1],
            '">',
            data[1],
            '</g><g fill="',
            _colors[2],
            '">',
            data[2],
            '</g></g><use href="#k" transform="scale(-1,1)" transform-origin="500 500"/>'
        );
    }
}
