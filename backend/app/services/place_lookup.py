import asyncio
from dataclasses import dataclass

import httpx

from app.core.config import KAKAO_REST_API_KEY


KAKAO_CATEGORY_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/category.json"
CATEGORY_GROUPS = ("CE7", "FD6", "SC4", "AC5", "HP8", "CT1", "AT4", "MT1", "CS2")
PLACE_SEARCH_RADIUS_METERS = 100


@dataclass(frozen=True)
class NearbyPlace:
    name: str
    category: str
    category_group_code: str
    address: str | None
    distance_meters: int | None


async def find_nearby_places(
    latitude: float, longitude: float, *, per_category: int = 1
) -> list[NearbyPlace]:
    """Find named Kakao places in supported category groups, nearest first."""
    if not KAKAO_REST_API_KEY:
        return []

    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    async with httpx.AsyncClient(timeout=8.0) as client:
        results = await asyncio.gather(*(
            _search_category(client, headers, category, latitude, longitude, per_category)
            for category in CATEGORY_GROUPS
        ))

    return sorted((place for group in results for place in group), key=lambda place: (
        place.distance_meters if place.distance_meters is not None else PLACE_SEARCH_RADIUS_METERS + 1
    ))


async def _search_category(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    category: str,
    latitude: float,
    longitude: float,
    size: int,
) -> list[NearbyPlace]:
    try:
        response = await client.get(
            KAKAO_CATEGORY_SEARCH_URL,
            headers=headers,
            params={
                "category_group_code": category,
                "x": longitude,
                "y": latitude,
                "radius": PLACE_SEARCH_RADIUS_METERS,
                "sort": "distance",
                "size": size,
            },
        )
        response.raise_for_status()
        documents = response.json().get("documents", [])
    except (httpx.HTTPError, ValueError):
        return []
    places = []
    for result in documents:
        if not result.get("place_name"):
            continue
        distance = str(result.get("distance", ""))
        places.append(NearbyPlace(
            name=result["place_name"],
            category=result.get("category_group_name") or result.get("category_name") or "",
            category_group_code=result.get("category_group_code") or category,
            address=result.get("road_address_name") or result.get("address_name") or None,
            distance_meters=int(distance) if distance.isdecimal() else None,
        ))
    return places
