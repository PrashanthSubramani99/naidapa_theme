"""Server helpers for the sidebar menu editor on the Theme Settings form.

The theme has two sidebar modes (see events/sidebar.py::get_desktop_pages):

  * ``Theme Settings.workspace_order`` EMPTY  -> default ERP navigation: the
    site's own workspaces, parent_page nesting preserved.
  * ``Theme Settings.workspace_order`` NON-EMPTY -> curated mode: only the rows
    listed here appear, with custom labels, ordering, groups and role gates.

For a long time the curated mode existed with NO way for a tenant to build the
list except hand-editing the child table. The functions here power a
"Populate from workspaces" button on the Theme Settings form that turns the
site's workspaces into a starting list, after which the tenant can reorder,
relabel, group and delete rows in the normal Frappe child-table UI.
"""

import frappe


@frappe.whitelist()
def list_workspaces_for_menu():
    """Return the site's workspaces as a seed list for the menu editor.

    Each entry maps directly onto a Workspace Order row. Ordering follows the
    workspace's own ``sequence_id`` so the initial menu matches the default ERP
    order, not an arbitrary or alphabetical one.
    """
    if not frappe.has_permission("Workspace", "read"):
        frappe.throw("Not permitted to read Workspaces", frappe.PermissionError)

    rows = frappe.get_all(
        "Workspace",
        fields=["name", "title", "parent_page", "sequence_id"],
        order_by="sequence_id asc, title asc",
        limit_page_length=0,
    )

    return [
        {
            "target_type": "Workspace",
            "target": row.name,
            "workspace_label": row.title or row.name,
            "workspace": row.name,  # legacy field, kept in sync for reversibility
            "enabled": 1,
        }
        for row in rows
    ]
