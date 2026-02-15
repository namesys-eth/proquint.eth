// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

/**
 * @title IRegistry
 * @notice Registry-specific interface with overloaded resolution functions.
 * @dev Separated from IProquint to avoid overload ambiguity in tooling/ABIs.
 *      Supports both ENS-style namehash (bytes32) and raw proquint ID (bytes4) lookups.
 */
interface IRegistry {
    /// @notice Resolve namehash to owner (address(0) if expired past grace).
    function owner(bytes32 node) external view returns (address);

    /// @notice Resolve raw proquint ID to owner (address(0) if expired past grace).
    function owner(bytes4 id) external view returns (address);

    /// @notice Check if record exists by namehash (within grace period).
    function recordExists(bytes32 node) external view returns (bool);

    /// @notice Check if record exists by raw proquint ID (within grace period).
    function recordExists(bytes4 id) external view returns (bool);
}
