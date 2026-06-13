// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { ConsiliumMarket } from "./ConsiliumMarket.sol";

/// @title ConsiliumMarketFactory
/// @notice Permissionless factory for ConsiliumMarket. Anyone can spin up a liquidation-risk market
///         for a position; each creation is its own onchain event with a real tx hash, so market
///         creation itself is verifiable. The market contract is unchanged — the factory deploys and
///         indexes instances.
contract ConsiliumMarketFactory {
    address[] public allMarkets;
    mapping(address creator => address[] markets) private _marketsByCreator;

    error InvalidDeadline();

    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed position,
        address priceFeed,
        int256 liquidationPrice,
        uint8 direction,
        uint64 deadline
    );

    /// @notice Deploy a new ConsiliumMarket. Permissionless; `msg.sender` is recorded as creator.
    function createMarket(
        IERC20 usdc,
        AggregatorV3Interface priceFeed,
        AggregatorV3Interface sequencerFeed,
        int256 liquidationPrice,
        uint8 direction,
        uint64 deadline,
        ConsiliumMarket.PositionRef calldata positionRef
    ) external returns (address market) {
        if (deadline <= block.timestamp) {
            revert InvalidDeadline();
        }

        market = address(
            new ConsiliumMarket(
                usdc, priceFeed, sequencerFeed, liquidationPrice, direction, deadline, positionRef
            )
        );

        allMarkets.push(market);
        _marketsByCreator[msg.sender].push(market);

        emit MarketCreated(
            market,
            msg.sender,
            positionRef.position,
            address(priceFeed),
            liquidationPrice,
            direction,
            deadline
        );
    }

    function allMarketsLength() external view returns (uint256) {
        return allMarkets.length;
    }

    function marketsOf(address creator) external view returns (address[] memory) {
        return _marketsByCreator[creator];
    }
}
