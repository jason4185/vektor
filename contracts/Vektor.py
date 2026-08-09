# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

DAY = u256(86400)
SCALE = u256(1000000)
RATE_SCALE = u256(1000000000000)
BPS = u256(10000)
GEN = u256(10**18)
MIN_STAKE = GEN
MAX_STAKE = u256(10) * GEN
MAX_PAGE = u256(50)
MAX_BODY = 120000
OPEN = "OPEN"
CLOSED = "CLOSED"
UP = "UP"
DOWN = "DOWN"
TIE = "TIE"
INCONCLUSIVE = "INCONCLUSIVE"
NONE = "NONE"
EXPECTED = "[EXPECTED]"
EXTERNAL = "[EXTERNAL]"
TRANSIENT = "[TRANSIENT]"
INVARIANT = EXPECTED + " accounting invariant"

PAIRS = {"GBP/USD": ("GBP", True), "USD/JPY": ("JPY", False),
         "XAU/USD": ("XAU", True), "XAG/USD": ("XAG", True)}
FX_URL = "https://api.fxratesapi.com/historical?date="
FX_SUFFIX = "&base=USD&currencies=GBP,JPY,XAU,XAG&resolution=1d&format=json"
FAWAZ_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@"
FAWAZ_SUFFIX = "/v1/currencies/usd.min.json"


@gl.evm.contract_interface
class _NativeRecipient:
    class View:
        pass
    class Write:
        pass


