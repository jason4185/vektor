import json
import sys

import pytest


NOW = "2026-01-01T00:00:00Z"
TARGET = "2026-01-02"
REFERENCE = "2026-01-01"
GEN = 10**18
PAIRS = {
    "GBP/USD": ("GBP", True), "USD/JPY": ("JPY", False),
    "XAU/USD": ("XAU", True), "XAG/USD": ("XAG", True),
}


def warp(vm, value):
    vm.warp(value)
    sys.modules["genlayer.gl"].message_raw["datetime"] = value


def create(contract, vm, sender, pair="GBP/USD", target=TARGET):
    vm.sender = sender
    return contract.create_market(pair, target)


def mock_sources(vm, pair="GBP/USD", a_ref="0.800000", a_target="0.820000",
                 b_ref="0.800000", b_target="0.820000", fx_date=None,
                 missing_b_target=False, primary_status=200, fallback_status=None):
    currency = PAIRS[pair][0]

    def fx_body(date, ref, target):
        value = ref if date == REFERENCE else target
        rates = {"GBP": "0.8", "JPY": "150", "XAU": "0.0005", "XAG": "0.04"}
        rates[currency] = value
        response_date = fx_date if fx_date else date
        return json.dumps({"success": True, "base": "USD", "date": response_date + "T00:00:00.000Z",
                           "rates": rates})

    def fawaz_body(date, ref, target):
        value = ref if date == REFERENCE else target
        rates = {"gbp": 0.8, "jpy": 150, "xau": 0.0005, "xag": 0.04}
        rates[currency.lower()] = value
        if date == TARGET and missing_b_target:
            rates.pop(currency.lower())
        return json.dumps({"date": date, "usd": rates})

    for date, ref, target in ((REFERENCE, a_ref, a_target), (TARGET, a_ref, a_target)):
        vm.mock_web(r"api\.fxratesapi\.com/historical\?date=" + date + r".*",
                    {"status": primary_status, "body": fx_body(date, ref, target)})
    for date, ref, target in ((REFERENCE, b_ref, b_target), (TARGET, b_ref, b_target)):
        vm.mock_web(r"cdn\.jsdelivr\.net.*@" + date + r"/v1/currencies/usd\.min\.json",
                    {"status": primary_status, "body": fawaz_body(date, ref, target)})
        if fallback_status is not None:
            vm.mock_web(r"https://" + date + r"\.currency-api\.pages\.dev/v1/currencies/usd\.min\.json",
                        {"status": fallback_status, "body": fawaz_body(date, ref, target)})


