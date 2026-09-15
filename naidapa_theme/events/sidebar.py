import json
import frappe
from frappe.desk.desktop import get_workspace_sidebar_items, get_desktop_page
from frappe.permissions import get_role_permissions

from naidapa_theme.branding import get_logo

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

# Which DocType owns each target type, and how its desk route is spelled.
ROUTE_BUILDERS = {
    "DocType": lambda t: f"/app/{t.lower().replace(' ', '-')}",
    "Workspace": lambda t: f"/app/{t.lower().replace(' ', '-')}",
    "Report": lambda t: f"/app/query-report/{t}",
    "Dashboard": lambda t: f"/app/dashboard-view/{t}",
}

# DocType a target of this type must exist in.
TARGET_EXISTS_IN = {
    "DocType": "DocType",
    "Report": "Report",
    "Dashboard": "Dashboard",
    "Workspace": "Workspace",
}


def resolve_icon(title_or_name, custom_icon=None):
    invalid_icons = ["archive", "line-md:archive", "shopping-cart", "line-md:shopping-cart"]
    if custom_icon and str(custom_icon).strip() not in invalid_icons:
        icon_str = str(custom_icon).strip()
        if icon_str.startswith("line-md:"):
            return icon_str[8:]
        return icon_str
    val = (title_or_name or "").lower()
    for keywords, icon_name in ICON_MAP:
        for kw in keywords:
            if kw in val:
                return icon_name
    return "grid-3"


def permission_doctype(target_type, target):
    """DocType whose ``read`` permission governs this menu item.

    For a ``DocType`` item the target *is* the DocType ("Customer"), so the
    permission to check is on "Customer" itself -- not on "DocType". For the
    others the governing permission is on Report / Dashboard / Workspace.
    Getting this wrong makes every DocType item vanish, since almost no
    business role holds read on the meta-DocType ``DocType``.
    """
    if target_type == "DocType":
        return target
    return target_type if target_type in TARGET_EXISTS_IN else None


def can_read_target(target_type, target):
    """Role-permission read check for a menu item's destination.

    Deliberately NOT ``frappe.has_permission()``. That falls back to
    share-based access (``frappe/permissions.py::false_if_not_shared``), and
    every user holds a DocShare on their own User document -- so
    ``has_permission("User", "read")`` is True for *everyone*, which would leak
    the whole Administration group into every user's sidebar.
    ``get_role_permissions`` reflects genuine role-based access only.
    """
    if not target:
        return False

    if target_type == "URL":
        return True

    exists_in = TARGET_EXISTS_IN.get(target_type)
    if not exists_in or not frappe.db.exists(exists_in, target):
        return False

    perm_doctype = permission_doctype(target_type, target)
    if not perm_doctype or not frappe.db.exists("DocType", perm_doctype):
        return False

    return bool(
        get_role_permissions(frappe.get_meta(perm_doctype), user=frappe.session.user).get("read")
    )


def passes_role_gate(row):
    """Empty ``allowed_roles`` means "everyone who can open the target".

    ``allowed_roles`` is a comma-separated string rather than a Table of roles
    because Frappe does not persist a child table nested inside a child table:
    ``Workspace Order`` is itself a child of ``Theme Settings``, so a Table
    field there saves without error and silently stores nothing.
    """
    raw = (row.get("allowed_roles") or "").strip()
    if not raw:
        return True

    allowed = {role.strip() for role in raw.split(",") if role.strip()}
    return bool(allowed & set(frappe.get_roles()))


def is_privileged():
    """Administrator, or anyone trusted to maintain the menu itself."""
    return frappe.session.user == "Administrator" or "Workspace Manager" in frappe.get_roles()


def build_route(row):
    if row.target_type == "URL":
        route = (row.external_url or "").strip()
    elif row.target_type in ROUTE_BUILDERS:
        route = ROUTE_BUILDERS[row.target_type](row.target)
    else:
        return None

    if not route:
        return None

    query = (row.route_query or "").strip()
    return f"{route}?{query}" if query else route


