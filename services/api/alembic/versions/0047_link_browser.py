"""A sign-in link remembers the browser that asked for it (security review, P12): the hash of a random value that
browser keeps, so the page the link opens can say when it is opened somewhere else — a link someone asked for their
own address and sent to another reader, to sign them in to the asker's account.

Revision ID: 0047
Revises: 0046
"""

from alembic import op

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("alter table accounts.login_tokens add column browser_hash text")


def downgrade() -> None:
    op.execute("alter table accounts.login_tokens drop column browser_hash")