@pytest.fixture
def market(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    return contract


def test_supported_markets_and_removed_markets(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    for index, pair in enumerate(PAIRS):
        assert create(contract, direct_vm, direct_alice, pair, "2026-01-05") == index
    for pair in ("EUR/USD", "AUD/USD"):
        with direct_vm.expect_revert("unsupported"):
            contract.create_market(pair, TARGET)


def test_market_metadata_questions_and_card_fields(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice, "GBP/USD", "2026-08-12")
    create(contract, direct_vm, direct_alice, "XAU/USD", "2026-01-05")
    first = json.loads(contract.get_market(0))
    assert first["question"] == "GBP/USD: UP or DOWN on Aug 12?"
    assert first["category"] == "FX"
    assert first["market_type"] == "DAILY_DIRECTIONAL"
    assert first["up_label"] == "UP" and first["down_label"] == "DOWN"
    assert first["up_rule"] == "Target price > reference price"
    assert first["down_rule"] == "Target price < reference price"
    second = json.loads(contract.get_market(1))
    assert second["question"] == "XAU/USD: UP or DOWN on Jan 5?"
    assert second["category"] == "METAL"
    cards = json.loads(contract.get_markets(0, 2))["markets"]
    assert cards[0]["question"] == first["question"]
    assert cards[0]["category"] == "FX"
    assert "evidence" not in cards[0]
    months = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    for index, month in enumerate(months, 1):
        assert contract._question("GBP/USD", "2026-%02d-05" % index).endswith(month + " 5?")


def test_market_display_status_settlement_ready_and_bps(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    market = json.loads(contract.get_market(0))
    assert market["display_status"] == "BETTING_OPEN"
    assert market["settlement_ready"] is False
    assert market["up_bps"] == 0 and market["down_bps"] == 0
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    contract.place_bet(0, "UP")
    direct_vm.sender = direct_bob
    direct_vm.value = GEN
    contract.place_bet(0, "DOWN")
    market = json.loads(contract.get_market(0))
    assert market["up_bps"] == 5000 and market["down_bps"] == 5000
    state = json.loads(contract.get_market(0))
    state.update({"up": "8", "down": "2", "pool": "10"})
    contract._save(0, state)
    market = json.loads(contract.get_market(0))
    assert market["up_bps"] == 8000 and market["down_bps"] == 2000
    warp(direct_vm, "2026-01-02T12:00:00Z")
    assert json.loads(contract.get_market(0))["display_status"] == "OBSERVATION_ACTIVE"
    warp(direct_vm, "2026-01-03T00:00:00Z")
    market = json.loads(contract.get_market(0))
    assert market["display_status"] == "READY_FOR_SETTLEMENT"
    assert market["settlement_ready"] is True
    state = json.loads(contract.get_market(0))
    state.update({"status": "CLOSED", "outcome": "UP"})
    contract._save(0, state)
    market = json.loads(contract.get_market(0))
    assert market["display_status"] == "SETTLED" and market["settlement_ready"] is False
    state["outcome"] = "INCONCLUSIVE"
    contract._save(0, state)
    assert json.loads(contract.get_market(0))["display_status"] == "INCONCLUSIVE"


def test_user_market_index_and_pagination(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice, "GBP/USD")
    create(contract, direct_vm, direct_alice, "USD/JPY", "2026-01-05")
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    contract.place_bet(0, "UP")
    alice = contract._sender()
    direct_vm.value = GEN
    contract.place_bet(0, "UP")
    direct_vm.value = GEN
    contract.place_bet(1, "DOWN")
    alice_ids = json.loads(contract.get_user_market_ids(alice, 0, 1))
    assert alice_ids == {"market_ids": ["0"], "offset": "0", "limit": "1", "total": "2", "has_more": True}
    assert json.loads(contract.get_user_market_ids(alice, 1, 1))["market_ids"] == ["1"]
    direct_vm.sender = direct_bob
    direct_vm.value = GEN
    contract.place_bet(0, "UP")
    bob = contract._sender()
    assert json.loads(contract.get_user_market_ids(bob, 0, 50))["market_ids"] == ["0"]
    assert json.loads(contract.get_user_market_ids("0xdead", 0, 50))["market_ids"] == []


def test_due_market_discovery_is_paginated_and_open_only(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice, "GBP/USD")
    create(contract, direct_vm, direct_alice, "USD/JPY", "2026-01-05")
    create(contract, direct_vm, direct_alice, "XAU/USD", "2026-01-06")
    warp(direct_vm, "2026-01-03T00:00:00Z")
    first = json.loads(contract.get_due_market_ids(0, 50))
    assert first["market_ids"] == ["0"]
    assert first["offset"] == "0" and first["limit"] == "50"
    assert first["scanned"] == "3" and first["next_offset"] == "3"
    assert first["has_more"] is False
    warp(direct_vm, "2026-01-07T00:00:00Z")
    first = json.loads(contract.get_due_market_ids(0, 1))
    second = json.loads(contract.get_due_market_ids(1, 2))
    assert first["market_ids"] == ["0"] and first["scanned"] == "1"
    assert first["next_offset"] == "1" and first["has_more"] is True
    assert second["market_ids"] == ["1", "2"] and second["scanned"] == "2"
    assert second["next_offset"] == "3" and second["has_more"] is False
    state = json.loads(contract.get_market(0))
    state.update({"status": "CLOSED", "outcome": "INCONCLUSIVE"})
    contract._save(0, state)
    terminal = json.loads(contract.get_due_market_ids(3, 50))
    assert terminal["market_ids"] == [] and terminal["scanned"] == "0"
    assert terminal["next_offset"] == "3" and terminal["has_more"] is False
    assert "0" not in json.loads(contract.get_due_market_ids(0, 50))["market_ids"]
    with direct_vm.expect_revert("invalid page offset"):
        contract.get_due_market_ids(4, 1)
    with direct_vm.expect_revert("invalid page size"):
        contract.get_due_market_ids(0, 0)
    with direct_vm.expect_revert("invalid page size"):
        contract.get_due_market_ids(0, 51)


def test_due_market_discovery_reaches_markets_past_1000(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    base = contract._date(NOW[:10])
    created = 0
    for day in range(1, 367):
        target = base + day * 86400
        if contract._weekday(target):
            target_date = contract._date_string(target)
            for pair in PAIRS:
                create(contract, direct_vm, direct_alice, pair, target_date)
                created += 1
    assert created > 1000
    warp(direct_vm, "2027-01-03T00:00:00Z")
    page = json.loads(contract.get_due_market_ids(1000, 50))
    assert page["market_ids"] and page["market_ids"][0] == "1000"
    assert page["scanned"] == str(created - 1000)
    assert page["next_offset"] == str(created)
    assert page["has_more"] is False


def test_user_result_states(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    alice = contract._sender()
    assert json.loads(contract.get_user_market_status(0, alice))["user_result"] == "NOT_PARTICIPATED"
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    contract.place_bet(0, "UP")
    assert json.loads(contract.get_user_market_status(0, alice))["user_result"] == "PENDING"
    direct_vm.sender = direct_bob
    direct_vm.value = GEN
    contract.place_bet(0, "DOWN")
    bob = contract._sender()
    state = json.loads(contract.get_market(0))
    state.update({"status": "CLOSED", "outcome": "UP"})
    contract._save(0, state)
    assert json.loads(contract.get_user_market_status(0, alice))["user_result"] == "WON"
    assert json.loads(contract.get_user_market_status(0, bob))["user_result"] == "LOST"
    position = json.loads(contract.positions["0|" + alice])
    position["claimed"] = True
    contract.positions["0|" + alice] = json.dumps(position, separators=(",", ":"))
    assert json.loads(contract.get_user_market_status(0, alice))["user_result"] == "CLAIMED"
    state["outcome"] = "INCONCLUSIVE"
    contract._save(0, state)
    assert json.loads(contract.get_user_market_status(0, bob))["user_result"] == "REFUND_AVAILABLE"


def test_validate_market_creation_is_nonmutating_and_matches_create(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    before = contract.get_market_count()
    valid = json.loads(contract.validate_market_creation("XAU/USD", "2026-08-12"))
    assert valid["valid"] is True and valid["reason"] == "VALID"
    assert valid["question"] == "XAU/USD: UP or DOWN on Aug 12?"
    assert valid["category"] == "METAL"
    assert valid["reference_date"] == "2026-08-11"
    assert valid["duplicate_market_id"] == ""
    assert contract.get_market_count() == before
    direct_vm.sender = direct_alice
    contract.create_market("XAU/USD", "2026-08-12")
    assert json.loads(contract.get_market(0))["reference_date"] == valid["reference_date"]
    duplicate = json.loads(contract.validate_market_creation("XAU/USD", "2026-08-12"))
    assert duplicate["valid"] is False and duplicate["reason"] == "DUPLICATE_MARKET"
    assert duplicate["duplicate_market_id"] == "0"
    cases = [
        ("EUR/USD", TARGET, "UNSUPPORTED_INSTRUMENT"),
        ("GBP/USD", "bad", "INVALID_TARGET_DATE"),
        ("GBP/USD", "2026-01-03", "NON_WEEKDAY_DATE"),
        ("GBP/USD", "2026-01-01", "TARGET_OUTSIDE_CREATION_WINDOW"),
        ("GBP/USD", "2027-01-04", "TARGET_OUTSIDE_CREATION_WINDOW"),
    ]
    for pair, target, reason in cases:
        assert json.loads(contract.validate_market_creation(pair, target))["reason"] == reason


def test_creation_window_matches_betting_open_boundary(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    assert json.loads(contract.validate_market_creation("GBP/USD", TARGET))["valid"] is True
    create(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    contract.place_bet(0, "UP")
    warp(direct_vm, "2026-01-01T00:00:00Z")
    with direct_vm.expect_revert("outside creation window"):
        contract.create_market("GBP/USD", "2026-01-01")
    preview = json.loads(contract.validate_market_creation("GBP/USD", "2026-01-01"))
    assert preview["valid"] is False and preview["reason"] == "TARGET_OUTSIDE_CREATION_WINDOW"
    warp(direct_vm, "2026-01-01T14:00:00Z")
    with direct_vm.expect_revert("outside creation window"):
        contract.create_market("USD/JPY", "2026-01-01")
    preview = json.loads(contract.validate_market_creation("USD/JPY", "2026-01-01"))
    assert preview["valid"] is False and preview["reason"] == "TARGET_OUTSIDE_CREATION_WINDOW"
    warp(direct_vm, "2026-01-02T00:00:00Z")
    direct_vm.value = GEN
    with direct_vm.expect_revert("trading closed"):
        contract.place_bet(0, "UP")
    warp(direct_vm, "2026-01-01T14:00:00Z")
    with direct_vm.expect_revert("outside creation window"):
        contract.create_market("XAU/USD", "2027-01-04")
    preview = json.loads(contract.validate_market_creation("XAU/USD", "2027-01-04"))
    assert preview["valid"] is False and preview["reason"] == "TARGET_OUTSIDE_CREATION_WINDOW"


@pytest.mark.parametrize("target,reference", [
    ("2026-01-05", "2026-01-02"),
    ("2026-01-06", "2026-01-05"),
    ("2026-01-07", "2026-01-06"),
    ("2026-01-08", "2026-01-07"),
    ("2026-01-09", "2026-01-08"),
])
def test_previous_weekday_reference_derivation(target, reference, direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice, "GBP/USD", target)
    market = json.loads(contract.get_market(0))
    assert market["target_date"] == target
    assert market["reference_date"] == reference


def test_weekend_creation_for_future_monday_is_allowed(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, "2026-01-03T12:00:00Z")
    create(contract, direct_vm, direct_alice, "GBP/USD", "2026-01-05")
    assert json.loads(contract.get_market(0))["reference_date"] == "2026-01-02"
    warp(direct_vm, "2026-01-04T12:00:00Z")
    create(contract, direct_vm, direct_alice, "USD/JPY", "2026-01-05")
    assert json.loads(contract.get_market(1))["reference_date"] == "2026-01-02"


def test_date_string_boundaries_and_no_reference_argument(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    assert contract._date_string(contract._previous_weekday(contract._date("2026-03-02"))) == "2026-02-27"
    assert contract._date_string(contract._previous_weekday(contract._date("2027-01-04"))) == "2027-01-01"
    assert contract._date_string(contract._previous_weekday(contract._date("2024-03-04"))) == "2024-03-01"
    warp(direct_vm, NOW)
    with pytest.raises(TypeError):
        contract.create_market("GBP/USD", "2026-01-01", "2026-01-02")


def test_date_inputs_require_strict_ascii_canonical_format(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    assert contract._date("2026-08-07") == contract._date("2026-08-07")
    invalid = ("2026- 8-07", "2026-+8-07", "2026--8-07", "2026-08- 7",
               "2026-08-+7", "2026/08/07", "2026-8-07", "2026-08-7",
               "2026-02-29", "２０２６-08-07")
    for value in invalid:
        with direct_vm.expect_revert():
            contract._date(value)
        preview = json.loads(contract.validate_market_creation("GBP/USD", value))
        assert preview["valid"] is False and preview["reason"] == "INVALID_TARGET_DATE"
    with direct_vm.expect_revert():
        contract.create_market("GBP/USD", "2026-08- 7")


def test_creation_stores_canonical_date_after_strict_validation(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    preview = json.loads(contract.validate_market_creation("GBP/USD", "2026-08-07"))
    assert preview["target_date"] == "2026-08-07"
    create(contract, direct_vm, direct_alice, "GBP/USD", "2026-08-07")
    market = json.loads(contract.get_market(0))
    assert market["target_date"] == "2026-08-07"
    assert market["question"] == "GBP/USD: UP or DOWN on Aug 7?"
    assert market["reference_date"] == "2026-08-06"


def test_duplicate_market_rejected_and_distinct_market_accepted(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("duplicate"):
        create(contract, direct_vm, direct_alice)
    assert create(contract, direct_vm, direct_alice, "GBP/USD", "2026-01-05") == 1


@pytest.mark.parametrize("pair,raw_ref,raw_target,expected_ref,expected_target", [
    ("GBP/USD", "0.8", "0.82", 1250000, 1219512),
    ("USD/JPY", "150", "152", 150000000, 152000000),
    ("XAU/USD", "0.0005", "0.0004", 2000000000, 2500000000),
    ("XAG/USD", "0.04", "0.05", 25000000, 20000000),
])
def test_historical_normalization(pair, raw_ref, raw_target, expected_ref, expected_target,
                                  direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice, pair)
    mock_sources(direct_vm, pair, raw_ref, raw_target, raw_ref, raw_target)
    assert contract._source_a(pair, REFERENCE, TARGET)[:2] == (expected_ref, expected_target)
    assert contract._source_b(pair, REFERENCE, TARGET)[:2] == (expected_ref, expected_target)


def test_positions_and_zero_amount(market, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("minimum"):
        direct_vm.value = 0
        market.place_bet(0, "UP")
    direct_vm.value = GEN
    market.place_bet(0, "UP")
    with direct_vm.expect_revert("opposite"):
        market.place_bet(0, "DOWN")
    direct_vm.value = 0


def test_stake_minimum_cap_topups_and_per_market_allowance(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN - 1
    with direct_vm.expect_revert("minimum"):
        contract.place_bet(0, "UP")
    for amount in (4 * GEN, 3 * GEN, 3 * GEN):
        direct_vm.value = amount
        contract.place_bet(0, "UP")
    direct_vm.value = GEN
    with direct_vm.expect_revert("maximum"):
        contract.place_bet(0, "UP")
    with direct_vm.expect_revert("opposite"):
        contract.place_bet(0, "DOWN")
    alice_wallet = contract._sender()
    assert contract.get_remaining_bet_capacity(0, alice_wallet) == 0
    create(contract, direct_vm, direct_alice, "USD/JPY", "2026-01-05")
    direct_vm.value = 10 * GEN
    contract.place_bet(1, "DOWN")
    assert contract.get_remaining_bet_capacity(1, alice_wallet) == 0


def test_frontend_config_supported_markets_and_pages(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    for pair in PAIRS:
        create(contract, direct_vm, direct_alice, pair, "2026-01-05")
    config = json.loads(contract.get_protocol_config())
    assert config["min_stake"] == str(GEN)
    assert config["max_stake"] == str(10 * GEN)
    assert [item["instrument"] for item in json.loads(contract.get_supported_markets())] == list(PAIRS)
    page = json.loads(contract.get_markets(1, 2))
    assert page["total"] == "4"
    assert [item["id"] for item in page["markets"]] == ["1", "2"]
    assert "evidence" not in page["markets"][0]
    assert json.loads(contract.get_markets(4, 1))["markets"] == []
    with direct_vm.expect_revert("page size"):
        contract.get_markets(0, 51)
    with direct_vm.expect_revert("page offset"):
        contract.get_markets(5, 1)


def test_frontend_position_state_and_claimable_views(market, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    direct_vm.value = 2 * GEN
    market.place_bet(0, "UP")
    alice_wallet = market._sender()
    assert market.get_remaining_bet_capacity(0, alice_wallet) == 8 * GEN
    bet = json.loads(market.get_user_bet(0, alice_wallet))
    assert bet == {"side": "UP", "stake": str(2 * GEN), "claimed": False}
    assert "amount" not in bet
    assert market.get_claimable_payout(0, alice_wallet) == 0
    state = json.loads(market.get_user_market_status(0, alice_wallet))
    assert state["side"] == "UP" and state["stake"] == str(2 * GEN)
    assert state["remaining_bet_capacity"] == str(8 * GEN)
    assert "remaining_stake_capacity" not in state
    assert state["can_place_bet"] is True
    assert "can_add_position" not in state
    assert state["betting_open"] is True and state["claim_type"] == "NONE"
    assert market.can_place_bet(0, alice_wallet, "UP", GEN) is True
    assert market.can_place_bet(0, alice_wallet, "DOWN", GEN) is False
    direct_vm.sender = direct_bob
    bob_wallet = market._sender()
    direct_vm.value = GEN
    market.place_bet(0, "DOWN")
    direct_vm.value = 0
    mock_sources(direct_vm, a_ref="0.8", a_target="0.7", b_ref="0.8", b_target="0.7")
    warp(direct_vm, "2026-01-04T00:00:00Z")
    market.settle_market(0)
    assert market.get_claimable_payout(0, alice_wallet) == 3 * GEN
    assert market.get_claimable_payout(0, bob_wallet) == 0
    direct_vm.sender = direct_alice
    market.claim_payout(0)
    assert market.get_claimable_payout(0, alice_wallet) == 0


def test_can_place_bet_requires_minimum_remaining_capacity(market, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    wallet = market._sender()
    assert json.loads(market.get_user_market_status(0, wallet))["can_place_bet"] is True
    assert market.can_place_bet(0, wallet, "UP", GEN) is True
    direct_vm.value = 8 * GEN
    market.place_bet(0, "UP")
    assert json.loads(market.get_user_market_status(0, wallet))["can_place_bet"] is True
    direct_vm.value = GEN
    market.place_bet(0, "UP")
    assert json.loads(market.get_user_market_status(0, wallet))["can_place_bet"] is True
    key = "0|" + wallet
    pos = json.loads(market.positions[key])
    pos["amount"] = str(19 * GEN // 2)
    market.positions[key] = json.dumps(pos, separators=(",", ":"))
    assert json.loads(market.get_user_market_status(0, wallet))["can_place_bet"] is False
    assert market.can_place_bet(0, wallet, "UP", GEN) is False
    pos["amount"] = str(10 * GEN)
    market.positions[key] = json.dumps(pos, separators=(",", ":"))
    assert json.loads(market.get_user_market_status(0, wallet))["can_place_bet"] is False
    warp(direct_vm, TARGET + "T00:00:00Z")
    assert json.loads(market.get_user_market_status(0, wallet))["can_place_bet"] is False


def test_inconclusive_frontend_refund_view(market, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    market.place_bet(0, "UP")
    alice_wallet = market._sender()
    direct_vm.value = 0
    mock_sources(direct_vm, a_ref="0.8", a_target="0.9", b_ref="0.8", b_target="0.7")
    warp(direct_vm, "2026-01-04T00:00:00Z")
    direct_vm.sender = direct_bob
    market.settle_market(0)
    assert market.get_claimable_payout(0, alice_wallet) == GEN
    state = json.loads(market.get_user_market_status(0, alice_wallet))
    assert state["claim_type"] == "REFUND"


@pytest.mark.parametrize("pair,raw_ref,raw_target", [
    ("GBP/USD", "0.8", "0.7"),
    ("USD/JPY", "150", "152"),
    ("XAU/USD", "0.0005", "0.0004"),
    ("XAG/USD", "0.04", "0.03"),
])
def test_direction_is_derived_after_normalization(pair, raw_ref, raw_target,
                                                   direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice, pair)
    mock_sources(direct_vm, pair, raw_ref, raw_target, raw_ref, raw_target)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    contract.place_bet(0, "UP")
    direct_vm.value = 0
    warp(direct_vm, "2026-01-04T00:00:00Z")
    contract.settle_market(0)
    assert json.loads(contract.get_market(0))["evidence"]
    assert json.loads(contract.get_market(0))["outcome"] == "UP"


def test_zero_winner_up_becomes_refundable(market, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    market.place_bet(0, "DOWN")
    direct_vm.value = 0
    mock_sources(direct_vm, a_ref="0.8", a_target="0.7", b_ref="0.8", b_target="0.7")
    warp(direct_vm, "2026-01-04T00:00:00Z")
    direct_vm.sender = direct_bob
    market.settle_market(0)
    assert json.loads(market.get_market(0))["outcome"] == "INCONCLUSIVE"
    direct_vm.sender = direct_alice
    assert market.claim_payout(0) == GEN


def test_zero_winner_down_and_zero_participation_are_safe(market, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    market.place_bet(0, "UP")
    direct_vm.value = 0
    mock_sources(direct_vm, a_ref="0.8", a_target="0.9", b_ref="0.8", b_target="0.9")
    warp(direct_vm, "2026-01-04T00:00:00Z")
    direct_vm.sender = direct_bob
    market.settle_market(0)
    assert json.loads(market.get_market(0))["outcome"] == "INCONCLUSIVE"
    direct_vm.sender = direct_alice
    assert market.claim_payout(0) == GEN


def test_zero_participation_is_safe(market, direct_vm, direct_bob):
    mock_sources(direct_vm)
    warp(direct_vm, "2026-01-04T00:00:00Z")
    direct_vm.sender = direct_bob
    market.settle_market(0)
    assert json.loads(market.get_market(0))["outcome"] == "INCONCLUSIVE"


def test_normal_winner_payout_and_loser_rejection(market, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    market.place_bet(0, "UP")
    direct_vm.sender = direct_bob
    market.place_bet(0, "DOWN")
    direct_vm.value = 0
    mock_sources(direct_vm, a_ref="0.8", a_target="0.7", b_ref="0.8", b_target="0.7")
    warp(direct_vm, "2026-01-04T00:00:00Z")
    market.settle_market(0)
    assert json.loads(market.get_market(0))["outcome"] == "UP"
    with direct_vm.expect_revert("losing"):
        market.claim_payout(0)
    direct_vm.sender = direct_alice
    assert market.claim_payout(0) == 2 * GEN
    with direct_vm.expect_revert("nothing claimable"):
        market.claim_payout(0)


def test_normal_down_winner_payout(market, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    market.place_bet(0, "DOWN")
    direct_vm.sender = direct_bob
    market.place_bet(0, "UP")
    direct_vm.value = 0
    mock_sources(direct_vm, a_ref="0.8", a_target="0.9", b_ref="0.8", b_target="0.9")
    warp(direct_vm, "2026-01-04T00:00:00Z")
    market.settle_market(0)
    assert json.loads(market.get_market(0))["outcome"] == "DOWN"
    direct_vm.sender = direct_alice
    assert market.claim_payout(0) == 2 * GEN


def test_impossible_zero_winning_pool_raises_invariant(market, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    market.place_bet(0, "UP")
    direct_vm.value = 0
    state = json.loads(market.get_market(0))
    state.update({"status": "CLOSED", "outcome": "UP", "up": "0", "down": "0", "pool": "0"})
    market._save(0, state)
    with direct_vm.expect_revert("accounting invariant"):
        market.claim_payout(0)


def test_source_validation_and_fallback(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice, "XAU/USD")
    mock_sources(direct_vm, "XAU/USD", "0.0005", "0.0004", "0.0005", "0.0004",
                 primary_status=503, fallback_status=200)
    assert contract._source_b("XAU/USD", REFERENCE, TARGET)[2] is True
    direct_vm.clear_mocks()
    mock_sources(direct_vm, "XAU/USD", "0.0005", "0.0004", "0.0005", "0.0004",
                 missing_b_target=True, fallback_status=200)
    assert contract._source_b("XAU/USD", REFERENCE, TARGET)[2] is False
    direct_vm.clear_mocks()
    mock_sources(direct_vm, "XAU/USD", "0.0005", "0.0004", "0.0005", "0.0004",
                 fx_date="2025-12-30")
    assert contract._source_a("XAU/USD", REFERENCE, TARGET)[2] is False


@pytest.mark.parametrize("body", ["[]", '"text"', "123", "true", "null"])
def test_fxratesapi_wrong_json_top_level_is_invalid_evidence(body, direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    direct_vm.mock_web(r"api\.fxratesapi\.com/historical\?date=" + REFERENCE + r".*",
                       {"status": 200, "body": body})
    direct_vm.mock_web(r"api\.fxratesapi\.com/historical\?date=" + TARGET + r".*",
                       {"status": 200, "body": body})
    assert contract._source_a("GBP/USD", REFERENCE, TARGET) == (0, 0, False)


@pytest.mark.parametrize("body", ["[]", '"text"', "123", "true", "null"])
def test_fawaz_wrong_json_top_level_uses_safe_fallback_and_invalid_evidence(
        body, direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    for date in (REFERENCE, TARGET):
        direct_vm.mock_web(r"cdn\.jsdelivr\.net.*@" + date + r"/v1/currencies/usd\.min\.json",
                           {"status": 200, "body": body})
        direct_vm.mock_web(r"https://" + date + r"\.currency-api\.pages\.dev/v1/currencies/usd\.min\.json",
                           {"status": 200, "body": body})
    assert contract._source_b("GBP/USD", REFERENCE, TARGET) == (0, 0, False)


@pytest.mark.parametrize("rates", [[], "text"])
def test_nested_wrong_json_shapes_are_invalid_evidence(rates, direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    fx = json.dumps({"success": True, "base": "USD", "date": REFERENCE + "T00:00:00.000Z",
                     "rates": rates})
    direct_vm.mock_web(r"api\.fxratesapi\.com/historical\?date=" + REFERENCE + r".*",
                       {"status": 200, "body": fx})
    assert contract._source_a("GBP/USD", REFERENCE, TARGET) == (0, 0, False)
    for date in (REFERENCE, TARGET):
        body = json.dumps({"date": date, "usd": rates})
        direct_vm.mock_web(r"cdn\.jsdelivr\.net.*@" + date + r"/v1/currencies/usd\.min\.json",
                           {"status": 200, "body": body})
        direct_vm.mock_web(r"https://" + date + r"\.currency-api\.pages\.dev/v1/currencies/usd\.min\.json",
                           {"status": 200, "body": body})
    assert contract._source_b("GBP/USD", REFERENCE, TARGET) == (0, 0, False)


def test_source_transient_failure_is_retryable(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    mock_sources(direct_vm, primary_status=503, fallback_status=503)
    with direct_vm.expect_revert("[TRANSIENT]"):
        contract._source_a("GBP/USD", REFERENCE, TARGET)


def test_fixed_point_parser_boundaries(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/Vektor.py")
    warp(direct_vm, NOW)
    create(contract, direct_vm, direct_alice)
    assert contract._price("1") == 1000000
    assert contract._price("150") == 150000000
    assert contract._price("1.2") == 1200000
    assert contract._price("1.298450") == 1298450
    assert contract._price("150.123456") == 150123456
    for value in ("", "-1", "1e2", "1.2345678", "1..2", "1,2", "NaN", "Infinity"):
        assert contract._price(value) is None


def test_settlement_timing_and_repeated_settlement(market, direct_vm, direct_bob):
    with direct_vm.expect_revert("too early"):
        market.settle_market(0)
    mock_sources(direct_vm)
    warp(direct_vm, "2026-01-04T00:00:00Z")
    direct_vm.sender = direct_bob
    market.settle_market(0)
    with direct_vm.expect_revert("already finalized"):
        market.settle_market(0)