def build_custom_menu(workspace_orders):
    """Render Theme Settings -> Workspace Order into sidebar items.

    Visible to Administrator and Workspace Manager in full; for everyone else
    each row must be enabled, pass its role gate, and point at something the
    user can actually read.

    Administrator gets a FLAT list: the workspace_group headings exist to make
    a curated subset navigable, and collapsing a heading hides items behind a
    click. Administrator sees every item at once instead. Restricted users keep
    the grouped view, which is the structure the groups were designed for.
    """
    privileged = is_privileged()
    ungrouped = frappe.session.user == "Administrator"
    menu_items = []
    groups_map = {}

    # Sort by row idx to strictly preserve Theme Settings row order.
    for row in sorted(workspace_orders, key=lambda x: int(x.idx or 0)):
        if not row.get("enabled"):
            continue

        if not privileged:
            if not passes_role_gate(row):
                continue
            if not can_read_target(row.target_type, row.target):
                continue

        route = build_route(row)
        if not route:
            continue

        title = (
            row.workspace_label
            or frappe.db.get_value("Workspace", row.target, "title")
            or row.target
        )
        icon = resolve_icon(
            title,
            row.icon or frappe.db.get_value("Workspace", row.target, "custom_animated_icon"),
        )

        item_data = {
            "name": row.target,
            "title": title,
            "route": route,
            "icon_name": icon,
        }

        group_name = "" if ungrouped else (row.workspace_group or "").strip()

        if group_name:
            if group_name in groups_map:
                groups_map[group_name]["sub_items"].append(item_data)
            else:
                group_item = {
                    "is_group": True,
                    "group_name": group_name,
                    "group_slug": group_name.lower().replace(" ", "-"),
                    "group_icon": resolve_icon(group_name),
                    "sub_items": [item_data],
                }
                groups_map[group_name] = group_item
                menu_items.append(group_item)
        else:
            menu_items.append(
                {
                    "is_group": False,
                    "name": row.target,
                    "title": title,
                    "route": route,
                    "icon_name": icon,
                }
            )

    return menu_items


@frappe.whitelist()
def get_desktop_pages():
    try:
        theme_settings = frappe.get_cached_doc("Theme Settings")
        workspace_orders = theme_settings.get("workspace_order") or []
    except Exception:
        workspace_orders = []

    if workspace_orders:
        return {"custom_menu": True, "items_list": build_custom_menu(workspace_orders)}

    # Default Fallback: Standard Desktop Sidebar Pages
    pages_data = get_workspace_sidebar_items()
    pages = pages_data.get("pages", [])

    hidden_workspaces = []
    pages = [page for page in pages if page.get("title") not in hidden_workspaces]
    original_pages = pages

    parent_pages = [d for d in pages if not d.get("parent_page")]

    for row in parent_pages:
        custom_icon = frappe.db.get_value("Workspace", row.get("name"), "custom_animated_icon")
        row["custom_animated_icon"] = custom_icon
        row["icon_name"] = resolve_icon(row.get("title") or row.get("name"), custom_icon)

        row_json = json.dumps(row, default=str)
        try:
            desktop_page = get_desktop_page(row_json)
            row["cards"] = desktop_page.get("cards")
        except Exception:
            row["cards"] = []

        children = [d for d in original_pages if d.get("parent_page") == row.get("name")]
        for child in children:
            child_custom = frappe.db.get_value("Workspace", child.get("name"), "custom_animated_icon")
            child["custom_animated_icon"] = child_custom
            child["icon_name"] = resolve_icon(child.get("title") or child.get("name"), child_custom)

        row["child_workspace"] = children

    return {"custom_menu": False, "pages": parent_pages}


def boot_session(bootinfo):
    # frappe.boot.sidebar_logo is consumed by naidapa_theme.js:update_sidebar_logo(),
    # which rewrites the server-rendered sidebar <img> on every page load. It has to
    # come from the same resolver that ocean_sidebar.html uses, or the JS clobbers the
    # correct logo with the theme's own -- which is what made the Navbar Settings logo
    # look like it was being ignored in the desk while the login page obeyed it.
    try:
        bootinfo.theme_settings = frappe.get_cached_doc("Theme Settings").as_dict()
    except Exception:
        bootinfo.theme_settings = {}

    bootinfo.sidebar_logo = get_logo()
