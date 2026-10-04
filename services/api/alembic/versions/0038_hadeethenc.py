"""HadeethEnc's explanations (P11.2c): the Arabic export v1.7.0 verbatim — the publisher's terms forbid any change and
ask for the version — and each item's link to the hadith of the Six Books it cites by number, with how much of its
wording our record holds (``agrees``, ``partly``; ``disagrees`` kept for review, never shown).

Revision ID: 0038
Revises: 0037
"""

from alembic import op

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.hadeethenc_items (
          id             integer primary key,
          title          text not null,
          text           text not null,
          explanation    text not null,
          word_meanings  jsonb not null default '[]',
          benefits       text[] not null default '{}',
          grade          text,
          attribution    text,
          link           text,
          reference      text,
          version        text not null
        );
        create table content.hadeethenc_links (
          id          integer primary key,
          item_id     integer not null references content.hadeethenc_items(id),
          passage_id  integer not null references content.passages(id),
          book        text not null,
          number      integer not null,
          agreement   real not null check (agreement between 0 and 1),
          status      text not null check (status in ('agrees', 'partly', 'disagrees'))
        );
        create index hadeethenc_links_passage on content.hadeethenc_links (passage_id);
        create index hadeethenc_links_item on content.hadeethenc_links (item_id);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.hadeethenc_links; drop table content.hadeethenc_items")
