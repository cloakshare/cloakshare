"""Cloak Python SDK — secure document sharing."""

import hashlib
import hmac
import math
import random
import time
from typing import Any, Dict, Generator, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

__version__ = "0.1.0"


class CloakError(Exception):
    """Error returned by the Cloak API."""

    def __init__(self, code: str, message: str, status: int, retry_after: Optional[int] = None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.retry_after = retry_after


class Cloak:
    """Cloak API client.

    Usage:
        client = Cloak(api_key="ck_live_...")
        link = client.links.create(filename="doc.pdf", file=open("doc.pdf", "rb").read())
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.cloakshare.dev",
        timeout: int = 30,
        max_retries: int = 3,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        self._session = requests.Session()
        retry = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        )
        self._session.mount("https://", HTTPAdapter(max_retries=retry))
        self._session.mount("http://", HTTPAdapter(max_retries=retry))
        self._session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })

        self.links = Links(self)
        self.webhooks = Webhooks(self)

    def _request(self, method: str, path: str, **kwargs) -> Any:
        url = f"{self.base_url}{path}"
        resp = self._session.request(method, url, timeout=self.timeout, **kwargs)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "60"))
            data = resp.json()
            raise CloakError(
                data.get("error", {}).get("code", "RATE_LIMITED"),
                data.get("error", {}).get("message", "Rate limited"),
                429,
                retry_after,
            )

        if not resp.ok:
            data = resp.json()
            raise CloakError(
                data.get("error", {}).get("code", "UNKNOWN"),
                data.get("error", {}).get("message", f"HTTP {resp.status_code}"),
                resp.status_code,
            )

        return resp.json().get("data")

    @staticmethod
    def verify_webhook(
        payload: str,
        signature: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> bool:
        """Verify a Cloak webhook signature (HMAC-SHA256)."""
        parts = dict(p.split("=", 1) for p in signature.split(",") if "=" in p)
        ts = parts.get("t")
        sig = parts.get("v1")

        if not ts or not sig:
            return False

        timestamp = int(ts)
        now = int(time.time())

        if abs(now - timestamp) > tolerance_seconds:
            return False

        expected = hmac.new(
            secret.encode(),
            f"{timestamp}.{payload}".encode(),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(sig, expected)


class Links:
    """Links resource."""

    def __init__(self, client: Cloak):
        self._client = client

    def create(self, **kwargs) -> Dict[str, Any]:
        """Create a secure link."""
        file_data = kwargs.pop("file", None)
        filename = kwargs.pop("filename", "document.pdf")

        if file_data:
            files = {"file": (filename, file_data)}
            data = {k: str(v) for k, v in kwargs.items() if v is not None}
            # Use multipart - remove default Content-Type
            headers = {"Authorization": f"Bearer {self._client.api_key}"}
            resp = self._client._session.post(
                f"{self._client.base_url}/v1/links",
                files=files,
                data=data,
                headers=headers,
                timeout=self._client.timeout,
            )
            if not resp.ok:
                err = resp.json()
                raise CloakError(
                    err.get("error", {}).get("code", "UNKNOWN"),
                    err.get("error", {}).get("message", f"HTTP {resp.status_code}"),
                    resp.status_code,
                )
            return resp.json().get("data")

        return self._client._request("POST", "/v1/links", json=kwargs)

    def get(self, link_id: str) -> Dict[str, Any]:
        """Get link details."""
        return self._client._request("GET", f"/v1/links/{link_id}")

    def list(self, page: int = 1, limit: int = 25, status: Optional[str] = None) -> Dict[str, Any]:
        """List links."""
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        return self._client._request("GET", "/v1/links", params=params)

    def list_all(self, status: Optional[str] = None, limit: int = 100) -> Generator[Dict[str, Any], None, None]:
        """Generator that paginates through all links."""
        page = 1
        while True:
            result = self.list(page=page, limit=limit, status=status)
            for link in result["links"]:
                yield link
            if page >= result["pagination"]["pages"]:
                break
            page += 1

    def analytics(self, link_id: str) -> Dict[str, Any]:
        """Get link analytics."""
        return self._client._request("GET", f"/v1/links/{link_id}/analytics")

    def revoke(self, link_id: str) -> Dict[str, Any]:
        """Revoke a link."""
        return self._client._request("DELETE", f"/v1/links/{link_id}")


class Webhooks:
    """Webhooks resource."""

    def __init__(self, client: Cloak):
        self._client = client

    def create(self, url: str, events: List[str]) -> Dict[str, Any]:
        """Create a webhook endpoint."""
        return self._client._request("POST", "/v1/webhooks", json={"url": url, "events": events})

    def list(self) -> Dict[str, Any]:
        """List webhook endpoints."""
        return self._client._request("GET", "/v1/webhooks")

    def get(self, webhook_id: str) -> Dict[str, Any]:
        """Get webhook details."""
        return self._client._request("GET", f"/v1/webhooks/{webhook_id}")

    def delete(self, webhook_id: str) -> Dict[str, Any]:
        """Delete a webhook endpoint."""
        return self._client._request("DELETE", f"/v1/webhooks/{webhook_id}")
