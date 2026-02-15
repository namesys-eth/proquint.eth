// SPDX-License-Identifier: WTFPL.ETH
pragma solidity ^0.8.30;

import {LibString} from "solady/utils/LibString.sol";

/**
 * @title LibPhonetic
 * @notice NATO phonetic alphabet converter for proquint labels.
 * @dev Maps each lowercase letter to its NATO word (e.g. `b` → `Bravo`).
 */
abstract contract LibPhonetic {
    string internal constant CSV =
        "Alfa,Bravo,Charlie,Delta,Echo,Foxtrot,Golf,Hotel,India,Juliett,Kilo,Lima,Mike,November,Oscar,Papa,Quebec,Romeo,Sierra,Tango,Uniform,Victor,Whiskey,Xray,Yankee,Zulu";
    string[] internal LOOKUP = LibString.split(CSV, ",");

    /**
     * @notice Convert a proquint label to its NATO phonetic spelling.
     * @param proquint Hyphen-separated proquint label (e.g. `babab-dabab`).
     * @return NATO phonetic string (e.g. `Bravo-Alfa-Bravo-Alfa-Bravo Delta-Alfa-...`).
     */
    function toPhonetic(string memory proquint) internal view returns (string memory) {
        string[] memory parts = LibString.split(proquint, "-");
        string memory result = "";
        for (uint256 i = 0; i < parts.length; i++) {
            if (i > 0) result = string.concat(result, " ");
            bytes memory chars = bytes(parts[i]);
            for (uint256 j = 0; j < chars.length; j++) {
                if (j > 0) result = string.concat(result, "-");
                result = string.concat(result, LOOKUP[uint256(uint8(chars[j])) - 0x61]);
            }
        }
        return result;
    }
}
