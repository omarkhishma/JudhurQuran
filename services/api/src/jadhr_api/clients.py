"""Whom a request comes from, for limits only — never stored with what it asked, never logged (F1).

The first X-Forwarded-For entry is the address Caddy saw: Caddy writes that header itself and, trusting no proxy
before it, replaces whatever a client sent; without Caddy (development) the socket's peer. An IPv6 address counts by
its /64 — the block one home or one server is given — so turning over addresses inside it escapes no limit (security
review L4); an IPv4 address inside IPv6 counts as itself."""

from __future__ import annotations

import ipaddress

from starlette.requests import HTTPConnection


def client_address(conn: HTTPConnection) -> str:
    forwarded = conn.headers.get("x-forwarded-for")
    return (forwarded or (conn.client.host if conn.client else "?")).split(",")[0].strip()


def key_of(address: str) -> str:
    try:
        ip = ipaddress.ip_address(address.split("%")[0])
    except ValueError:
        return address
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped:
            return str(ip.ipv4_mapped)
        return str(ipaddress.IPv6Network(f"{ip}/64", strict=False))
    return str(ip)


def client_key(conn: HTTPConnection) -> str:
    """The key a request's limits are counted under."""
    return key_of(client_address(conn))
