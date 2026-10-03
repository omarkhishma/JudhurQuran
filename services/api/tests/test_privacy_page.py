"""The privacy page says the periods the code keeps (P6.5, audit 11: the page and the settings were changed apart).

Each period is read from where it is set — the API's settings, the sync module, the purge, the web server's log and
the backup service — and the page, in both languages, must say it. Changing a period without the page fails here.
"""

from __future__ import annotations

import math
import re
from pathlib import Path

from jadhr_api import sync
from jadhr_api.settings import Settings

ROOT = Path(__file__).resolve().parents[3]
PAGE = (ROOT / "apps/web/src/app/[locale]/(site)/privacy/page.tsx").read_text(encoding="utf-8")
AR, EN = PAGE.split("  return (\n    <Prose>", 1)
DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def ar(n: int) -> str:
    return str(n).translate(DIGITS)


def periods() -> dict[str, int]:
    s = Settings()
    caddy = (ROOT / "infra/Caddyfile").read_text(encoding="utf-8")
    keep_h = int(re.search(r"roll_keep_for (\d+)h", caddy).group(1))  # type: ignore[union-attr]
    roll_h = int(re.search(r"roll_interval (\d+)h", caddy).group(1))  # type: ignore[union-attr]
    compose = (ROOT / "infra/compose.prod.yml").read_text(encoding="utf-8")
    backup_min = int(re.search(r"accounts-\*\.sql\.gz' -mmin \+(\d+) -delete", compose).group(1))  # type: ignore[union-attr]
    accounts = (ROOT / "services/api/src/jadhr_api/accounts.py").read_text(encoding="utf-8")
    deleted_days = int(
        re.search(r"deleted_accounts where deleted_at < now\(\) - interval '(\d+) days'", accounts).group(1)
    )  # type: ignore[union-attr]
    return {
        "link": s.login_token_minutes,
        "session": s.session_days,
        "history": s.history_days,
        "tombstones": s.tombstone_days,
        "lookups": s.lookup_retention_days,
        "log": (keep_h + roll_h) // 24,
        # a dump is made, and the old ones deleted, once a day: one goes at the first run past the cut-off
        "backups": math.ceil(backup_min / 1440),
        "deleted": deleted_days,
        "records": sync.MAX_RECORDS,
    }


def test_the_page_says_every_period_the_code_keeps() -> None:
    p = periods()
    assert p["lookups"] == 365 and p["log"] == 7 and p["records"] == 20_000, p  # the words below say these
    en = {
        "link": f"works once, within {p['link']} minutes",
        "session": f"signed in for {p['session']} days",
        "history": f"the other for {p['history']} days",
        "tombstones": f"kept {p['tombstones']} days, then deleted",
        "lookups": "Lookups you share: one year.",
        "log": "deletes the log after seven days",
        "backups": f"are kept {p['backups']} days, so a deleted account leaves them within {p['backups']} days",
        "deleted": f"alone is kept {p['deleted']} days",
        "records": "holds up to 20,000 items",
    }
    arabic = {
        "link": f"يعمل مرة واحدة خلال {ar(p['link'])} دقيقة",
        "session": f"ينتهي بعد {ar(p['session'])} يومًا",
        "history": f"وتُحفظ الأخرى {ar(p['history'])} يومًا",
        "tombstones": f"تُحفظ {ar(p['tombstones'])} يومًا ثم تُحذف",
        "lookups": "ما تشاركه مما تبحث عنه: سنة واحدة.",
        "log": "ويُحذف السجلّ بعد سبعة أيام",
        "backups": f"تُحفظ {ar(p['backups'])} يومًا، فيخرج منها الحساب المحذوف خلال {ar(p['backups'])} يومًا",
        "deleted": f"وحده {ar(p['deleted'])} يومًا",
        "records": "يتسع الحساب لعشرين ألف عنصر",
    }
    missing = [f"en {k}: {v}" for k, v in en.items() if v not in EN] + [
        f"ar {k}: {v}" for k, v in arabic.items() if v not in AR
    ]
    assert not missing, missing
