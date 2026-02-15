// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "src/ProquintNFT.sol";

contract ProquintDeploy is Script {
    /// @dev : Deploy
    function run() external {
        vm.startBroadcast();
        new ProquintNFT(msg.sender);
        vm.stopBroadcast();
    }
}
