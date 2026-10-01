import httpx

from app.core.config import KAKAO_REST_API_KEY


KAKAO_COORD2ADDRESS_URL = (
    "https://dapi.kakao.com/v2/local/geo/coord2address.json"
)


async def reverse_geocode(
    latitude: float,
    longitude: float,
) -> str | None:

    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }

    params = {
        "x": longitude,
        "y": latitude,
        "input_coord": "WGS84",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            KAKAO_COORD2ADDRESS_URL,
            headers=headers,
            params=params,
        )

        print("Kakao status:", response.status_code)
        print("Kakao response:", response.text)

        response.raise_for_status()

        data = response.json()

    documents = data.get("documents", [])

    if not documents:
        return None

    result = documents[0]

    road_address = result.get("road_address")
    address = result.get("address")

    if road_address:
        return road_address.get("address_name")

    if address:
        return address.get("address_name")

    return None