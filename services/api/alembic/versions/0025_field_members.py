"""Semantic fields among the relation seeds (PLAN P8.4c, research 15).

A field is a chapter of al-Thaʿālibī's Fiqh al-Lugha or a heading of Ibn Sīda's al-Mukhaṣṣaṣ (a relation entry); its
members are the words the chapter names, each a ``field_member`` candidate mapped to its Quranic root. A source whose
reading is loose (al-Mukhaṣṣaṣ) is not shown to readers until the editorial board reviews its rows:
``shown_extracted`` says which.

Revision ID: 0025
Revises: 0024
"""

from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table content.relation_candidates drop constraint relation_candidates_type_check;
        alter table content.relation_candidates add constraint relation_candidates_type_check
          check (type in ('wujuh_sense', 'furuq_contrast', 'didd', 'near_synonym_candidate', 'field_member'));
        alter table content.relation_sources add column shown_extracted boolean not null default true;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        delete from content.relation_candidates where type = 'field_member';
        alter table content.relation_candidates drop constraint relation_candidates_type_check;
        alter table content.relation_candidates add constraint relation_candidates_type_check
          check (type in ('wujuh_sense', 'furuq_contrast', 'didd', 'near_synonym_candidate'));
        alter table content.relation_sources drop column shown_extracted;
        """
    )
