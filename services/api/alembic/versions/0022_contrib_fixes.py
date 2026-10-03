"""Contribution and moderation, as the audit found them wanting (P7.5, research 12 F4, F5, F12, F14).

A reverted merge is no longer counted as merged: its proposal gets a status of its own. Reports are read and
resolved by the board, who resolved each and how is kept. Two merges of a new sense for one word cannot take the
same number. Credit names are no longer copied into a merge: they are read from the account when shown, so a name
changed or cleared reaches every credit — the copies already made are cleared.

Revision ID: 0022
Revises: 0021
"""

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table contributions.proposals drop constraint proposals_status_check;
        alter table contributions.proposals add constraint proposals_status_check
          check (status in ('open', 'approved', 'changes', 'merged', 'declined', 'withdrawn', 'reverted'));
        update contributions.proposals p set status = 'reverted'
          from contributions.merges m where m.proposal_id = p.id and m.reverted_at is not null and p.status = 'merged';

        alter table contributions.reports
          add column resolved_by uuid references accounts.users(id) on delete set null,
          add column outcome text check (outcome is null or outcome in ('dismissed', 'acted')),
          add column resolution_note text check (resolution_note is null or length(resolution_note) <= 2000);

        create unique index merges_one_sense_number on contributions.merges (lemma, sense_ordinal)
          where kind = 'sense' and reverted_at is null;

        update contributions.merges set contributor_name = null;
        update contributions.merges set reviewers = (
          select coalesce(jsonb_agg(r - 'name'), '[]'::jsonb) from jsonb_array_elements(reviewers) r);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop index contributions.merges_one_sense_number;
        alter table contributions.reports drop column resolution_note, drop column outcome, drop column resolved_by;
        update contributions.proposals set status = 'merged' where status = 'reverted';
        alter table contributions.proposals drop constraint proposals_status_check;
        alter table contributions.proposals add constraint proposals_status_check
          check (status in ('open', 'approved', 'changes', 'merged', 'declined', 'withdrawn'));
        """
    )
