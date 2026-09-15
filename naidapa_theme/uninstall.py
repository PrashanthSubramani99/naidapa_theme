"""Uninstall lifecycle.

Before this module existed, ``hooks.py`` had both uninstall hooks commented out,
so removing the app left permanent residue on the tenant's site: the
``custom_animated_icon`` Custom Field on ERPNext's ``Workspace`` DocType (and its
column) and any Workspace Group records the app had created.

Deletion semantics (why this module backs up first)
----------------------------------------------------
Deleting a ``Custom Field`` record does NOT just remove the field from the form.
On the next ``frappe.model`` sync, Frappe issues ``DROP COLUMN`` on the DocType's
table (``frappe/model/meta.py:895-901``, ``frappe/model/__init__.py:207``), which
**destroys every value the field stored**. The theme's own install hook seeds those
values, but a tenant may have since chosen their own icons. So the correct
uninstall order is:

    1. read and persist every non-empty ``custom_animated_icon`` value
    2. delete the Custom Field (and therefore its column)
    3. log where the backup went, loudly

The backup is JSON on the site's filesystem, not in the DB -- deliberately: it
survives the column drop and is trivially re-importable if the tenant reinstalls.

Scope note -- what this deliberately does NOT touch
---------------------------------------------------
``Website Settings`` and ``Navbar Settings`` are **the tenant's own identity**
(app name, logo, favicon, top/footer bar items, signup policy). The app no longer
ships them as fixtures (see hooks.py), and uninstall must not "restore" or blank
them either: the tenant may have set those values themselves, and this app has no
record of what they were beforehand. Leaving them alone is the only safe choice.
"""

import json
import os

import frappe

CUSTOM_FIELD_DOCTYPE = "Workspace"
CUSTOM_FIELD_NAME = "custom_animated_icon"

# Frappe serves /files/... from the site's public files directory; the path used
# here is relative to that directory. It is what frappe.get_site_path("public")
# resolves to, but keeping it explicit avoids a site-path call in a hook.
BACKUP_RELATIVE = "naidapa_theme_uninstall/workspace_icons.json"


def _collect_icon_values():
    """Return {workspace_name: icon_value} for every workspace that has one."""
    if not frappe.db.table_exists(CUSTOM_FIELD_DOCTYPE):
        return {}

    columns = frappe.db.get_table_columns(CUSTOM_FIELD_DOCTYPE)
    if CUSTOM_FIELD_NAME not in columns:
        return {}

    rows = frappe.get_all(
        CUSTOM_FIELD_DOCTYPE,
        fields=["name", CUSTOM_FIELD_NAME],
        limit_page_length=0,
    )
    return {
        row.name: row.get(CUSTOM_FIELD_NAME)
        for row in rows
        if (row.get(CUSTOM_FIELD_NAME) or "").strip()
    }


def _write_backup(values: dict) -> str | None:
    """Persist the collected values and return the absolute backup path."""
    if not values:
        return None

    directory = os.path.join(frappe.get_site_path(), "public", "files", "naidapa_theme_uninstall")
    os.makedirs(directory, exist_ok=True)

    path = os.path.join(directory, "workspace_icons.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "doctype": CUSTOM_FIELD_DOCTYPE,
                "fieldname": CUSTOM_FIELD_NAME,
                "note": (
                    "Values captured by naidapa_theme uninstall before the Custom "
                    "Field (and its column) were dropped. Re-import these after "
                    "reinstalling the app to restore per-workspace icons."
                ),
                "values": values,
            },
            handle,
            indent=1,
            sort_keys=True,
        )
    return path


def after_uninstall():
    """Remove what this app added, without silently destroying tenant data.

    Idempotent: safe to run when the app was only partially installed, or twice.
    """
    removed = []
    backups = []

    # 1. Back up any icon values before the column is dropped.
    values = _collect_icon_values()
    backup_path = _write_backup(values)
    if backup_path:
        backups.append(backup_path)

    # 2. Delete the Custom Field. NOTE: v15's Document.delete takes
    #    (ignore_permissions, force, delete_permanently) only -- `ignore_missing`
    #    is NOT a supported kwarg and raising it would leave the field behind.
    custom_field = f"{CUSTOM_FIELD_DOCTYPE}-{CUSTOM_FIELD_NAME}"
    if frappe.db.exists("Custom Field", custom_field):
        frappe.delete_doc(
            "Custom Field",
            custom_field,
            force=True,
            ignore_permissions=True,
        )
        # delete_doc removes the Custom Field *record* but does NOT drop the
        # column it added to `tabWorkspace` -- Frappe never drops columns on a
        # plain delete (schema.py::alter only adds/modifies). trim_table() is
        # the primitive that reconciles the physical table against the now
        # field-less meta and issues the DROP COLUMN. Without this the uninstall
        # is only cosmetic: the form loses the field but the DB keeps the column
        # and the tenant's icon values.
        from frappe.model.meta import trim_table

        trim_table(CUSTOM_FIELD_DOCTYPE, dry_run=False)
        removed.append(f"Custom Field {custom_field} (and its column)")

    # 3. Log what happened -- and where the data went.
    logger = frappe.logger("naidapa_theme")
    if removed:
        logger.info("naidapa_theme uninstalled; removed: " + "; ".join(removed))
    else:
        logger.info("naidapa_theme uninstalled; nothing to remove (already clean)")

    if backups:
        for path in backups:
            logger.info(f"naidapa_theme uninstall: icon values backed up to {path}")

    return {"removed": removed, "backups": backups}
