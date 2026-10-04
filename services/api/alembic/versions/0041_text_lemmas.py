"""The Quranic lemmas each text beyond the Quran uses where the rules are sure of the word (LIB-Q08): the shelf's
"words known" for a hadith collection or a book is the share of these the reader knows — the reader's words sent in
a request body and kept nowhere, the text's set made once by the build.

Revision ID: 0041
Revises: 0040
"""

from alembic import op

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.text_lemmas (
          text_id   integer not null references content.texts(id),
          lemma_id  integer not null references content.lemmas(id),
          primary key (text_id, lemma_id)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.text_lemmas")
