from datetime import UTC, datetime, timedelta
import unittest

from app.session_pricing import build_pricing_snapshot, calculate_booked_idle_cents


class SessionPricingTests(unittest.TestCase):
    def test_build_pricing_snapshot_uses_station_idle_price_and_grace(self) -> None:
        station = {
            "pricing": {
                "currency": "CHF",
                "defaultTariff": {
                    "priceCentsPerKwh": 72,
                    "priceCentsPerMinuteIdleAfterMinutes": 28,
                    "idleFeeAfterMinutes": 9,
                },
            }
        }

        snapshot = build_pricing_snapshot(station)

        self.assertEqual(
            snapshot,
            {
                "currency": "CHF",
                "priceCentsPerKwh": 72,
                "idleFee": {"priceCentsPerMinute": 28, "afterMinutes": 9},
            },
        )

    def test_build_pricing_snapshot_falls_back_to_default_grace(self) -> None:
        station = {
            "pricing": {
                "defaultTariff": {
                    "priceCentsPerKwh": 60,
                    "priceCentsPerMinuteIdleAfterMinutes": 18,
                }
            }
        }

        snapshot = build_pricing_snapshot(station)

        self.assertEqual(snapshot["idleFee"]["priceCentsPerMinute"], 18)
        self.assertEqual(snapshot["idleFee"]["afterMinutes"], 5)

    def test_booked_idle_starts_only_after_full_grace_minutes(self) -> None:
        booked_at = datetime(2026, 3, 10, 8, 0, tzinfo=UTC)
        idle_fee = {"priceCentsPerMinute": 20, "afterMinutes": 5}

        self.assertEqual(
            calculate_booked_idle_cents(
                booked_at=booked_at,
                reference_time=booked_at + timedelta(minutes=5, seconds=59),
                idle_fee=idle_fee,
            ),
            0,
        )
        self.assertEqual(
            calculate_booked_idle_cents(
                booked_at=booked_at,
                reference_time=booked_at + timedelta(minutes=6),
                idle_fee=idle_fee,
            ),
            20,
        )

    def test_booked_idle_is_capped_at_booking_expiry(self) -> None:
        booked_at = datetime(2026, 3, 10, 8, 0, tzinfo=UTC)
        expires_at = booked_at + timedelta(minutes=30)
        idle_fee = {"priceCentsPerMinute": 15, "afterMinutes": 5}

        idle_cents = calculate_booked_idle_cents(
            booked_at=booked_at,
            reference_time=booked_at + timedelta(hours=2),
            idle_fee=idle_fee,
            expires_at=expires_at,
        )

        self.assertEqual(idle_cents, 25 * 15)

    def test_booked_idle_can_be_carried_into_active_start(self) -> None:
        booked_at = datetime(2026, 3, 10, 8, 0, tzinfo=UTC)
        started_at = booked_at + timedelta(minutes=12)
        idle_fee = {"priceCentsPerMinute": 20, "afterMinutes": 5}

        idle_cents = calculate_booked_idle_cents(
            booked_at=booked_at,
            reference_time=started_at,
            idle_fee=idle_fee,
        )

        self.assertEqual(idle_cents, 7 * 20)


if __name__ == "__main__":
    unittest.main()
