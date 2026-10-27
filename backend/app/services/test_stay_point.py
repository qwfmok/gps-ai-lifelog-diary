import unittest

from app.services.stay_points import detect_stay_points


def make_point(minute, latitude=37.5665):
    return {
        "latitude": latitude,
        "longitude": 126.978,
        "recorded_at": f"2026-10-27T09:{minute:02d}:00+09:00",
    }


class StayPointTests(unittest.TestCase):
    def test_stays_for_15_minutes(self):
        points = [make_point(m) for m in [0, 5, 10, 15]]

        stays = detect_stay_points(points)

        self.assertEqual(len(stays), 1)
        self.assertEqual(stays[0]["duration_minutes"], 15)
        self.assertEqual(stays[0]["point_count"], 4)

    def test_short_visit_is_not_a_stay(self):
        points = [make_point(m) for m in [0, 5, 10]]

        self.assertEqual(detect_stay_points(points), [])

    def test_long_gap_is_not_continuous_stay(self):
        points = [make_point(0), make_point(30)]

        self.assertEqual(detect_stay_points(points), [])

    def test_moving_points_are_not_a_stay(self):
        # 위도 0.002도 차이는 약 222m입니다.
        points = [
            make_point(0, 37.5665),
            make_point(5, 37.5685),
            make_point(10, 37.5705),
            make_point(15, 37.5725),
        ]

        self.assertEqual(detect_stay_points(points), [])

    def test_empty_input(self):
        self.assertEqual(detect_stay_points([]), [])

    def test_unsorted_records(self):
        points = [make_point(m) for m in [15, 0, 10, 5]]

        stays = detect_stay_points(points)

        self.assertEqual(len(stays), 1)
        self.assertEqual(stays[0]["duration_minutes"], 15)


if __name__ == "__main__":
    unittest.main()