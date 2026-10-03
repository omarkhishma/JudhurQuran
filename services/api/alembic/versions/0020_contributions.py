"""Contribution and moderation (PLAN P7, decision D4): proposals, their review, merges, the changelog.

A reader proposes — an edited or a new sense, a gloss at a word's place, a morphology correction, an error report,
an attestation, a new entry — always naming a lemma, and never the Quranic text (L1, RVQ-Q03). Reviewers decide;
two distinct approvals, one of them from the appointed editorial board, merge (D4). The database refuses a
proposer deciding on their own proposal and a reviewer approving one revision twice, whatever the API does
(RVQ-40, Q01). A merge never overwrites a source: it is shown beside it, credited (DECISIONS), and can be
reverted; every merge and revert is in the changelog. Deleting an account removes its unmerged proposals and
every name; what was merged stays, credited to a former contributor.

Revision ID: 0020
Revises: 0019
"""

from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table accounts.users drop constraint users_role_check;
        alter table accounts.users add constraint users_role_check
          check (role in ('member', 'reviewer', 'editor', 'instructor', 'admin'));
        -- abuse control: a blocked account can neither propose nor decide
        alter table accounts.users add column blocked_at timestamptz;

        create schema if not exists contributions;

        create table contributions.proposals (
          id               uuid primary key default gen_random_uuid(),
          kind             text not null check (kind in ('edit', 'sense', 'gloss', 'morphology', 'error', 'attest', 'entry')),
          lemma            text not null check (length(lemma) between 1 and 80),
          sense_ordinal    smallint,
          location         text check (location is null or location ~ '^\\d{1,3}:\\d{1,3}(:\\d{1,3})?$'),
          field            text,
          current_text     text not null default '' check (length(current_text) <= 4000),
          text             text not null check (length(text) between 1 and 4000),
          why              text not null check (length(why) between 1 and 4000),
          sources          jsonb not null default '[]',
          proposer_id      uuid references accounts.users(id) on delete set null,
          status           text not null default 'open'
                             check (status in ('open', 'approved', 'changes', 'merged', 'declined', 'withdrawn')),
          revision         smallint not null default 1,
          note             text,
          dataset_version  text not null,
          created_at       timestamptz not null default now(),
          updated_at       timestamptz not null default now(),
          decided_at       timestamptz,
          check (kind <> 'edit' or sense_ordinal is not null),
          -- a gloss names a word's place, or none for the lemma's own gloss; a morphology field always a place
          check (kind <> 'morphology' or location is not null),
          check (kind <> 'morphology' or field is not null)
        );
        create index proposals_status_idx on contributions.proposals (status, created_at desc);
        create index proposals_proposer_idx on contributions.proposals (proposer_id, created_at desc);
        create index proposals_lemma_idx on contributions.proposals (lemma);

        -- every decision, kept: the audit log of the queue
        create table contributions.decisions (
          id             bigserial primary key,
          proposal_id    uuid not null references contributions.proposals(id) on delete cascade,
          revision       smallint not null,
          reviewer_id    uuid references accounts.users(id) on delete set null,
          reviewer_role  text not null,
          decision       text not null check (decision in ('approve', 'decline', 'changes')),
          note           text check (note is null or length(note) <= 2000),
          created_at     timestamptz not null default now()
        );
        create index decisions_proposal_idx on contributions.decisions (proposal_id, created_at);
        -- no double-approve: one approval per reviewer and revision (RVQ-39, 73)
        create unique index decisions_one_approval on contributions.decisions (proposal_id, revision, reviewer_id)
          where decision = 'approve';

        -- no self-approve, in the database as well as the API (RVQ-40)
        create function contributions.no_self_decision() returns trigger language plpgsql as $$
        begin
          if new.reviewer_id is not null and exists (
            select 1 from contributions.proposals p where p.id = new.proposal_id and p.proposer_id = new.reviewer_id
          ) then
            raise exception 'a proposer cannot decide on their own proposal' using errcode = 'check_violation';
          end if;
          return new;
        end $$;
        create trigger decisions_no_self before insert on contributions.decisions
          for each row execute function contributions.no_self_decision();

        -- what the reader shows: a merged edit or sense, a gloss, a correction — beside the source, never over it
        create table contributions.merges (
          id                uuid primary key default gen_random_uuid(),
          proposal_id       uuid not null unique references contributions.proposals(id),
          kind              text not null,
          lemma             text not null,
          sense_ordinal     smallint,
          location          text,
          field             text,
          previous_text     text not null default '',
          text              text not null,
          sources           jsonb not null,
          contributor_id    uuid references accounts.users(id) on delete set null,
          contributor_name  text,
          reviewers         jsonb not null,
          merged_at         timestamptz not null default now(),
          reverted_at       timestamptz,
          reverted_by       uuid references accounts.users(id) on delete set null,
          revert_note       text check (revert_note is null or length(revert_note) <= 2000)
        );
        create index merges_lemma_idx on contributions.merges (lemma, merged_at);

        create table contributions.changelog (
          id               bigserial primary key,
          at               timestamptz not null default now(),
          event            text not null check (event in ('merged', 'reverted')),
          merge_id         uuid not null references contributions.merges(id),
          dataset_version  text not null
        );

        create table contributions.reports (
          id           bigserial primary key,
          proposal_id  uuid not null references contributions.proposals(id) on delete cascade,
          reporter_id  uuid references accounts.users(id) on delete set null,
          reason       text not null check (length(reason) between 1 and 1000),
          created_at   timestamptz not null default now(),
          resolved_at  timestamptz
        );
        create unique index reports_once on contributions.reports (proposal_id, reporter_id);

        -- who gave whom which role, and why (earned by merged contributions, or appointed)
        create table contributions.role_grants (
          id          bigserial primary key,
          user_id     uuid references accounts.users(id) on delete set null,
          role        text not null,
          granted_by  uuid references accounts.users(id) on delete set null,
          reason      text,
          at          timestamptz not null default now()
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop schema contributions cascade;
        alter table accounts.users drop column blocked_at;
        alter table accounts.users drop constraint users_role_check;
        update accounts.users set role = 'reviewer' where role = 'editor';
        alter table accounts.users add constraint users_role_check
          check (role in ('member', 'reviewer', 'instructor', 'admin'));
        """
    )
