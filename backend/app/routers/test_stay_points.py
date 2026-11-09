import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app.routers import stay_points


class StayPointAddressTests(unittest.IsolatedAsyncioTestCase):
    async def test_kakao_failure_preserves_stay(self):
        user_id = "test-user"
        locations = [
            {
                "id": str(index),
                "latitude": 37.5665,
                "longitude": 126.978,
                "recorded_at": f"2026-10-20T09:{minute:02d}:00+09:00",
            }
            for index, minute in enumerate([0, 5, 10, 15])
        ]

        query = MagicMock()
        for method in ["select", "eq", "gte", "lt", "order", "range"]:
            getattr(query, method).return_value = query

        query.execute.return_value = SimpleNamespace(data=locations)

        with (
            patch.object(stay_points, "supabase") as database,
            patch.object(
                stay_points,
                "reverse_geocode",
                new=AsyncMock(
                    side_effect=httpx.ConnectError("Test connection failure")
                ),
            ) as geocode,
        ):
            database.table.return_value = query

            result = await stay_points.get_stay_points(
                target_date=date(2026, 10, 20),
                user_id=user_id,
            )

        query.eq.assert_called_once_with("user_id", user_id)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["duration_minutes"], 15)
        self.assertEqual(result[0]["point_count"], 4)
        self.assertIsNone(result[0]["address"])
        geocode.assert_awaited_once_with(
            latitude=37.5665,
            longitude=126.978,
        )


if __name__ == "__main__":
    unittest.main()