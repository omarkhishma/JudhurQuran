"""The catalogue (P11.3a): OpenITI's primary versions of the Arabic works the D9 gate lets in — authors dead by 1374
AH, uncorrected OCR left out — with their titles, authors, sizes, OpenITI's subject codes and the libraries' own
categories as the metadata gives them, each linked to where its text is read (``shelf``: the slug of a book on our
shelf). Found by title and author through ``norm``.

Revision ID: 0039
Revises: 0038
"""

from alembic import op

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.catalogue_works (
          id            integer primary key,
          version       text not null unique,
          work          text not null,
          author_uri    text not null,
          death_ah      integer not null,
          before_islam  boolean not null default false,
          era_year      integer,
          title_ar      text not null,
          title_lat     text,
          author_ar     text not null,
          author_lat    text,
          words         integer not null,
          subjects      text[] not null default '{}',
          categories    text[] not null default '{}',
          library       text not null,
          library_id    text not null,
          shamela_id    integer,
          path          text not null,
          shelf         text,
          norm          text not null
        );
        create index catalogue_works_norm_trgm on content.catalogue_works using gin (norm gin_trgm_ops);
        create index catalogue_works_death on content.catalogue_works (death_ah, id);
        """
    )


def downgrade() -> None:
    op.execute("drop table content.catalogue_works")
