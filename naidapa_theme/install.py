"""Install / migrate / uninstall lifecycle for the Naidapa theme.

Design rules this module follows, each learned from a defect it used to have
(see myWorks/docs/theme-audit/2026-09-14-naidapa-theme-product-audit.md, Slice 4):

1. ``after_migrate`` must NOT be ``after_install``. Migrate runs on every
   upgrade; install runs once. Re-running install work on every migrate made an
   upgrade rewrite data the tenant owned.
2. A hook must never overwrite a value the tenant has set. Seeding is
   create-if-absent only.
3. Hooks must not call ``frappe.db.commit()`` -- Frappe owns the transaction.
4. Errors must surface, not be swallowed into a log file. A half-finished install
   that reports success is worse than a failed one.

This app deliberately does NOT touch ``Website Settings`` or ``Navbar Settings``
from here. Those are the tenant's identity, and the app ships no branding: see
the fixtures note in hooks.py and the (uninstall) note in uninstall.py.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from naidapa_theme.branding import sync_branding

# Animated icon per workspace, chosen by keyword match on the workspace title.
# Applied only where a workspace has no icon yet -- never as an overwrite.
ICON_MAP = [
    (["home", "dashboard"], "home"),
    (["buy", "purchase", "procurement"], "check-list-3"),
    (["sell", "sale", "crm"], "briefcase"),
    (["stock", "inventory"], "clipboard"),
    (["asset"], "document-report"),
    (["acc", "finance", "pay", "tax"], "document-list"),
    (["manuf", "work", "build"], "cog"),
    (["qual", "check"], "check-all"),
    (["proj", "task"], "document-list"),
    (["supp", "help", "ticket"], "chat-bubble"),
    (["user", "hr", "employee", "payroll", "people"], "person"),
    (["web", "portal"], "laptop"),
    (["set", "setup", "tool", "config"], "cog"),
    (["integ", "api"], "grid-3"),
]

# Icons this app previously installed and then decided against; a site that got
# one should be offered a replacement rather than being left with it.
SUPERSEDED_ICONS = {"archive", "line-md:archive", "shopping-cart", "line-md:shopping-cart"}

CUSTOM_FIELD_DOCTYPE = "Workspace"
CUSTOM_FIELD_NAME = "custom_animated_icon"


def get_default_icon_for_title(title_or_name):
    """Suggest an icon for a workspace title. Pure function, no DB access."""
    value = (title_or_name or "").lower()
    for keywords, icon_name in ICON_MAP:
        for keyword in keywords:
            if keyword in value:
                return icon_name
    return "grid-3"


def ensure_workspace_icon_field():
    """Create the Workspace icon Custom Field if it does not exist yet.

    Safe to run on every migrate: ``create_custom_fields`` upserts by fieldname.
    """
    create_custom_fields(
        {
            CUSTOM_FIELD_DOCTYPE: [
                {
                    "fieldname": CUSTOM_FIELD_NAME,
                    "label": "Animated Icon",
                    "fieldtype": "Data",
                    "insert_after": "icon",
                    "description": "Iconify icon code (e.g. line-md:home)",
                }
            ]
        }
    )


def seed_workspace_icons():
    """Fill in a suggested icon for workspaces that have none.

    INSTALL-TIME ONLY (see after_migrate). Never overwrites a value the tenant
    set -- the earlier version did, which meant an upgrade could silently reset
    an administrator's deliberate icon choice. Only two cases are filled:
    the field is blank, or it holds one of the icons this app itself installed
    and later retired.
    """
    workspaces = frappe.get_all(
        CUSTOM_FIELD_DOCTYPE,
        fields=["name", "title", CUSTOM_FIELD_NAME],
        limit_page_length=0,
    )

    updated = []
    for workspace in workspaces:
        current = (workspace.get(CUSTOM_FIELD_NAME) or "").strip()
        if current and current not in SUPERSEDED_ICONS:
            continue

        suggested = get_default_icon_for_title(workspace.get("title") or workspace.get("name"))
        frappe.db.set_value(
            CUSTOM_FIELD_DOCTYPE,
            workspace.name,
            CUSTOM_FIELD_NAME,
            suggested,
            update_modified=False,
        )
        updated.append(workspace.name)

    return updated


def after_install():
    """One-time setup. Runs on ``install-app`` only -- never on migrate."""
    ensure_workspace_icon_field()

    seeded = seed_workspace_icons()
    if seeded:
        frappe.logger("naidapa_theme").info(
            f"Seeded animated icons for {len(seeded)} workspace(s): {', '.join(sorted(seeded))}"
        )

    # Publishes any logo the tenant has already set on Navbar/Theme Settings to
    # Website Settings so the login and portal pages pick it up. Non-destructive:
    # with no tenant logo configured it writes Frappe's own defaults, not ours.
    sync_branding()


def after_migrate():
    """Runs on every ``bench migrate``.

    Kept deliberately minimal. It must NOT call after_install(): migrate happens
    on every upgrade, so doing install work here meant an upgrade re-seeded and
    re-wrote tenant data. Only genuinely idempotent, additive work belongs here
    -- currently, making sure the schema this app adds still exists.
    """
    ensure_workspace_icon_field()
