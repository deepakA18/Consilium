// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { ConsiliumMarketFactory } from "../src/ConsiliumMarketFactory.sol";
import { ConsiliumMarket } from "../src/ConsiliumMarket.sol";
import { CUSDC } from "../src/CUSDC.sol";
import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { MockV3Aggregator } from "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";

contract ConsiliumMarketFactoryTest is Test {
    ConsiliumMarketFactory factory;
    CUSDC usdc;
    MockV3Aggregator priceFeed;

    address creator = makeAddr("creator");
    address other = makeAddr("other");

    uint8 internal constant YES = 1;
    uint8 internal constant DOWN = 0;
    int256 constant STRIKE = 1500e8;
    uint64 deadline;

    ConsiliumMarket.PositionRef pr = ConsiliumMarket.PositionRef({
        position: makeAddr("position"),
        collateral: makeAddr("WETH"),
        liqThresholdBps: 8300,
        sourceChainId: 1
    });

    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed position,
        address priceFeed,
        int256 liquidationPrice,
        uint8 direction,
        uint64 deadline
    );

    function setUp() public {
        vm.warp(1_700_000_000);
        factory = new ConsiliumMarketFactory();
        usdc = new CUSDC();
        priceFeed = new MockV3Aggregator(8, 1664e8);
        deadline = uint64(block.timestamp + 1 hours);
    }

    function _create(address as_) internal returns (address) {
        vm.prank(as_);
        return factory.createMarket(
            usdc,
            AggregatorV3Interface(address(priceFeed)),
            AggregatorV3Interface(address(0)),
            STRIKE,
            DOWN,
            deadline,
            pr
        );
    }

    function test_CreateMarket_DeploysWithCorrectParams() public {
        ConsiliumMarket m = ConsiliumMarket(_create(creator));
        assertEq(address(m.usdc()), address(usdc));
        assertEq(address(m.priceFeed()), address(priceFeed));
        assertEq(m.liquidationPrice(), STRIKE);
        assertEq(m.direction(), DOWN);
        assertEq(m.deadline(), deadline);
        (address position,,,) = m.positionRef();
        assertEq(position, pr.position);
    }

    function test_CreateMarket_Indexes() public {
        address market = _create(creator);
        assertEq(factory.allMarketsLength(), 1);
        assertEq(factory.allMarkets(0), market);
        assertEq(factory.marketsOf(creator)[0], market);
    }

    function test_CreateMarket_EmitsEvent() public {
        vm.expectEmit(false, true, true, true);
        emit MarketCreated(
            address(0), creator, pr.position, address(priceFeed), STRIKE, DOWN, deadline
        );
        _create(creator);
    }

    function test_CreateMultipleMarkets_DistinctAndSegregated() public {
        address m1 = _create(creator);
        address m2 = _create(other);
        assertTrue(m1 != m2);
        assertEq(factory.allMarketsLength(), 2);
        assertEq(factory.marketsOf(creator).length, 1);
        assertEq(factory.marketsOf(other).length, 1);
    }

    function test_RevertWhen_DeadlineInPast() public {
        vm.expectRevert(ConsiliumMarketFactory.InvalidDeadline.selector);
        factory.createMarket(
            usdc,
            AggregatorV3Interface(address(priceFeed)),
            AggregatorV3Interface(address(0)),
            STRIKE,
            DOWN,
            uint64(block.timestamp),
            pr
        );
    }

    function test_FactoryMarketIsFullyFunctional() public {
        ConsiliumMarket m = ConsiliumMarket(_create(creator));
        address staker = makeAddr("staker");
        usdc.mint(staker, 100e6);
        vm.startPrank(staker);
        usdc.transfer(address(m), 100e6);
        m.stake(YES, 100e6);
        vm.stopPrank();

        priceFeed.updateAnswer(1400e8); // liquidatable
        m.poke();
        m.resolve();
        assertEq(m.outcome(), YES);

        uint256 before = usdc.balanceOf(staker);
        vm.prank(staker);
        m.claim();
        assertEq(usdc.balanceOf(staker) - before, 100e6); // sole winner takes the pot
    }
}
