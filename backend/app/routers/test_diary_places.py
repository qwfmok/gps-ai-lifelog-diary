import json
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import diaries
from app.services import diary_places, place_inference
from app.services.place_lookup import NearbyPlace


class DiaryPlaceApiTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(diaries.router)
        app.dependency_overrides[diaries.require_user_id] = lambda: "test-user"
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_draft_uses_grounded_place_and_falls_back_to_observed_address(self):
        cafe = NearbyPlace("중앙카페", "카페", "CE7", "중앙로 20", 12)
        market = NearbyPlace("중앙마트", "마트", "MT1", "중앙로 22", 8)
        stays = [
            {
                "started_at": "2026-11-26T09:00:00+09:00",
                "ended_at": "2026-11-26T09:15:00+09:00",
                "duration_minutes": 15,
                "source_place_name": "가져온 도서관",
                "nearby_places": [cafe],
            },
            {
                "started_at": "2026-11-26T12:00:00+09:00",
                "ended_at": "2026-11-26T12:30:00+09:00",
                "duration_minutes": 30,
                "observed_address": "중앙로 10",
                "nearby_places": [cafe, market],
            },
        ]
        selections = diary_places.PlaceSelections(selections=[
            diary_places.PlaceSelection(observation_index=1, candidate_index=99),
            diary_places.PlaceSelection(observation_index=2, candidate_index=1),
        ])
        response = SimpleNamespace(status="completed", output_parsed=selections)

        with (
            patch.dict("os.environ", {
                "DIARY_GENERATION_MODE": "openai",
                "OPENAI_API_KEY": "test-key",
                "OPENAI_DIARY_MODEL": "test-model",
            }),
            patch.object(diaries, "build_daily_stays", new=AsyncMock(return_value=stays)) as load_stays,
            patch.object(diaries, "load_timeline_notes", new=AsyncMock(return_value=[])),
            patch.object(diaries, "generate_diary_draft", new=AsyncMock(return_value="일기 초안")) as draft,
            patch.object(place_inference, "find_nearby_places", new=AsyncMock(return_value=[market, cafe])) as lookup,
            patch.object(place_inference, "reverse_geocode", new=AsyncMock(return_value="중앙로 20")),
            patch.object(diary_places, "AsyncOpenAI") as openai,
            patch.object(diaries, "supabase") as database,
        ):
            parse = AsyncMock(return_value=response)
            openai.return_value.__aenter__.return_value.responses.parse = parse
            result = self.client.post("/api/diaries/generate", json={
                "diary_date": "2026-11-26",
                "current_location": {
                    "latitude": 37.5,
                    "longitude": 127.0,
                    "accuracy": 10,
                    "recorded_at": "2026-11-25T16:00:00Z",
                },
            })

        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["uncertain_points"], [
            "체류 장소 미확인 · 중앙로 10", "현재 장소 추정 · 중앙카페",
        ])
        self.assertIn("가져온 도서관에서 15분 체류", result.json()["used_facts"])
        load_stays.assert_awaited_once_with(date(2026, 11, 26), "test-user", include_place_candidates=True)
        lookup.assert_awaited_once_with(37.5, 127.0, per_category=3)
        evidence = json.loads(parse.await_args.kwargs["input"])
        self.assertEqual([item["observation_index"] for item in evidence], [1, 2])
        self.assertEqual(evidence[1]["accuracy_meters"], 10)
        self.assertNotIn("latitude", evidence[1])
        context = json.loads(draft.await_args.args[0])
        self.assertIsNone(context["stays"][1]["place_name"])
        self.assertEqual(context["stays"][1]["address"], "중앙로 10")
        self.assertEqual(context["current_location"]["place_name"], "중앙카페")
        self.assertTrue(context["current_location"]["place_inferred"])
        self.assertNotIn("duration_minutes", context["current_location"])
        self.assertNotIn("latitude", context["current_location"])
        database.table.assert_not_called()

    def test_current_location_must_match_the_diary_date_in_korea(self):
        with patch.object(diaries, "build_daily_stays", new_callable=AsyncMock) as load_stays:
            result = self.client.post("/api/diaries/generate", json={
                "diary_date": "2026-11-25",
                "current_location": {
                    "latitude": 37.5,
                    "longitude": 127.0,
                    "recorded_at": "2026-11-25T16:00:00Z",
                },
            })

        self.assertEqual(result.status_code, 422)
        load_stays.assert_not_awaited()
