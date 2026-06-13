// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { ConsiliumMarket } from "../src/ConsiliumMarket.sol";
import { CUSDC } from "../src/CUSDC.sol";
import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { MockV3Aggregator } from "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";

/// @notice Contract-level backstop for THE REVERT money-moment (CONSOLIUM_BUILD.MD §6.4).
/// The real enforcer revert is exercised at the trader→executor hop by the integration script
/// (`overcap.ts`). Here we prove the push-model math: the market only credits USDC actually moved
/// into it. An agent whose (capped) transfer delivered `CAP` cannot stake `CAP + 1` — `stake()`
/// reverts `Unfunded`. Combined with the `ERC20TransferAmount` enforcer capping the transfer
/// upstream, the chain enforces the budget end-to-end.
contract RevertTest is Test {
    CUSDC usdc;
    ConsiliumMarket market;
    MockV3Aggregator priceFeed;

    address agent = makeAddr("agent");
    uint8 internal constant YES = 1;
    uint8 internal constant DOWN = 0;
    uint256 constant CAP = 20e6;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new CUSDC();
        priceFeed = new MockV3Aggregator(8, 1664e8);
        ConsiliumMarket.PositionRef memory pr = ConsiliumMarket.PositionRef({
            position: makeAddr("position"),
            collateral: makeAddr("WETH"),
            liqThresholdBps: 8300,
            sourceChainId: 1
        });
        market = new ConsiliumMarket(
            usdc,
            AggregatorV3Interface(address(priceFeed)),
            AggregatorV3Interface(address(0)),
            1500e8,
            DOWN,
            uint64(block.timestamp + 1 hours),
            pr
        );
        usdc.mint(agent, 1_000e6);
    }

    function test_StakeAtCap_Succeeds() public {
        vm.prank(agent);
        usdc.transfer(address(market), CAP);
        vm.prank(agent);
        market.stake(YES, CAP);
        assertEq(market.totalStaked(YES), CAP);
    }

    function test_RevertWhen_StakeExceedsCap() public {
        // The ERC20TransferAmount enforcer caps the transfer at CAP, so only CAP arrives.
        vm.prank(agent);
        usdc.transfer(address(market), CAP);
        // Staking CAP + 1 against CAP of unaccounted balance → the chain rejects it.
        vm.prank(agent);
        vm.expectRevert(ConsiliumMarket.Unfunded.selector);
        market.stake(YES, CAP + 1);
        assertEq(market.totalStaked(YES), 0);
    }
}
