// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { MockV3Aggregator } from "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";
import { ConsiliumMarketFactory } from "../src/ConsiliumMarketFactory.sol";
import { ConsiliumMarket } from "../src/ConsiliumMarket.sol";
import { CUSDC } from "../src/CUSDC.sol";

/// @notice Deploys ConsiliumMarketFactory (and CUSDC + a MockV3Aggregator only on local Anvil
///         31337), then creates the demo liquidation-risk market through the factory pointing at the
///         REAL Chainlink ETH/USD feed on Base Sepolia. Writes addresses to deployments/<chainId>.json.
///         Params from env (verify all at build time):
///           USDC_ADDRESS, PRICE_FEED_ADDRESS, SEQUENCER_UPTIME_FEED (optional → address(0)),
///           LIQUIDATION_PRICE_8DP, DIRECTION (0=DOWN), DEADLINE_SECONDS,
///           POSITION_ADDRESS, COLLATERAL_TOKEN.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        int256 liquidationPrice = vm.envOr("LIQUIDATION_PRICE_8DP", int256(124_400_000_000)); // ~$1244 (P's real liq price)
        uint8 direction = uint8(vm.envOr("DIRECTION", uint256(0))); // 0 = DOWN
        uint64 deadline = uint64(block.timestamp + vm.envOr("DEADLINE_SECONDS", uint256(1 days)));

        ConsiliumMarket.PositionRef memory positionRef = ConsiliumMarket.PositionRef({
            position: vm.envOr("POSITION_ADDRESS", address(0)),
            collateral: vm.envOr("COLLATERAL_TOKEN", address(0)),
            liqThresholdBps: 8300,
            sourceChainId: 1
        });

        vm.startBroadcast(pk);

        IERC20 usdc;
        AggregatorV3Interface priceFeed;
        AggregatorV3Interface sequencerFeed =
            AggregatorV3Interface(vm.envOr("SEQUENCER_UPTIME_FEED", address(0)));

        if (block.chainid == 31337) {
            usdc = IERC20(address(new CUSDC()));
            priceFeed = AggregatorV3Interface(address(new MockV3Aggregator(8, 1_664_00000000))); // local mock @ ~$1664
            console2.log("CUSDC (local):", address(usdc));
            console2.log("MockV3Aggregator (local):", address(priceFeed));
        } else {
            usdc = IERC20(vm.envAddress("USDC_ADDRESS"));
            priceFeed = AggregatorV3Interface(vm.envAddress("PRICE_FEED_ADDRESS"));
        }

        ConsiliumMarketFactory factory = new ConsiliumMarketFactory();
        address market = factory.createMarket(
            usdc, priceFeed, sequencerFeed, liquidationPrice, direction, deadline, positionRef
        );

        vm.stopBroadcast();

        console2.log("chainId:", block.chainid);
        console2.log("ConsiliumMarketFactory:", address(factory));
        console2.log("ConsiliumMarket:", market);
        console2.log("USDC:", address(usdc));
        console2.log("priceFeed:", address(priceFeed));
        console2.log("sequencerFeed:", address(sequencerFeed));
        console2.log("liquidationPrice (8dp):", uint256(liquidationPrice));
        console2.log("deadline:", deadline);

        _writeDeployment(
            address(factory),
            market,
            address(usdc),
            address(priceFeed),
            address(sequencerFeed),
            liquidationPrice,
            deadline,
            positionRef
        );
    }

    function _writeDeployment(
        address factory,
        address market,
        address usdc,
        address priceFeed,
        address sequencerFeed,
        int256 liquidationPrice,
        uint64 deadline,
        ConsiliumMarket.PositionRef memory positionRef
    ) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "factory", factory);
        vm.serializeAddress(key, "usdc", usdc);
        vm.serializeAddress(key, "priceFeed", priceFeed);
        vm.serializeAddress(key, "sequencerFeed", sequencerFeed);
        vm.serializeInt(key, "liquidationPrice", liquidationPrice);
        vm.serializeUint(key, "deadline", deadline);
        vm.serializeAddress(key, "position", positionRef.position);
        string memory json = vm.serializeAddress(key, "market", market);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Wrote", path);
    }
}
