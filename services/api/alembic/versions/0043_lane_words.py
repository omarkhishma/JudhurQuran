"""Lane's paragraph on each Quranic word (PLAN P3.1: Lane's English senses split per lemma).

A row names a word, Lane's article of its root and the paragraph in it that treats the word (its index among the
article's paragraphs), with Lane's headword as he keys it, the page the paragraph starts on and the rule that matched
them (`vocalised`, `verb-form`). The paragraph's words are the article's: read from it, never copied.

Revision ID: 0043
Revises: 0042
"""

from alembic import op

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.lane_words (
          lemma_id  integer not null references content.lemmas(id),
          entry_id  integer not null references content.lexicon_entries(id),
          para      smallint not null check (para >= 0),
          headword  text not null,
          page_ref  text,
          rule      text not null check (rule in ('vocalised', 'verb-form')),
          primary key (lemma_id, entry_id, para)
        );
        create index lane_words_entry_idx on content.lane_words (entry_id);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.lane_words")
