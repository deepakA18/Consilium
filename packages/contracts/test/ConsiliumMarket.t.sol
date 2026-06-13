// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { ConsiliumMarket } from "../src/ConsiliumMarket.sol";
import { CUSDC } from "../src/CUSDC.sol";
import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { MockV3Aggregator } from "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";

contract ConsiliumMarketTest is Test {
    CUSDC usdc;
    MockV3Aggregator priceFeed; // ETH/USD, 8 decimals

    address bull = makeAddr("bull"); // YES / LIQUIDATABLE
    address bear = makeAddr("bear"); // NO / SAFE

    uint8 internal constant YES = 1;
    uint8 internal constant NO = 0;
    uint8 internal constant DOWN = 0;

    int256 constant CURRENT = 1664e8; // ~$1664
    int256 constant STRIKE = 1500e8; // liquidation price; price ≤ STRIKE → LIQUIDATABLE (DOWN)
    uint64 deadline;

    ConsiliumMarket.PositionRef pr = ConsiliumMarket.PositionRef({
        position: makeAddr("position"),
        collateral: makeAddr("WETH"),
        liqThresholdBps: 8300,
        sourceChainId: 1
    });

    function setUp() public {
        vm.warp(1_700_000_000); // realistic base time so sequencer grace math doesn't underflow
        usdc = new CUSDC();
        priceFeed = new MockV3Aggregator(8, CURRENT);
        deadline = uint64(block.timestamp + 1 hours);
        usdc.mint(bull, 1_000e6);
        usdc.mint(bear, 1_000e6);
    }

    /// Market with the sequencer guard skipped (address(0)) — matches the Base Sepolia demo.
    function _market() internal returns (ConsiliumMarket) {
        return new ConsiliumMarket(
            usdc,
            AggregatorV3Interface(address(priceFeed)),
            AggregatorV3Interface(address(0)),
            STRIKE,
            DOWN,
            deadline,
            pr
        );
    }

    // push model: move USDC into the market, then record the stake (mirrors the relayer's atomic bundle)
    function _stake(ConsiliumMarket m, address who, uint8 side, uint256 amt) internal {
        vm.prank(who);
        usdc.transfer(address(m), amt);
        vm.prank(who);
        m.stake(side, amt);
    }

    function test_StakeBothSides() public {
        ConsiliumMarket m = _market();
        _stake(m, bull, YES, 100e6);
        _stake(m, bear, NO, 60e6);
        assertEq(m.totalStaked(YES), 100e6);
        assertEq(m.totalStaked(NO), 60e6);
        assertEq(m.pot(), 160e6);
    }

    function test_ResolveYes_whenPriceCrossesDown() public {
        ConsiliumMarket m = _market();
        _stake(m, bull, YES, 20e6);
        priceFeed.updateAnswer(1400e8); // ≤ strike → liquidatable
        m.poke();
        assertTrue(m.crossed());
        m.resolve();
        assertEq(m.outcome(), YES);
        assertEq(m.observedPrice(), 1400e8);
    }

    function test_ResolveNo_whenPriceStaysAbove() public {
        ConsiliumMarket m = _market();
        _stake(m, bear, NO, 5e6);
        m.poke(); // price 1664 > strike → no cross
        assertFalse(m.crossed());
        vm.warp(deadline);
        priceFeed.updateAnswer(1700e8); // still above
        m.resolve();
        assertEq(m.outcome(), NO);
    }

    function test_PokeLatchesCrossEvenIfPriceRecovers() public {
        ConsiliumMarket m = _market();
        _stake(m, bull, YES, 10e6);
        priceFeed.updateAnswer(1450e8); // cross down
        m.poke();
        assertTrue(m.crossed());
        priceFeed.updateAnswer(1800e8); // recover well above strike
        m.poke();
        vm.warp(deadline);
        m.resolve();
        assertEq(m.outcome(), YES); // latched — liquidation is one-way
        assertEq(m.observedPrice(), 1450e8);
    }

    function test_RevertWhen_SequencerDown() public {
        MockV3Aggregator seq = new MockV3Aggregator(0, 1); // 1 = down
        ConsiliumMarket m = new ConsiliumMarket(
            usdc,
            AggregatorV3Interface(address(priceFeed)),
            AggregatorV3Interface(address(seq)),
            STRIKE,
            DOWN,
            deadline,
            pr
        );
        vm.expectRevert(ConsiliumMarket.SequencerDown.selector);
        m.poke();
    }

    function test_RevertWhen_GracePeriodNotOver() public {
        MockV3Aggregator seq = new MockV3Aggregator(0, 0); // up, but startedAt == now → within grace
        ConsiliumMarket m = new ConsiliumMarket(
            usdc,
            AggregatorV3Interface(address(priceFeed)),
            AggregatorV3Interface(address(seq)),
            STRIKE,
            DOWN,
            deadline,
            pr
        );
        vm.expectRevert(ConsiliumMarket.GracePeriodNotOver.selector);
        m.poke();
    }

    function test_SequencerUpPastGrace_allowsPoke() public {
        MockV3Aggregator seq = new MockV3Aggregator(0, 0);
        // up (answer 0), startedAt well in the past → past grace
        seq.updateRoundData(1, 0, block.timestamp, block.timestamp - (m_grace() + 1));
        ConsiliumMarket m = new ConsiliumMarket(
            usdc,
            AggregatorV3Interface(address(priceFeed)),
            AggregatorV3Interface(address(seq)),
            STRIKE,
            DOWN,
            deadline,
            pr
        );
        priceFeed.updateAnswer(1400e8);
        m.poke();
        assertTrue(m.crossed());
    }

    function m_grace() internal pure returns (uint256) {
        return 3600;
    }

    function test_ClaimPaysWinnersProRata() public {
        ConsiliumMarket m = _market();
        address bull2 = makeAddr("bull2");
        usdc.mint(bull2, 1_000e6);
        _stake(m, bull, YES, 100e6);
        _stake(m, bull2, YES, 300e6);
        _stake(m, bear, NO, 200e6);
        uint256 potTotal = m.pot(); // 600

        priceFeed.updateAnswer(1400e8); // liquidatable → YES wins
        m.poke();
        m.resolve();
        assertEq(m.outcome(), YES);

        uint256 b1 = usdc.balanceOf(bull);
        vm.prank(bull);
        m.claim();
        assertEq(usdc.balanceOf(bull) - b1, 150e6); // 100/400 * 600

        uint256 b2 = usdc.balanceOf(bull2);
        vm.prank(bull2);
        m.claim();
        assertEq(usdc.balanceOf(bull2) - b2, 450e6); // 300/400 * 600

        vm.prank(bear);
        vm.expectRevert(ConsiliumMarket.NothingToClaim.selector);
        m.claim();

        assertEq(150e6 + 450e6, potTotal);
        assertEq(usdc.balanceOf(address(m)), 0);
    }

    function test_RevertWhen_StakeAfterDeadline() public {
        ConsiliumMarket m = _market();
        vm.warp(deadline);
        vm.prank(bull);
        vm.expectRevert(ConsiliumMarket.MarketClosed.selector);
        m.stake(YES, 10e6);
    }

    function test_RevertWhen_StakeUnfunded() public {
        ConsiliumMarket m = _market();
        vm.prank(bull);
        vm.expectRevert(ConsiliumMarket.Unfunded.selector);
        m.stake(YES, 10e6); // never transferred USDC in
    }

    function test_RevertWhen_StakeSwitchesSide() public {
        ConsiliumMarket m = _market();
        _stake(m, bull, YES, 10e6);
        vm.prank(bull);
        vm.expectRevert(ConsiliumMarket.SideMismatch.selector);
        m.stake(NO, 10e6);
    }

    function testFuzz_ClaimNeverExceedsPot(uint256[] calldata rawStakes) public {
        ConsiliumMarket m = _market();
        uint256 len = rawStakes.length > 10 ? 10 : rawStakes.length;
        vm.assume(len > 0);

        uint256 potExpected;
        address[] memory stakers = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 amt = bound(rawStakes[i], 1, 1_000_000e6);
            uint8 side = uint8(rawStakes[i] % 2);
            address s = address(uint160(0x100000 + i));
            stakers[i] = s;
            usdc.mint(s, amt);
            vm.startPrank(s);
            usdc.transfer(address(m), amt);
            m.stake(side, amt);
            vm.stopPrank();
            potExpected += amt;
        }

        if (rawStakes[0] % 2 == 1) {
            priceFeed.updateAnswer(1400e8); // YES wins
            m.poke();
        }
        vm.warp(deadline);
        if (rawStakes[0] % 2 == 0) priceFeed.updateAnswer(1700e8); // NO wins (above strike)
        m.resolve();

        uint256 totalClaimed;
        for (uint256 i = 0; i < len; i++) {
            uint256 c = m.claimable(stakers[i]);
            if (c > 0) {
                vm.prank(stakers[i]);
                m.claim();
                totalClaimed += c;
            }
        }
        assertEq(m.pot(), potExpected);
        assertLe(totalClaimed, m.pot());
    }
}
