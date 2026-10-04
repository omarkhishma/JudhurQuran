"""The topic taxonomy (PLAN P8.3b, research 06 Part 3, D29): La Beaume's chapters as a source's headings, and the
editorial board's work on the taxonomy as a kind of its own.

``content.topics`` gains ``name_fr`` for a source that names its headings in French (La Beaume's index of 1878, kept
from readers). ``editorial.entries`` gains the kind ``topic``: the board's Arabic name for a heading and where it
stands in the tree — one of La Beaume's chapters adopted, one of Quranpedia's renamed or placed under another, or a
topic of the board's own with its source.

Revision ID: 0027
Revises: 0026
"""

from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.topics add column name_fr text;
        alter table content.topics drop constraint topics_check;
        alter table content.topics add constraint topics_check
          check (name_ar is not null or name_en is not null or name_fr is not null);

        alter table editorial.entries drop constraint entries_kind_check;
        alter table editorial.entries add constraint entries_kind_check
          check (kind in ('root_gloss', 'root_core', 'pattern_function', 'pattern_plain', 'sense_list', 'glossary',
                          'verdict', 'topic'));
        """
    )


def downgrade() -> None:
    op.execute(
        """
        delete from editorial.entries where kind = 'topic';
        alter table editorial.entries drop constraint entries_kind_check;
        alter table editorial.entries add constraint entries_kind_check
          check (kind in ('root_gloss', 'root_core', 'pattern_function', 'pattern_plain', 'sense_list', 'glossary',
                          'verdict'));
        delete from content.topic_links where topic_id in (select id from content.topics where name_fr is not null);
        delete from content.topics where name_fr is not null and name_ar is null and name_en is null;
        alter table content.topics drop constraint topics_check;
        alter table content.topics add constraint topics_check check (name_ar is not null or name_en is not null);
        alter table content.topics drop column name_fr;
        """
    )
