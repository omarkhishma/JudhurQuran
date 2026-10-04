"""The classroom (PLAN P9, research 16): classes, their members and lessons, and what a learner's reader sends for
an open lesson — counts per word and day, a lesson's progress — with the instructor's lesson notes and the
reminders a class sends.

Nothing of a reader's study is here unless they joined a class, which tells them beforehand what the instructor
sees (`consent_version` records which wording they agreed to), and only for the verses of a lesson that is open.
A member's detail is visible to the instructor only by the member's own choice (`detail_opt_in`), never in a class
marked for minors. Leaving a class, or being removed, deletes what it held of the member; a lesson's counts go 90
days after its due date (jadhr_api.classroom.purge).

Revision ID: 0028
Revises: 0027
"""

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create schema if not exists classroom;

        create table classroom.classes (
          id             uuid primary key default gen_random_uuid(),
          instructor_id  uuid not null references accounts.users(id) on delete cascade,
          name           text not null check (length(name) between 1 and 120),
          minors         boolean not null default false,
          join_code      text not null unique check (join_code ~ '^[a-z0-9]{10}$'),
          created_at     timestamptz not null default now(),
          archived_at    timestamptz
        );
        create index classes_instructor_idx on classroom.classes (instructor_id);

        create table classroom.members (
          class_id         uuid not null references classroom.classes(id) on delete cascade,
          user_id          uuid not null references accounts.users(id) on delete cascade,
          joined_at        timestamptz not null default now(),
          detail_opt_in    boolean not null default false,
          consent_version  text not null,
          primary key (class_id, user_id)
        );
        create index members_user_idx on classroom.members (user_id);

        -- a lesson: verse ranges of the mushaf and the roots it is about
        create table classroom.lessons (
          id           uuid primary key default gen_random_uuid(),
          class_id     uuid not null references classroom.classes(id) on delete cascade,
          title        text not null check (length(title) between 1 and 160),
          ranges       jsonb not null,
          roots        text[] not null default '{}',
          assigned_at  timestamptz not null default now(),
          due_at       timestamptz,
          created_at   timestamptz not null default now()
        );
        create index lessons_class_idx on classroom.lessons (class_id, assigned_at desc);

        -- the instructor's lesson notes (CLS-19, 20): a word's place or a root, a line of the instructor's, in order
        create table classroom.notes (
          id          uuid primary key default gen_random_uuid(),
          lesson_id   uuid not null references classroom.lessons(id) on delete cascade,
          location    text check (location ~ '^\\d{1,3}:\\d{1,3}:\\d{1,3}$'),
          root        text,
          text        text not null default '' check (length(text) <= 1000),
          position    integer not null,
          created_at  timestamptz not null default now()
        );
        create index notes_lesson_idx on classroom.notes (lesson_id, position);

        -- what a member's reader counted for an open lesson: how often, per word and day — never the hour, never the
        -- order, never a note's words
        create table classroom.counts (
          lesson_id  uuid not null references classroom.lessons(id) on delete cascade,
          user_id    uuid not null references accounts.users(id) on delete cascade,
          location   text not null check (location ~ '^\\d{1,3}:\\d{1,3}:\\d{1,3}$'),
          kind       text not null check (kind in ('lookup', 'note', 'confirm', 'struggle')),
          day        date not null,
          n          integer not null check (n > 0),
          primary key (lesson_id, user_id, location, kind, day)
        );
        create index counts_lesson_idx on classroom.counts (lesson_id, kind);

        create table classroom.progress (
          lesson_id    uuid not null references classroom.lessons(id) on delete cascade,
          user_id      uuid not null references accounts.users(id) on delete cascade,
          opened_on    date not null,
          finished_on  date,
          minutes      integer not null default 0 check (minutes >= 0),
          primary key (lesson_id, user_id)
        );

        -- a reminder is a notice on the member's own classroom page, never a message sent anywhere
        create table classroom.nudges (
          lesson_id  uuid not null references classroom.lessons(id) on delete cascade,
          user_id    uuid not null references accounts.users(id) on delete cascade,
          sent_at    timestamptz not null default now(),
          seen_at    timestamptz,
          primary key (lesson_id, user_id)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop schema classroom cascade;")
