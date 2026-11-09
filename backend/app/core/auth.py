import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import SUPABASE_KEY, SUPABASE_URL


bearer = HTTPBearer(auto_error=False)


async def require_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {credentials.credentials}",
                },
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="인증 서버에 연결할 수 없습니다.",
        ) from None

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=401,
            detail="로그인 토큰이 유효하지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail="인증 서버가 요청을 처리하지 못했습니다.",
        )

    return response.json()["id"]