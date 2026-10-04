"""Ibn Ḥajar's own definitions from the Taqrīb's introduction (P11.2b): the twelve ranks, the twelve ṭabaqāt and the rule
for the years of death, verbatim — quoted where a narrator's page explains his rank, his ṭabaqa or a year read by rule.

Revision ID: 0037
Revises: 0036
"""

from alembic import op

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table content.narrator_scales (
          scale  text not null check (scale in ('rank', 'tabaqa', 'death')),
          n      smallint not null,
          text   text not null,
          primary key (scale, n)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table content.narrator_scales")
