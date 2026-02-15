// SPDX-License-Identifier: WTFPL.ETH
pragma solidity >0.8.18 <0.9.0;

/**
 * @title Proquint
 * @notice Legacy reference implementation of proquint encode/decode (non-optimized).
 * @dev Kept for compatibility. See LibProquint for the gas-optimized assembly version.
 */
contract Proquint {
    /**
     * @notice Encode a 4-byte value into a proquint string with a custom delimiter.
     * @dev Reference: https://github.com/deoxxa/proquint/blob/master/encode.js
     * @param input 4-byte value to encode.
     * @param d Delimiter byte (e.g. `-` or `.`).
     * @return 11-character proquint string.
     */
    function encode(bytes4 input, bytes1 d) external pure returns (string memory) {
        unchecked {
            bytes16 c16 = bytes16("bdfghjklmnprstvz");
            bytes4 v4 = bytes4("aiou");
            uint256 n = uint16(bytes2(abi.encodePacked(input[0], input[1])));
            bytes5 p1 = bytes5(
                bytes.concat(
                    c16[n & 0x0f],
                    v4[(n >> 4) & 0x03],
                    c16[(n >> 6) & 0x0f],
                    v4[(n >> 10) & 0x03],
                    c16[(n >> 12) & 0x0f]
                )
            );
            n = uint16(bytes2(abi.encodePacked(input[2], input[3])));
            bytes5 p2 = bytes5(
                bytes.concat(
                    c16[n & 0x0f],
                    v4[(n >> 4) & 0x03],
                    c16[(n >> 6) & 0x0f],
                    v4[(n >> 10) & 0x03],
                    c16[(n >> 12) & 0x0f]
                )
            );
            return string(bytes.concat(p1, d, p2));
        }
    }

    /**
     * @notice Decode an 11-character proquint string back into 4 bytes.
     * @dev Reference: https://github.com/deoxxa/proquint/blob/master/decode.js
     * @param input 11-character proquint string (separator: `.` or `-`).
     * @return Decoded 4-byte value.
     */
    function decode(string memory input) external pure returns (bytes4) {
        unchecked {
            bytes26 alpha = hex"0000fa01fb020304010506070809020afc0b0c0d030efdfeff0f";
            bytes memory buf = bytes(input);
            require(buf.length == 11, "BAD_LENGTH");
            require(buf[5] == "." || buf[5] == "-", "BAD_SEPARATOR");
            bytes2 p1 = bytes2(
                uint16(uint8(alpha[uint8(buf[0]) - 97])) + (uint16(uint8(alpha[uint8(buf[1]) - 97])) << 4)
                    + (uint16(uint8(alpha[uint8(buf[2]) - 97])) << 6) + (uint16(uint8(alpha[uint8(buf[3]) - 97])) << 10)
                    + (uint16(uint8(alpha[uint8(buf[4]) - 97])) << 12)
            );
            bytes2 p2 = bytes2(
                uint16(uint8(alpha[uint8(buf[6]) - 97])) + (uint16(uint8(alpha[uint8(buf[7]) - 97])) << 4)
                    + (uint16(uint8(alpha[uint8(buf[8]) - 97])) << 6) + (uint16(uint8(alpha[uint8(buf[9]) - 97])) << 10)
                    + (uint16(uint8(alpha[uint8(buf[10]) - 97])) << 12)
            );
            return bytes4(abi.encodePacked(p1, p2));
        }
    }
}
