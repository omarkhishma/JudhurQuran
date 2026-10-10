"""The administration's own kinds of editorial work (PLAN P14, D31, D32): a sūra's passages (``context_passages``), a
word's own context with its contextual statement (``context_word``), and a word's near, related and opposite words
(``word_relations``).

These three may be put in force by the administration directly: an administrator's entry of these kinds comes into
force when they publish it, with no second approval, and the board may review it afterwards (a review row on the
revision in force). Every other kind still needs an editor other than its author, and now the database says so too:
an entry comes into force only with such an approval of its revision, or as an administrator's direct publication of
one of these kinds.

Revision ID: 0053
Revises: 0052
"""

from alembic import op

revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None

KINDS = "'root_gloss', 'root_core', 'pattern_function', 'pattern_plain', 'sense_list', 'glossary', 'verdict', 'topic'"
NEW = "'context_passages', 'context_word', 'word_relations'"


def upgrade() -> None:
    op.execute(
        f"""
        alter table editorial.entries drop constraint entries_kind_check;
        alter table editorial.entries add constraint entries_kind_check check (kind in ({KINDS}, {NEW}));

        alter table editorial.log drop constraint log_action_check;
        alter table editorial.log add constraint log_action_check
          check (action in ('saved', 'submitted', 'approved', 'changes', 'withdrawn', 'retired', 'published',
                            'reviewed'));

        create function editorial.in_force_check() returns trigger language plpgsql as $$
        begin
          if new.status = 'approved' and old.status is distinct from 'approved' then
            if exists (
              select 1 from editorial.reviews r
              where r.entry_id = new.id and r.revision = new.revision and r.decision = 'approve'
                and r.reviewer_id is distinct from new.author_id
            ) then
              return new;
            end if;
            if new.kind in ({NEW}) and exists (
              select 1 from accounts.users u
              where u.id = new.author_id and u.role = 'admin' and u.blocked_at is null
            ) then
              return new;
            end if;
            raise exception 'an entry comes into force only by another editor''s approval, or as an administrator''s publication of their own kinds'
              using errcode = 'check_violation';
          end if;
          return new;
        end $$;
        create trigger entries_in_force before update on editorial.entries
          for each row execute function editorial.in_force_check();

        -- a word's relations are read from both of its ends (a link defined on either word shows on both)
        create index entries_relations_links on editorial.entries using gin (value jsonb_path_ops)
          where kind = 'word_relations' and status = 'approved';
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        drop index editorial.entries_relations_links;
        drop trigger entries_in_force on editorial.entries;
        drop function editorial.in_force_check();
        delete from editorial.entries where kind in ({NEW});
        alter table editorial.log drop constraint log_action_check;
        alter table editorial.log add constraint log_action_check
          check (action in ('saved', 'submitted', 'approved', 'changes', 'withdrawn', 'retired'));
        alter table editorial.entries drop constraint entries_kind_check;
        alter table editorial.entries add constraint entries_kind_check check (kind in ({KINDS}));
        """
    )
