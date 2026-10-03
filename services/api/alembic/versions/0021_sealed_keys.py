"""Accounts, as the privacy page says them (P6.5, audit 11 F2, F4, F6).

A synced record's key named its content — a starred word, a verse written on, a root looked up — in a plain
column; now the key is sealed like the value, and found by a keyed hash only the server's data key can make. Shared
lookups are sealed whole. Deletions (tombstones) are purged after a stated period; the account remembers how far,
so a device behind that point resyncs in full. An account's id is kept for fifteen days after it is deleted — the
id only — so restoring a backup can delete it again.

Revision ID: 0021
Revises: 0020
"""

import json

from alembic import op
from sqlalchemy import text

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from jadhr_api.accounts import key_hash, seal

    op.execute(
        """
        alter table accounts.users add column tombstone_horizon bigint not null default 0;
        create table accounts.deleted_accounts (
          user_id     uuid primary key,
          deleted_at  timestamptz not null default now()
        );
        alter table accounts.records add column key_hash text, add column key_sealed bytea;
        alter table accounts.record_history add column key_hash text, add column key_sealed bytea;
        alter table accounts.lookup_events add column event bytea;
        """
    )
    conn = op.get_bind()
    for table in ("records", "record_history"):
        pk = "user_id, store, key" if table == "records" else "id"
        for r in conn.execute(text(f"select {pk}, user_id, store, key from accounts.{table}")).mappings():
            where = "user_id = :u and store = :s and key = :k" if table == "records" else "id = :id"
            conn.execute(
                text(f"update accounts.{table} set key_hash = :h, key_sealed = :sealed where {where}"),
                {
                    "h": key_hash(r["user_id"], r["store"], r["key"]),
                    "sealed": seal(r["key"].encode(), f"{r['user_id']}:{r['store']}:key"),
                    "u": r["user_id"],
                    "s": r["store"],
                    "k": r["key"],
                    "id": r.get("id"),
                },
            )
    for r in conn.execute(
        text("select ctid::text as c, user_id, lemma, root, verse from accounts.lookup_events")
    ).mappings():
        body = json.dumps(
            {"lemma": r["lemma"], "root": r["root"], "verse": r["verse"]}, ensure_ascii=False
        ).encode()
        conn.execute(
            text("update accounts.lookup_events set event = :e where ctid = cast(:c as tid)"),
            {"e": seal(body, f"{r['user_id']}:lookup"), "c": r["c"]},
        )
    op.execute(
        """
        alter table accounts.records drop constraint records_pkey;
        alter table accounts.records alter column key_hash set not null, alter column key_sealed set not null;
        alter table accounts.records drop column key;
        alter table accounts.records add primary key (user_id, store, key_hash);
        alter table accounts.record_history alter column key_hash set not null, alter column key_sealed set not null;
        alter table accounts.record_history drop column key;
        alter table accounts.lookup_events alter column event set not null;
        alter table accounts.lookup_events drop column lemma, drop column root, drop column verse;
        """
    )


def downgrade() -> None:
    from jadhr_api.accounts import unseal

    op.execute(
        """
        alter table accounts.records add column key text;
        alter table accounts.record_history add column key text;
        alter table accounts.lookup_events add column lemma text, add column root text, add column verse text;
        """
    )
    conn = op.get_bind()
    for table in ("records", "record_history"):
        for r in conn.execute(
            text(f"select ctid::text as c, user_id, store, key_sealed from accounts.{table}")
        ).mappings():
            key = unseal(bytes(r["key_sealed"]), f"{r['user_id']}:{r['store']}:key").decode()
            conn.execute(
                text(f"update accounts.{table} set key = :k where ctid = cast(:c as tid)"),
                {"k": key, "c": r["c"]},
            )
    for r in conn.execute(
        text("select ctid::text as c, user_id, event from accounts.lookup_events")
    ).mappings():
        e = json.loads(unseal(bytes(r["event"]), f"{r['user_id']}:lookup"))
        conn.execute(
            text(
                "update accounts.lookup_events set lemma = :l, root = :r, verse = :v where ctid = cast(:c as tid)"
            ),
            {"l": e.get("lemma"), "r": e.get("root"), "v": e.get("verse"), "c": r["c"]},
        )
    op.execute(
        """
        alter table accounts.records drop constraint records_pkey;
        alter table accounts.records drop column key_hash, drop column key_sealed;
        alter table accounts.records alter column key set not null;
        alter table accounts.records add primary key (user_id, store, key);
        alter table accounts.record_history drop column key_hash, drop column key_sealed;
        alter table accounts.record_history alter column key set not null;
        alter table accounts.lookup_events drop column event;
        drop table accounts.deleted_accounts;
        alter table accounts.users drop column tombstone_horizon;
        """
    )
