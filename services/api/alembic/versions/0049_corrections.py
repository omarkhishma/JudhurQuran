"""Corrections to the layers the build made by rule (B58, RVQ-Q11): a hadith's split into isnād and matn, a name in its
isnād linked to a narrator, a dictionary article filed under a root, a book paragraph's printed page — through the same
queue and the same two approvals as a word's, the item named by its own address (hadith:…, dict:…, book:…) where a
word names its lemma; a name in an isnād by its position.

Revision ID: 0049
Revises: 0048
"""

from alembic import op

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        r"""
        alter table contributions.proposals drop constraint proposals_kind_check;
        alter table contributions.proposals add constraint proposals_kind_check
          check (kind in ('edit', 'sense', 'gloss', 'morphology', 'error', 'attest', 'entry', 'correction'));
        alter table contributions.proposals drop constraint proposals_lemma_check;
        alter table contributions.proposals add constraint proposals_lemma_check
          check (length(lemma) between 1 and 200);
        alter table contributions.proposals drop constraint proposals_location_check;
        alter table contributions.proposals add constraint proposals_location_check
          check (location is null or location ~ '^\d{1,3}:\d{1,3}(:\d{1,3})?$'
                 or (kind = 'correction' and location ~ '^\d{1,3}$'));
        alter table contributions.proposals add constraint proposals_correction_check
          check ((kind = 'correction') = (lemma ~ '^(hadith|book|dict):')
                 and (kind <> 'correction' or field in ('split', 'narrator', 'filing', 'page')));
        """
    )


def downgrade() -> None:
    op.execute(
        r"""
        delete from contributions.proposals where kind = 'correction';
        alter table contributions.proposals drop constraint proposals_correction_check;
        alter table contributions.proposals drop constraint proposals_location_check;
        alter table contributions.proposals add constraint proposals_location_check
          check (location is null or location ~ '^\d{1,3}:\d{1,3}(:\d{1,3})?$');
        alter table contributions.proposals drop constraint proposals_lemma_check;
        alter table contributions.proposals add constraint proposals_lemma_check check (length(lemma) between 1 and 80);
        alter table contributions.proposals drop constraint proposals_kind_check;
        alter table contributions.proposals add constraint proposals_kind_check
          check (kind in ('edit', 'sense', 'gloss', 'morphology', 'error', 'attest', 'entry'));
        """
    )
