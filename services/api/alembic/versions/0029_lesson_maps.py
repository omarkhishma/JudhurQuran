"""A lesson's shared map (PLAN P9.3, research 16): a map its instructor shares (P8.1-E) and names for the lesson,
read and commented by the class only; what members propose for it, confirmed or declined by the instructor; and the
lesson's activity — the instructor's saves as cards added, removed and linked, proposals made and decided.

A proposal is a member's own act, made under their name for the class to see; leaving the class takes it, with
their activity and their comments on the class's maps (jadhr_api.classroom.leave). A lesson deleted takes its map's
shared copy, so a class's map never stays behind as a link anyone could read.

Revision ID: 0029
Revises: 0028
"""

from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        -- the lesson's map: one shared map, one lesson
        alter table classroom.lessons add column graph_id uuid references graphs.documents(id) on delete set null;
        create unique index lessons_graph_idx on classroom.lessons (graph_id) where graph_id is not null;

        -- a member's proposal: the cards and links they added to the map as it was at `base_revision`
        create table classroom.proposals (
          id             uuid primary key default gen_random_uuid(),
          lesson_id      uuid not null references classroom.lessons(id) on delete cascade,
          user_id        uuid not null references accounts.users(id) on delete cascade,
          base_revision  integer not null,
          cards          jsonb not null,
          links          jsonb not null,
          note           text not null default '' check (length(note) <= 500),
          status         text not null default 'pending'
                         check (status in ('pending', 'confirmed', 'declined', 'withdrawn')),
          decided_by     uuid references accounts.users(id) on delete set null,
          decided_at     timestamptz,
          created_at     timestamptz not null default now()
        );
        create index proposals_lesson_idx on classroom.proposals (lesson_id, status, created_at desc);
        create index proposals_user_idx on classroom.proposals (user_id);

        -- what happened on the lesson's map, in the product's words: the cards it touched, never a reader's trail
        create table classroom.activity (
          id         bigserial primary key,
          lesson_id  uuid not null references classroom.lessons(id) on delete cascade,
          who        uuid references accounts.users(id) on delete cascade,
          kind       text not null check (kind in ('edited', 'proposed', 'confirmed', 'declined')),
          detail     jsonb not null default '{}',
          at         timestamptz not null default now()
        );
        create index activity_lesson_idx on classroom.activity (lesson_id, at desc, id desc);
        create index activity_who_idx on classroom.activity (who);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop table classroom.activity;
        drop table classroom.proposals;
        alter table classroom.lessons drop column graph_id;
        """
    )
