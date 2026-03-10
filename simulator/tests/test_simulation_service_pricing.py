from datetime import UTC, datetime, timedelta
import unittest

from app.services.simulation_service import SessionSimulationState, SimulationService


class SimulationServicePricingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = SimulationService()

    def test_active_state_rehydrates_booked_idle_on_restart(self) -> None:
        started_at = datetime(2026, 3, 10, 8, 12, tzinfo=UTC)
        session_doc = {
            "_id": "session-1",
            "booking": {
                "bookedAt": datetime(2026, 3, 10, 8, 0, tzinfo=UTC),
                "expiresAt": datetime(2026, 3, 10, 8, 30, tzinfo=UTC),
            },
            "charging": {
                "startedAt": started_at,
                "energyDeliveredKwh": 4.5,
                "socStartPercent": 25.0,
                "socStopPercent": 40.0,
            },
            "pricingSnapshot": {
                "priceCentsPerKwh": 55,
                "idleFee": {"priceCentsPerMinute": 20, "afterMinutes": 5},
            },
            "cost": {"idleCents": 0},
            "updatedAt": started_at + timedelta(minutes=3),
        }

        state = self.service._build_initial_session_state(session_doc)

        self.assertEqual(state.booked_idle_cents, 140)

    def test_booked_cost_update_caps_idle_at_booking_expiry(self) -> None:
        session_doc = {
            "booking": {
                "bookedAt": datetime(2026, 3, 10, 8, 0, tzinfo=UTC),
                "expiresAt": datetime(2026, 3, 10, 8, 30, tzinfo=UTC),
            },
            "pricingSnapshot": {
                "idleFee": {"priceCentsPerMinute": 20, "afterMinutes": 5},
            },
        }

        update = self.service._build_booked_session_cost_update(
            session_doc,
            datetime(2026, 3, 10, 10, 0, tzinfo=UTC),
        )

        self.assertEqual(update["cost.energyCents"], 0)
        self.assertEqual(update["cost.idleCents"], 500)
        self.assertEqual(update["cost.totalCents"], 500)

    def test_active_updates_preserve_existing_booked_idle_cents(self) -> None:
        timestamp = datetime(2026, 3, 10, 9, 0, tzinfo=UTC)
        state = SessionSimulationState(
            started_at=timestamp - timedelta(minutes=20),
            last_simulated_at=timestamp,
            meter_start_kwh=1000.0,
            cumulative_energy_kwh=12.0,
            soc_start_percent=20.0,
            soc_stop_percent=55.0,
            price_cents_per_kwh=55.0,
            battery_capacity_kwh=60.0,
            vehicle_max_power_kw=50.0,
            booked_idle_cents=180,
        )

        update = self.service._build_session_state_update(state, timestamp)

        self.assertEqual(update["cost.energyCents"], 660)
        self.assertEqual(update["cost.idleCents"], 180)
        self.assertEqual(update["cost.totalCents"], 840)


if __name__ == "__main__":
    unittest.main()
