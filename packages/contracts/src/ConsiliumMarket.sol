// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title ConsiliumMarket
/// @notice A minimal binary prediction market that forecasts whether a real lending position `P`
///         becomes liquidatable within a window: will the collateral's price cross `P`'s
///         liquidation level. YES = LIQUIDATABLE, NO = SAFE.
///
///         Stakes are pulled in via the PUSH model (USDC transferred into the market, then
///         recorded) — this lets the 1Shot relay bundle move USDC via a top-level transfer the
///         `ERC20TransferAmount` enforcer can gate (so the over-cap revert fires at the enforcer,
///         CONSOLIUM_BUILD.MD §6.4). Resolution reads a real **Chainlink** price feed, guarded by
///         the **L2 Sequencer Uptime** feed (Chainlink-mandated on L2s like Base).
///
/// @dev    The contract does NOT enforce the per-agent cap — the caveat enforcer in the delegation
///         does. The contract is permissionless; the budget lives in MetaMask's DelegationManager.
contract ConsiliumMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Side / outcome encoding.
    uint8 public constant NO = 0; // SAFE
    uint8 public constant YES = 1; // LIQUIDATABLE

    /// @dev Cross direction: DOWN → YES when price ≤ liquidationPrice (collateral falling triggers
    ///      liquidation); UP → YES when price ≥ liquidationPrice.
    uint8 public constant DOWN = 0;
    uint8 public constant UP = 1;

    /// @dev Sequencer must have been back up for longer than this before prices are trusted.
    uint256 public constant GRACE_PERIOD = 3600;
    /// @dev Reject prices older than this (generous bound for testnet feed cadence).
    uint256 public constant MAX_PRICE_DELAY = 24 hours;

    /// @notice The mainnet position this market forecasts (display/audit; not used in resolution math).
    struct PositionRef {
        address position; // borrower P
        address collateral; // collateral asset whose price triggers liquidation
        uint16 liqThresholdBps; // P's liquidation threshold (e.g. 8300 = 83%)
        uint64 sourceChainId; // chain where P lives (e.g. 1 = Ethereum)
    }

    IERC20 public immutable usdc;
    AggregatorV3Interface public immutable priceFeed;
    /// @notice L2 Sequencer Uptime feed. `address(0)` = no feed on this chain → guard skipped
    ///         (Base Sepolia has none; the real feed is enforced on Base mainnet).
    AggregatorV3Interface public immutable sequencerFeed;
    int256 public immutable liquidationPrice; // strike, in feed decimals
    uint8 public immutable direction; // DOWN | UP
    uint64 public immutable deadline;
    PositionRef public positionRef;

    mapping(uint8 side => uint256 total) public totalStaked;
    mapping(address staker => Position) public positions;
    mapping(address staker => bool) public claimed;

    struct Position {
        uint8 side;
        uint256 amount;
    }

    bool public resolved;
    uint8 public outcome;
    bool public crossed; // latched true once the price crosses the liquidation level intra-window
    int256 public observedPrice;

    error MarketClosed();
    error MarketNotClosed();
    error AlreadyResolved();
    error NotResolved();
    error InvalidSide();
    error ZeroAmount();
    error SideMismatch();
    error Unfunded();
    error NothingToClaim();
    error AlreadyClaimed();
    error SequencerDown();
    error GracePeriodNotOver();
    error StalePrice();

    event Staked(address indexed agent, uint8 side, uint256 amount);
    event Poked(int256 price, bool crossed);
    event Resolved(uint8 outcome, int256 observedPrice, int256 liquidationPrice);
    event Claimed(address indexed agent, uint256 amount);

    constructor(
        IERC20 _usdc,
        AggregatorV3Interface _priceFeed,
        AggregatorV3Interface _sequencerFeed,
        int256 _liquidationPrice,
        uint8 _direction,
        uint64 _deadline,
        PositionRef memory _positionRef
    ) {
        usdc = _usdc;
        priceFeed = _priceFeed;
        sequencerFeed = _sequencerFeed;
        liquidationPrice = _liquidationPrice;
        direction = _direction;
        deadline = _deadline;
        positionRef = _positionRef;
    }

    /// @notice Stake `amount` of USDC on `side` using USDC already transferred into the market
    ///         (push model — see contract notice). `MarketClosed` after the deadline; a staker
    ///         accumulates on one side only (`SideMismatch`); `Unfunded` if the unaccounted balance
    ///         (`balanceOf(this) - pot()`) is below `amount`.
    function stake(uint8 side, uint256 amount) external nonReentrant {
        if (block.timestamp >= deadline) revert MarketClosed();
        if (side > YES) revert InvalidSide();
        if (amount == 0) revert ZeroAmount();

        Position storage pos = positions[msg.sender];
        if (pos.amount == 0) {
            pos.side = side;
        } else if (pos.side != side) {
            revert SideMismatch();
        }

        if (usdc.balanceOf(address(this)) - pot() < amount) revert Unfunded();

        pos.amount += amount;
        totalStaked[side] += amount;
        emit Staked(msg.sender, side, amount);
    }

    /// @notice Read the Chainlink price with the Chainlink-mandated L2 sequencer guard. Reverts if
    ///         the sequencer is down / within its grace period, or the price is non-positive/stale.
    function _readPrice() internal view returns (int256) {
        if (address(sequencerFeed) != address(0)) {
            (, int256 seqAnswer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
            if (seqAnswer != 0) revert SequencerDown(); // 0 = up, 1 = down
            if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
        }
        (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
        if (price <= 0) revert StalePrice();
        if (block.timestamp - updatedAt > MAX_PRICE_DELAY) revert StalePrice();
        return price;
    }

    /// @dev True if `price` meets the liquidation condition for this market's direction.
    function _meetsCondition(int256 price) internal view returns (bool) {
        return direction == DOWN ? price <= liquidationPrice : price >= liquidationPrice;
    }

    /// @notice Anyone may poke while the market is open; latches `crossed` if the live price meets
    ///         the liquidation condition. Captures an intra-window cross even if the price recovers
    ///         (liquidation is one-way: once liquidatable, the outcome is YES).
    function poke() external {
        if (resolved) revert AlreadyResolved();
        if (block.timestamp >= deadline) revert MarketClosed();
        int256 price = _readPrice();
        if (!crossed && _meetsCondition(price)) {
            crossed = true;
            observedPrice = price;
        }
        emit Poked(price, crossed);
    }

    /// @notice Settle once the deadline passes OR a cross was latched. YES if crossed (or a final
    ///         read meets the condition), else NO.
    function resolve() external {
        if (resolved) revert AlreadyResolved();
        if (!(block.timestamp >= deadline || crossed)) revert MarketNotClosed();

        bool yes = crossed;
        int256 finalPrice = observedPrice;
        if (!yes) {
            finalPrice = _readPrice();
            yes = _meetsCondition(finalPrice);
        }

        resolved = true;
        outcome = yes ? YES : NO;
        observedPrice = finalPrice;
        emit Resolved(outcome, finalPrice, liquidationPrice);
    }

    /// @notice The total pot (both sides combined).
    function pot() public view returns (uint256) {
        return totalStaked[NO] + totalStaked[YES];
    }

    /// @notice Amount `agent` can claim. Winners split the full pot pro-rata to their stake on the
    ///         winning side. If nobody staked the winning side, every staker is refunded their stake.
    function claimable(address agent) public view returns (uint256) {
        if (!resolved || claimed[agent]) return 0;
        Position memory pos = positions[agent];
        if (pos.amount == 0) return 0;

        uint256 winningTotal = totalStaked[outcome];
        if (winningTotal == 0) return pos.amount; // refund: no winners on the resolved side
        if (pos.side != outcome) return 0; // loser
        return (pot() * pos.amount) / winningTotal;
    }

    /// @notice Withdraw the caller's payout. Single claim per staker; checks-effects-interactions.
    function claim() external nonReentrant {
        if (!resolved) revert NotResolved();
        if (claimed[msg.sender]) revert AlreadyClaimed();
        uint256 amount = claimable(msg.sender);
        if (amount == 0) revert NothingToClaim();

        claimed[msg.sender] = true;
        usdc.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }
}
