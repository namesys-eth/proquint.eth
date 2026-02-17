// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

/**
 * @title LibProquint
 * @notice Proquint encode/decode and namehash only. Constants and pricing live in Core.sol.
 */
library LibProquint {
    error TokenIdOverflow();

    bytes32 private constant CONSONANT_LOOKUP = 0x62646667686A6B6C6D6E70727374767A00000000000000000000000000000000;
    bytes32 private constant VOWEL_LOOKUP = 0x61696F7500000000000000000000000000000000000000000000000000000000;
    bytes32 private constant DECODE_LOOKUP = 0x0000000100020304010506070809020a000b0c0d030e0000000f000000000000;

    /**
     * @notice Encode a 2-byte half into a 5-character proquint quint (CVCCV pattern).
     * @param id 2-byte input (one half of a proquint ID).
     * @return out 5-byte ASCII quint (e.g. `babab`).
     */
    function encode1(bytes2 id) internal pure returns (bytes5 out) {
        assembly ("memory-safe") {
            let c := CONSONANT_LOOKUP
            let v := VOWEL_LOOKUP
            let n := or(shl(8, byte(0, id)), byte(1, id))
            out := shl(
                216,
                or(
                    shl(32, byte(and(n, 0x0f), c)),
                    or(
                        shl(24, byte(and(shr(4, n), 0x03), v)),
                        or(
                            shl(16, byte(and(shr(6, n), 0x0f), c)),
                            or(shl(8, byte(and(shr(10, n), 0x03), v)), byte(and(shr(12, n), 0x0f), c))
                        )
                    )
                )
            )
        }
    }

    /**
     * @notice Encode a 4-byte proquint ID into an 11-byte label (`quint-quint`).
     * @dev Auto-normalizes: the smaller half comes first. Separator is `-` (0x2d).
     * @param id Raw 4-byte proquint ID.
     * @return out 11-byte ASCII label (e.g. `babab-dabab`).
     */
    function encode(bytes4 id) internal pure returns (bytes11 out) {
        assembly ("memory-safe") {
            let c := CONSONANT_LOOKUP
            let v := VOWEL_LOOKUP
            let i := or(shl(8, byte(0, id)), byte(1, id))
            let j := or(shl(8, byte(2, id)), byte(3, id))
            if gt(i, j) {
                let t := i
                i := j
                j := t
            }
            out := shl(
                168,
                or(
                    shl(80, byte(and(i, 0x0f), c)),
                    or(
                        shl(72, byte(and(shr(4, i), 0x03), v)),
                        or(
                            shl(64, byte(and(shr(6, i), 0x0f), c)),
                            or(
                                shl(56, byte(and(shr(10, i), 0x03), v)),
                                or(
                                    shl(48, byte(and(shr(12, i), 0x0f), c)),
                                    or(
                                        shl(40, 0x2d),
                                        or(
                                            shl(32, byte(and(j, 0x0f), c)),
                                            or(
                                                shl(24, byte(and(shr(4, j), 0x03), v)),
                                                or(
                                                    shl(16, byte(and(shr(6, j), 0x0f), c)),
                                                    or(
                                                        shl(8, byte(and(shr(10, j), 0x03), v)),
                                                        byte(and(shr(12, j), 0x0f), c)
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        }
    }

    /**
     * @notice Decode a 5-character quint back into 2 bytes.
     * @param input 5-byte ASCII quint.
     * @return out 2-byte decoded value.
     */
    function decode1(bytes5 input) internal pure returns (bytes2 out) {
        assembly ("memory-safe") {
            let a := DECODE_LOOKUP
            out := shl(
                240,
                add(
                    add(shl(12, byte(sub(byte(4, input), 97), a)), shl(10, byte(sub(byte(3, input), 97), a))),
                    add(
                        shl(6, byte(sub(byte(2, input), 97), a)),
                        add(shl(4, byte(sub(byte(1, input), 97), a)), byte(sub(byte(0, input), 97), a))
                    )
                )
            )
        }
    }

    /**
     * @notice Decode an 11-byte proquint label into a normalized 4-byte ID.
     * @dev Expects a `-` separator at position 5. Auto-normalizes (smaller half first).
     * @param input 11-byte ASCII label (e.g. `babab-dabab`).
     * @return out Normalized 4-byte proquint ID.
     */
    function decode(bytes11 input) internal pure returns (bytes4 out) {
        assembly ("memory-safe") {
            if iszero(eq(byte(5, input), 0x2d)) {
                // "-"
                mstore(0x00, 0x5c427cd9)
                revert(0x1c, 0x04)
            }
            let a := DECODE_LOOKUP
            let i :=
                add(
                    add(shl(12, byte(sub(byte(4, input), 97), a)), shl(10, byte(sub(byte(3, input), 97), a))),
                    add(
                        shl(6, byte(sub(byte(2, input), 97), a)),
                        add(shl(4, byte(sub(byte(1, input), 97), a)), byte(sub(byte(0, input), 97), a))
                    )
                )
            let j :=
                add(
                    add(shl(12, byte(sub(byte(10, input), 97), a)), shl(10, byte(sub(byte(9, input), 97), a))),
                    add(
                        shl(6, byte(sub(byte(8, input), 97), a)),
                        add(shl(4, byte(sub(byte(7, input), 97), a)), byte(sub(byte(6, input), 97), a))
                    )
                )
            if gt(i, j) {
                let t := i
                i := j
                j := t
            }
            out := shl(224, or(shl(16, i), j))
        }
    }

    /**
     * @notice Check if a proquint ID is symmetric (palindrome: both halves are identical).
     * @param id Raw 4-byte proquint ID.
     * @return out True if `id[0:2] == id[2:4]` (byte-reversed).
     */
    function isSymmetric(bytes4 id) internal pure returns (bool out) {
        assembly ("memory-safe") {
            out := and(eq(byte(0, id), byte(3, id)), eq(byte(1, id), byte(2, id)))
        }
    }

    /**
     * @notice Normalize a proquint ID so the smaller 2-byte half comes first.
     * @dev Canonical form ensures `encode(normalize(id))` always produces the same label.
     * @param id Raw 4-byte proquint ID.
     * @return out Normalized ID with `out[0:2] <= out[2:4]`.
     */
    function normalize(bytes4 id) internal pure returns (bytes4 out) {
        assembly ("memory-safe") {
            let j := or(shl(8, byte(0, id)), byte(1, id))
            let k := or(shl(8, byte(2, id)), byte(3, id))
            if gt(j, k) {
                let t := j
                j := k
                k := t
            }
            out := shl(224, or(shl(16, j), k))
        }
    }

    /**
     * @notice Encode + compute ENS-style namehash for a proquint ID.
     * @dev Normalizes the ID, encodes to label, then computes `keccak256(0x00..00 || keccak256(label))`.
     * @param id Raw 4-byte proquint ID.
     * @return label 11-byte ASCII label.
     * @return node ENS-compatible namehash.
     */
    function hashID(bytes4 id) internal pure returns (bytes11 label, bytes32 node) {
        label = encode(id);
        assembly ("memory-safe") {
            mstore(0x00, label)
            let labelhash := keccak256(0x00, 0x0b)
            mstore(0x00, 0)
            mstore(0x20, labelhash)
            node := keccak256(0x00, 0x40)
        }
    }

    /**
     * @notice Compute ENS-style namehash for a proquint ID (normalized).
     * @param id Raw 4-byte proquint ID (auto-normalized).
     * @return node ENS-compatible namehash.
     */
    function namehash4(bytes4 id) internal pure returns (bytes32 node) {
        bytes11 label = encode(id);
        assembly ("memory-safe") {
            mstore(0x00, label)
            let labelhash := keccak256(0x00, 0x0b)
            mstore(0x00, 0)
            mstore(0x20, labelhash)
            node := keccak256(0x00, 0x40)
        }
    }

    /**
     * @notice Compute ENS-style namehash from a pre-encoded 11-byte label.
     * @param label 11-byte ASCII proquint label.
     * @return node ENS-compatible namehash.
     */
    function namehash(bytes11 label) internal pure returns (bytes32 node) {
        assembly ("memory-safe") {
            mstore(0x00, label)
            let labelhash := keccak256(0x00, 0x0b)
            mstore(0x00, 0)
            mstore(0x20, labelhash)
            node := keccak256(0x00, 0x40)
        }
    }
}
