// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title CUSDC (Consilium USDC)
/// @notice 6-decimal ERC20 with a public `mint`, for LOCAL ANVIL ONLY. On Base Sepolia use the
///         real Circle test USDC so the demo is legitimately onchain (see CONSOLIUM_BUILD.MD §4).
contract CUSDC is ERC20 {
    constructor() ERC20("Consilium USD Coin", "CUSDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