class Vektor(gl.Contract):
    next_id: u256
    markets: TreeMap[str, str]
    market_ids: str
    positions: TreeMap[str, str]
    market_keys: TreeMap[str, str]
    user_market_ids: TreeMap[str, str]

    def __init__(self):
        self.next_id = u256(0)
        self.market_ids = "[]"

    @gl.public.write
    def create_market(self, instrument: str, target_date: str) -> u256:
        pair = str(instrument).strip().upper()
        if pair not in PAIRS:
            raise gl.vm.UserError(EXPECTED + " unsupported instrument")
        target = self._date(target_date)
        if not self._weekday(target):
            raise gl.vm.UserError(EXPECTED + " target date must be a weekday")
        target_date = self._date_string(target)
        now = self._now()
        target_end = target + DAY
        if target <= now or target > now + u256(366) * DAY:
            raise gl.vm.UserError(EXPECTED + " target date outside creation window")
        ref = self._previous_weekday(target)
        reference_date = self._date_string(ref)
        key = pair + "|" + str(target)
        if key in self.market_keys:
            raise gl.vm.UserError(EXPECTED + " duplicate market")
        mid = self.next_id
        question = self._question(pair, target_date)
        market = {"id": str(mid), "instrument": pair, "reference_date": reference_date,
                  "target_date": target_date, "reference": str(ref), "target": str(target),
                  "target_end": str(target_end), "created": str(now), "status": OPEN,
                  "question": question, "category": self._category(pair),
                  "market_type": "DAILY_DIRECTIONAL", "up_label": UP, "down_label": DOWN,
                  "up_rule": "Target price > reference price",
                  "down_rule": "Target price < reference price",
                  "outcome": NONE, "up": "0", "down": "0", "pool": "0", "evidence": ""}
        self.markets[str(mid)] = json.dumps(market, sort_keys=True)
        self.market_keys[key] = str(mid)
        ids = json.loads(self.market_ids)
        ids.append(str(mid))
        self.market_ids = json.dumps(ids, separators=(",", ":"))
        self.next_id = mid + u256(1)
        return mid

    @gl.public.write.payable
    def place_bet(self, market_id: u256, side: str) -> None:
        market = self._market(market_id)
        if market["status"] != OPEN or self._now() >= u256(int(market["target"])):
            raise gl.vm.UserError(EXPECTED + " trading closed")
        clean = str(side).strip().upper()
        if clean != UP and clean != DOWN:
            raise gl.vm.UserError(EXPECTED + " invalid side")
        amount = gl.message.value
        if amount < MIN_STAKE:
            raise gl.vm.UserError(EXPECTED + " minimum stake is 1 GEN")
        key = str(market_id) + "|" + self._sender()
        pos = self._position(key)
        if pos["side"] not in (NONE, clean):
            raise gl.vm.UserError(EXPECTED + " opposite side already selected")
        current = u256(int(pos["amount"]))
        if current + amount > MAX_STAKE:
            raise gl.vm.UserError(EXPECTED + " maximum stake is 10 GEN")
        sender = self._sender()
        if current == u256(0):
            ids = json.loads(self.user_market_ids[sender]) if sender in self.user_market_ids else []
            if str(market_id) not in ids:
                ids.append(str(market_id))
                self.user_market_ids[sender] = json.dumps(ids, separators=(",", ":"))
        pos["side"] = clean
        pos["amount"] = str(current + amount)
        self.positions[key] = json.dumps(pos, separators=(",", ":"))
        field = "up" if clean == UP else "down"
        market[field] = str(u256(int(market[field])) + amount)
        market["pool"] = str(u256(int(market["pool"])) + amount)
        self._save(market_id, market)

    @gl.public.write
    def settle_market(self, market_id: u256) -> None:
        market = self._market(market_id)
        if market["status"] != OPEN:
            raise gl.vm.UserError(EXPECTED + " market already finalized")
        if self._now() < u256(int(market["target_end"])):
            raise gl.vm.UserError(EXPECTED + " settlement too early")
        result = self._consensus_evidence(market["instrument"], market["reference_date"], market["target_date"])
        market["status"] = CLOSED
        source_outcome = result["outcome"]
        final_outcome = source_outcome
        if source_outcome == UP and u256(int(market["up"])) == u256(0):
            final_outcome = INCONCLUSIVE
        elif source_outcome == DOWN and u256(int(market["down"])) == u256(0):
            final_outcome = INCONCLUSIVE
        elif source_outcome in (UP, DOWN) and u256(int(market["pool"])) == u256(0):
            final_outcome = INCONCLUSIVE
        market["outcome"] = final_outcome
        result["final_outcome"] = final_outcome
        market["evidence"] = json.dumps(result, sort_keys=True, separators=(",", ":"))
        self._save(market_id, market)

    @gl.public.write
    def claim_payout(self, market_id: u256) -> u256:
        market = self._market(market_id)
        if market["status"] != CLOSED:
            raise gl.vm.UserError(EXPECTED + " market not finalized")
        key = str(market_id) + "|" + self._sender()
        pos = self._position(key)
        if pos["claimed"] or u256(int(pos["amount"])) == u256(0):
            raise gl.vm.UserError(EXPECTED + " nothing claimable")
        stake = u256(int(pos["amount"]))
        outcome = market["outcome"]
        if outcome == INCONCLUSIVE:
            payout = stake
        elif pos["side"] == outcome:
            winning = u256(int(market["up"] if outcome == UP else market["down"]))
            if winning == u256(0):
                raise gl.vm.UserError(INVARIANT)
            payout = u256(int(market["pool"])) * stake // winning
        else:
            raise gl.vm.UserError(EXPECTED + " losing position")
        pos["claimed"] = True
        self.positions[key] = json.dumps(pos, separators=(",", ":"))
        _NativeRecipient(Address(self._sender())).emit_transfer(value=payout)
        return payout

    @gl.public.view
    def get_market(self, market_id: u256) -> str:
        market = dict(self._market(market_id))
        now = self._now()
        market["display_status"] = self._display_status(market, now)
        market["settlement_ready"] = self._settlement_ready(market, now)
        market["up_bps"], market["down_bps"] = self._pool_bps(market)
        return json.dumps(market, sort_keys=True, separators=(",", ":"))

    @gl.public.view
    def get_market_count(self) -> u256:
        return self.next_id

    @gl.public.view
    def get_market_ids(self) -> str:
        return self.market_ids

    @gl.public.view
    def get_protocol_config(self) -> str:
        return json.dumps({"name": "Vektor", "version": "1.0.0",
                           "market_type": "DAILY_DIRECTIONAL", "price_scale": str(SCALE),
                           "source_rate_scale": str(RATE_SCALE), "gen_unit": str(GEN),
                           "min_stake": str(MIN_STAKE), "max_stake": str(MAX_STAKE),
                           "settlement_sources": ["FXRatesAPI", "Fawaz"],
                           "permissionless_creation": True,
                           "permissionless_settlement": True,
                           "outcomes": [NONE, UP, DOWN, INCONCLUSIVE]},
                          separators=(",", ":"))

    @gl.public.view
    def get_supported_markets(self) -> str:
        items = []
        for pair in ("GBP/USD", "USD/JPY", "XAU/USD", "XAG/USD"):
            currency, reciprocal = PAIRS[pair]
            items.append({"instrument": pair, "display_symbol": pair,
                          "category": "METAL" if pair.startswith("X") else "FX",
                          "provider_currency": currency, "reciprocal": reciprocal})
        return json.dumps(items, separators=(",", ":"))

    @gl.public.view
    def validate_market_creation(self, instrument: str, target_date: str) -> str:
        pair = str(instrument).strip().upper()
        result = {"valid": False, "reason": "VALID", "instrument": pair,
                  "category": self._category(pair) if pair in PAIRS else "",
                  "question": "", "reference_date": "",
                  "target_date": str(target_date), "betting_close": "",
                  "settlement_eligible": "", "duplicate_market_id": ""}
        if pair not in PAIRS:
            result["reason"] = "UNSUPPORTED_INSTRUMENT"
            return json.dumps(result, separators=(",", ":"))
        try:
            target = self._date(target_date)
        except Exception:
            result["reason"] = "INVALID_TARGET_DATE"
            return json.dumps(result, separators=(",", ":"))
        canonical_target = self._date_string(target)
        result["target_date"] = canonical_target
        result["question"] = self._question(pair, canonical_target)
        result["betting_close"] = str(target)
        result["settlement_eligible"] = str(target + DAY)
        if not self._weekday(target):
            result["reason"] = "NON_WEEKDAY_DATE"
            return json.dumps(result, separators=(",", ":"))
        ref = self._previous_weekday(target)
        result["reference_date"] = self._date_string(ref)
        now = self._now()
        if target <= now or target > now + u256(366) * DAY:
            result["reason"] = "TARGET_OUTSIDE_CREATION_WINDOW"
            return json.dumps(result, separators=(",", ":"))
        key = pair + "|" + str(target)
        if key in self.market_keys:
            result["reason"] = "DUPLICATE_MARKET"
            result["duplicate_market_id"] = self.market_keys[key]
            return json.dumps(result, separators=(",", ":"))
        result["valid"] = True
        return json.dumps(result, separators=(",", ":"))

    @gl.public.view
    def get_markets(self, offset: u256, limit: u256) -> str:
        size = u256(int(limit))
        start = int(offset)
        if size == u256(0) or size > MAX_PAGE:
            raise gl.vm.UserError(EXPECTED + " invalid page size")
        ids = json.loads(self.market_ids)
        if start > len(ids):
            raise gl.vm.UserError(EXPECTED + " invalid page offset")
        now = self._now()
        end = min(start + int(size), len(ids))
        items = []
        for value in ids[start:end]:
            market = json.loads(self.markets[value])
            up_bps, down_bps = self._pool_bps(market)
            items.append({"id": market["id"], "instrument": market["instrument"],
                          "question": market["question"], "category": market["category"],
                          "reference_date": market["reference_date"],
                          "target_date": market["target_date"], "status": market["status"],
                          "outcome": market["outcome"], "up_total": market["up"],
                          "down_total": market["down"], "total_pool": market["pool"],
                          "betting_close": market["target"],
                          "settlement_eligible": market["target_end"],
                          "display_status": self._display_status(market, now),
                          "settlement_ready": self._settlement_ready(market, now),
                          "up_bps": str(up_bps), "down_bps": str(down_bps)})
        return json.dumps({"offset": str(start), "limit": str(size),
                           "total": str(len(ids)), "markets": items},
                          separators=(",", ":"))

    @gl.public.view
    def get_user_bet(self, market_id: u256, wallet: str) -> str:
        self._market(market_id)
        pos = self._position(str(market_id) + "|" + str(wallet).lower())
        return json.dumps({"side": pos["side"], "stake": pos["amount"],
                           "claimed": pos["claimed"]},
                          separators=(",", ":"))

    @gl.public.view
    def get_user_market_ids(self, wallet: str, offset: u256, limit: u256) -> str:
        size = u256(int(limit))
        start = int(offset)
        if size == u256(0) or size > MAX_PAGE:
            raise gl.vm.UserError(EXPECTED + " invalid page size")
        key = str(wallet).lower()
        ids = json.loads(self.user_market_ids[key]) if key in self.user_market_ids else []
        if start > len(ids):
            raise gl.vm.UserError(EXPECTED + " invalid page offset")
        end = min(start + int(size), len(ids))
        return json.dumps({"market_ids": ids[start:end], "offset": str(start),
                           "limit": str(size), "total": str(len(ids)),
                           "has_more": end < len(ids)}, separators=(",", ":"))

    @gl.public.view
    def get_due_market_ids(self, offset: u256, limit: u256) -> str:
        size = u256(int(limit))
        start = int(offset)
        if size == u256(0) or size > MAX_PAGE:
            raise gl.vm.UserError(EXPECTED + " invalid page size")
        now = self._now()
        ids = json.loads(self.market_ids)
        total = len(ids)
        if start > total:
            raise gl.vm.UserError(EXPECTED + " invalid page offset")
        end = min(start + int(size), total)
        due = []
        for value in ids[start:end]:
            market = json.loads(self.markets[value])
            if market["status"] == OPEN and now >= u256(int(market["target_end"])):
                due.append(value)
        scanned = end - start
        return json.dumps({"market_ids": due, "offset": str(start),
                           "limit": str(size), "scanned": str(scanned),
                           "next_offset": str(end), "has_more": end < total},
                          separators=(",", ":"))

    @gl.public.view
    def get_remaining_bet_capacity(self, market_id: u256, wallet: str) -> u256:
        self._market(market_id)
        amount = u256(int(self._position(str(market_id) + "|" + str(wallet).lower())["amount"]))
        return u256(0) if amount >= MAX_STAKE else MAX_STAKE - amount

    @gl.public.view
    def get_claimable_payout(self, market_id: u256, wallet: str) -> u256:
        market = self._market(market_id)
        pos = self._position(str(market_id) + "|" + str(wallet).lower())
        return self._claimable(market, pos)

    @gl.public.view
    def get_user_market_status(self, market_id: u256, wallet: str) -> str:
        market = self._market(market_id)
        pos = self._position(str(market_id) + "|" + str(wallet).lower())
        stake = u256(int(pos["amount"]))
        remaining = u256(0) if stake >= MAX_STAKE else MAX_STAKE - stake
        claimable = self._claimable(market, pos)
        resolved = market["status"] == CLOSED
        if stake == u256(0):
            user_result = "NOT_PARTICIPATED"
        elif not resolved:
            user_result = "PENDING"
        elif pos["claimed"]:
            user_result = "CLAIMED"
        elif market["outcome"] == INCONCLUSIVE:
            user_result = "REFUND_AVAILABLE"
        elif pos["side"] == market["outcome"]:
            user_result = "WON"
        else:
            user_result = "LOST"
        can_claim = claimable > u256(0)
        claim_type = "REFUND" if can_claim and market["outcome"] == INCONCLUSIVE else "WIN" if can_claim else "NONE"
        open_for_betting = market["status"] == OPEN and self._now() < u256(int(market["target"]))
        return json.dumps({"market_id": str(market_id), "wallet": str(wallet).lower(),
                           "side": pos["side"], "stake": pos["amount"],
                           "claimed": pos["claimed"], "status": market["status"],
                           "outcome": market["outcome"], "can_claim": can_claim,
                           "claim_type": claim_type, "claimable_amount": str(claimable),
                           "user_result": user_result,
                           "remaining_bet_capacity": str(remaining),
                           "can_place_bet": open_for_betting and remaining >= MIN_STAKE,
                           "betting_open": open_for_betting, "resolved": resolved},
                          separators=(",", ":"))

    @gl.public.view
    def can_place_bet(self, market_id: u256, wallet: str, side: str, amount: u256) -> bool:
        market = self._market(market_id)
        clean = str(side).strip().upper()
        if clean not in (UP, DOWN) or amount < MIN_STAKE:
            return False
        pos = self._position(str(market_id) + "|" + str(wallet).lower())
        current = u256(int(pos["amount"]))
        return (market["status"] == OPEN and self._now() < u256(int(market["target"]))
                and pos["side"] in (NONE, clean) and current + amount <= MAX_STAKE)

    def _claimable(self, market: dict, pos: dict) -> u256:
        if market["status"] != CLOSED or pos["claimed"]:
            return u256(0)
        stake = u256(int(pos["amount"]))
        if stake == u256(0) or market["outcome"] == INCONCLUSIVE:
            return stake
        if pos["side"] != market["outcome"]:
            return u256(0)
        winning = u256(int(market["up"] if market["outcome"] == UP else market["down"]))
        if winning == u256(0):
            raise gl.vm.UserError(INVARIANT)
        return u256(int(market["pool"])) * stake // winning

    @gl.public.view
    def can_claim_payout(self, market_id: u256, wallet: str) -> bool:
        market = self._market(market_id)
        pos = self._position(str(market_id) + "|" + str(wallet).lower())
        if pos["claimed"] or u256(int(pos["amount"])) == u256(0):
            return False
        return market["outcome"] == INCONCLUSIVE or pos["side"] == market["outcome"]

    def _consensus_evidence(self, pair: str, ref: str, target: str) -> dict:
        def run():
            a = self._source_a(pair, ref, target)
            b = self._source_b(pair, ref, target)
            da = self._direction(a[0], a[1]) if a[2] else TIE
            db = self._direction(b[0], b[1]) if b[2] else TIE
            outcome = UP if da == UP and db == UP else DOWN if da == DOWN and db == DOWN else INCONCLUSIVE
            return {"ar": a[0], "at": a[1], "av": a[2], "br": b[0], "bt": b[1], "bv": b[2],
                    "ad": da, "bd": db, "outcome": outcome}

        def verify(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                leader_message = str(getattr(leaders_res, "message", ""))
                try:
                    run()
                except gl.vm.UserError as error:
                    validator_message = str(getattr(error, "message", error))
                    if leader_message.startswith(TRANSIENT) and validator_message.startswith(TRANSIENT):
                        return True
                    if leader_message.startswith((EXPECTED, EXTERNAL)):
                        return leader_message == validator_message
                return False
            try:
                other = run()
            except gl.vm.UserError:
                return False
            wanted = ("ar", "at", "av", "br", "bt", "bv", "ad", "bd", "outcome")
            return all(leaders_res.calldata.get(k) == other[k] for k in wanted)

        return gl.vm.run_nondet_unsafe(run, verify)

    def _source_a(self, pair: str, ref: str, target: str):
        currency, reciprocal = PAIRS[pair]
        values = []
        for date in (ref, target):
            response = self._response(FX_URL + date + FX_SUFFIX)
            if response is None or response.status <= 0 or response.status >= 500:
                raise gl.vm.UserError(TRANSIENT + " source unavailable")
            if response.status != 200:
                raise gl.vm.UserError(EXTERNAL + " source rejected request")
            data = self._decode(response.body)
            if not isinstance(data, dict):
                return (u256(0), u256(0), False)
            source_date = self._source_date(data.get("date"))
            rates = data.get("rates")
            if data.get("success") is not True or str(data.get("base", "")).upper() != "USD":
                return (u256(0), u256(0), False)
            if source_date != date or not isinstance(rates, dict) or currency not in rates:
                return (u256(0), u256(0), False)
            price = self._normalize(rates[currency], reciprocal)
            if price is None:
                return (u256(0), u256(0), False)
            values.append(price)
        return (values[0], values[1], True)

    def _source_b(self, pair: str, ref: str, target: str):
        currency, reciprocal = PAIRS[pair]
        values = []
        for date in (ref, target):
            primary = self._response(FAWAZ_URL + date + FAWAZ_SUFFIX)
            primary_transient = primary is None or primary.status <= 0 or primary.status >= 500
            data = self._decode(primary.body) if primary is not None and primary.status == 200 else None
            rates = data.get("usd") if isinstance(data, dict) else None
            price = self._fawaz_price(data, rates, date, currency, reciprocal)
            if price is not None:
                values.append(price)
                continue
            fallback = self._response("https://" + date + ".currency-api.pages.dev" + FAWAZ_SUFFIX)
            fallback_transient = fallback is None or fallback.status <= 0 or fallback.status >= 500
            data = self._decode(fallback.body) if fallback is not None and fallback.status == 200 else None
            rates = data.get("usd") if isinstance(data, dict) else None
            price = self._fawaz_price(data, rates, date, currency, reciprocal)
            if price is not None:
                values.append(price)
                continue
            if primary_transient or fallback_transient:
                raise gl.vm.UserError(TRANSIENT + " source unavailable")
            if ((primary is not None and primary.status >= 400) or
                    (fallback is not None and fallback.status >= 400)):
                raise gl.vm.UserError(EXTERNAL + " source rejected request")
            return (u256(0), u256(0), False)
        return (values[0], values[1], True)

    def _response(self, url: str):
        try:
            return gl.nondet.web.get(url)
        except Exception:
            return None

    def _decode(self, body):
        if body is None or len(body) == 0 or len(body) > MAX_BODY:
            return None
        try:
            return json.loads(body.decode("utf-8"), parse_float=str, parse_int=str)
        except Exception:
            return None

    def _fawaz_price(self, data, rates, date: str, currency: str, reciprocal: bool):
        if (not isinstance(data, dict) or self._source_date(data.get("date")) != date or
                not isinstance(rates, dict)):
            return None
        if currency.lower() not in rates:
            return None
        return self._normalize(rates[currency.lower()], reciprocal)

    def _source_date(self, raw):
        if not isinstance(raw, str):
            return None
        value = raw.strip()
        if len(value) == 10:
            try:
                self._date(value)
                return value
            except gl.vm.UserError:
                return None
        if (len(value) < 20 or value[10] != "T" or value[13] != ":" or value[16] != ":" or
                not (value.endswith("Z") or value.endswith("+00:00"))):
            return None
        fraction = value[19:-1] if value.endswith("Z") else value[19:-6]
        if fraction and (not fraction.startswith(".") or len(fraction) > 10 or
                         not fraction[1:].isdigit()):
            return None
        try:
            self._date(value[:10])
            hour, minute, second = int(value[11:13]), int(value[14:16]), int(value[17:19])
        except (ValueError, gl.vm.UserError):
            return None
        if hour > 23 or minute > 59 or second > 59:
            return None
        return value[:10]

    def _normalize(self, raw, reciprocal: bool):
        rate = self._source_fixed(raw)
        if rate is None:
            return None
        result = RATE_SCALE * SCALE // rate if reciprocal else rate * SCALE // RATE_SCALE
        if result <= 0 or result > u256(10**30):
            return None
        return u256(result)

    def _source_fixed(self, raw):
        if isinstance(raw, bool):
            return None
        text = str(raw).strip()
        if len(text) == 0 or len(text) > 80 or text[0] == "-":
            return None
        if text.startswith("+"):
            text = text[1:]
        lower = text.lower()
        exponent = 0
        if "e" in lower:
            if lower.count("e") != 1:
                return None
            coefficient, exponent_text = lower.split("e")
            if len(exponent_text) == 0 or len(exponent_text) > 4:
                return None
            try:
                exponent = int(exponent_text)
            except ValueError:
                return None
            if exponent < -30 or exponent > 30:
                return None
        else:
            coefficient = lower
        if coefficient.count(".") > 1:
            return None
        if "." in coefficient:
            whole, fraction = coefficient.split(".")
        else:
            whole, fraction = coefficient, ""
        if whole == "":
            whole = "0"
        digits = whole + fraction
        if len(digits) == 0 or len(digits) > 40 or not digits.isdigit():
            return None
        significant = int(digits)
        power = exponent - len(fraction)
        result = (significant * (10 ** power) * RATE_SCALE if power >= 0 else
                  significant * RATE_SCALE // (10 ** (-power)))
        if result <= 0 or result > u256(10**30):
            return None
        return u256(result)

    def _price(self, raw):
        if not isinstance(raw, str) or len(raw) == 0 or len(raw) > 32:
            return None
        if raw[0] == "+" or raw[0] == "-" or "e" in raw.lower() or raw.count(".") > 1:
            return None
        parts = raw.split(".")
        whole = parts[0]
        frac = parts[1] if len(parts) == 2 else ""
        if not whole.isdigit() or (len(parts) == 2 and not frac.isdigit()) or len(frac) > 6 or len(whole) > 24:
            return None
        value = int(whole) * SCALE + int((frac + "000000")[:6])
        if value <= 0 or value > u256(10**30):
            return None
        return u256(value)

    def _direction(self, reference: u256, target: u256) -> str:
        return UP if target > reference else DOWN if target < reference else TIE

    def _category(self, pair: str) -> str:
        return "METAL" if pair.startswith("X") else "FX"

    def _display_status(self, market: dict, now: u256) -> str:
        if market["status"] == CLOSED:
            return "INCONCLUSIVE" if market["outcome"] == INCONCLUSIVE else "SETTLED"
        target = u256(int(market["target"]))
        return "BETTING_OPEN" if now < target else "OBSERVATION_ACTIVE" if now < u256(int(market["target_end"])) else "READY_FOR_SETTLEMENT"

    def _settlement_ready(self, market: dict, now: u256) -> bool:
        return market["status"] == OPEN and now >= u256(int(market["target_end"]))

    def _pool_bps(self, market: dict):
        pool = u256(int(market["pool"]))
        if pool == u256(0):
            return u256(0), u256(0)
        up = u256(int(market["up"])) * BPS // pool
        return up, BPS - up

    def _question(self, pair: str, target_date: str) -> str:
        months = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        month = int(str(target_date)[5:7])
        day = int(str(target_date)[8:10])
        return pair + ": UP or DOWN on " + months[month - 1] + " " + str(day) + "?"

    def _previous_weekday(self, target: u256) -> u256:
        candidate = target - DAY
        while not self._weekday(candidate):
            candidate -= DAY
        return candidate

    def _date_string(self, epoch: u256) -> str:
        z = int(epoch // DAY) + 719468
        era = z // 146097
        day = z - era * 146097
        year_of_era = (day - day // 1460 + day // 36524 - day // 146096) // 365
        year = year_of_era + era * 400
        day_of_year = day - (365 * year_of_era + year_of_era // 4 - year_of_era // 100)
        month_part = (5 * day_of_year + 2) // 153
        day_of_month = day_of_year - (153 * month_part + 2) // 5 + 1
        month = month_part + (3 if month_part < 10 else -9)
        year += 1 if month <= 2 else 0
        return "%04d-%02d-%02d" % (year, month, day_of_month)

    def _market(self, market_id: u256) -> dict:
        key = str(market_id)
        if key not in self.markets:
            raise gl.vm.UserError(EXPECTED + " unknown market")
        return json.loads(self.markets[key])

    def _save(self, market_id: u256, market: dict) -> None:
        self.markets[str(market_id)] = json.dumps(market, sort_keys=True, separators=(",", ":"))

    def _position(self, key: str) -> dict:
        if key in self.positions:
            return json.loads(self.positions[key])
        return {"side": NONE, "amount": "0", "claimed": False}

    def _sender(self) -> str:
        return str(gl.message.sender_address).lower()

    def _now(self) -> u256:
        text = str(gl.message_raw["datetime"])
        if len(text) < 19 or text[4] != "-" or text[7] != "-" or text[10] != "T":
            raise gl.vm.UserError(EXPECTED + " invalid transaction time")
        date = self._date(text[:10])
        try:
            hour, minute, second = int(text[11:13]), int(text[14:16]), int(text[17:19])
        except Exception:
            raise gl.vm.UserError(EXPECTED + " invalid transaction time")
        if text[13] != ":" or text[16] != ":" or hour > 23 or minute > 59 or second > 59:
            raise gl.vm.UserError(EXPECTED + " invalid transaction time")
        return date + u256(hour * 3600 + minute * 60 + second)

    def _date(self, value: str) -> u256:
        s = str(value)
        if (len(s) != 10 or s[4] != "-" or s[7] != "-" or
                not self._ascii_digits(s[:4]) or not self._ascii_digits(s[5:7]) or
                not self._ascii_digits(s[8:10])):
            raise gl.vm.UserError(EXPECTED + " date must be YYYY-MM-DD")
        try:
            y, m, d = int(s[:4]), int(s[5:7]), int(s[8:10])
        except Exception:
            raise gl.vm.UserError(EXPECTED + " malformed date")
        if y < 1970 or m < 1 or m > 12 or d < 1 or d > self._month_days(y, m):
            raise gl.vm.UserError(EXPECTED + " invalid date")
        y1 = y - 1
        before = (367 * m - 362) // 12
        if m > 2:
            before -= 1 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 2
        ordinal = 365 * y1 + y1 // 4 - y1 // 100 + y1 // 400 + before + d
        epoch_day = ordinal - 719163
        return u256(epoch_day * 86400)

    def _ascii_digits(self, value: str) -> bool:
        return len(value) > 0 and all(char in "0123456789" for char in value)

    def _month_days(self, year: int, month: int) -> int:
        if month == 2:
            return 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28
        return 30 if month in (4, 6, 9, 11) else 31

    def _weekday(self, epoch: u256) -> bool:
        day = int(epoch // DAY)
        return day % 7 not in (2, 3)  # 1970-01-01 was Thursday (index 0)
