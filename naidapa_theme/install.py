import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

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

DEFAULT_WORKSPACE_ORDERS = [
    {"idx": 1, "workspace": "Home", "workspace_label": "Home"},
    {"idx": 2, "workspace": "Accounting", "workspace_group": "Finance", "workspace_label": "Accounting"},
    {"idx": 3, "workspace": "Payables", "workspace_group": "Finance", "workspace_label": "Payables"},
    {"idx": 4, "workspace": "Receivables", "workspace_group": "Finance", "workspace_label": "Receivables"},
    {"idx": 5, "workspace": "Financial Reports", "workspace_group": "Finance", "workspace_label": "Financial Reports"},
    {"idx": 6, "workspace": "Buying", "workspace_label": "Buying"},
    {"idx": 7, "workspace": "Selling", "workspace_label": "Selling"},
    {"idx": 8, "workspace": "Stock", "workspace_group": "Inventory", "workspace_label": "Stock"},
    {"idx": 9, "workspace": "Assets", "workspace_group": "Inventory", "workspace_label": "Assets"},
    {"idx": 10, "workspace": "Manufacturing", "workspace_label": "Manufacturing"},
    {"idx": 11, "workspace": "Quality", "workspace_label": "Quality"},
    {"idx": 12, "workspace": "Users", "workspace_label": "Users"},
    {"idx": 13, "workspace": "Projects", "workspace_label": "Projects"},
    {"idx": 14, "workspace": "Support", "workspace_label": "Support"},
]

def get_default_icon_for_title(title_or_name):
    val = (title_or_name or "").lower()
    for keywords, icon_name in ICON_MAP:
        for kw in keywords:
            if kw in val:
                return icon_name
    return "grid-3"

def setup_workspace_animated_icons():
    try:
        workspaces = frappe.get_all("Workspace", fields=["name", "title", "custom_animated_icon"])
        invalid_icons = ["archive", "line-md:archive", "shopping-cart", "line-md:shopping-cart"]
        for ws in workspaces:
            current_icon = ws.get("custom_animated_icon")
            if not current_icon or current_icon in invalid_icons:
                suggested_icon = get_default_icon_for_title(ws.get("title") or ws.get("name"))
                frappe.db.set_value("Workspace", ws.name, "custom_animated_icon", suggested_icon, update_modified=False)
        frappe.db.commit()
    except Exception as e:
        frappe.logger().error(f"Error setting up workspace animated icons: {e}")

def setup_default_workspace_orders():
    try:
        # Create Workspace Groups if missing
        groups = set()
        for item in DEFAULT_WORKSPACE_ORDERS:
            grp = item.get("workspace_group")
            if grp:
                groups.add(grp)

        for grp_name in groups:
            if not frappe.db.exists("Workspace Group", grp_name):
                frappe.get_doc({
                    "doctype": "Workspace Group",
                    "group_name": grp_name
                }).insert(ignore_permissions=True)

        theme_settings = frappe.get_single("Theme Settings")
        current_orders = theme_settings.get("workspace_order") or []

        if not current_orders:
            for item in DEFAULT_WORKSPACE_ORDERS:
                theme_settings.append("workspace_order", {
                    "workspace": item.get("workspace"),
                    "workspace_group": item.get("workspace_group"),
                    "workspace_label": item.get("workspace_label"),
                })
            theme_settings.save(ignore_permissions=True)
            frappe.db.commit()

    except Exception as e:
        frappe.logger().error(f"Error setting up default workspace order: {e}")

def after_install():
    create_custom_fields({
        "Workspace": [
            {
                "fieldname": "custom_animated_icon",
                "label": "Animated Icon",
                "fieldtype": "Data",
                "insert_after": "icon",
                "description": "Iconify icon code (e.g. mdi:home)"
            }
        ]
    })
    setup_workspace_animated_icons()
    setup_default_workspace_orders()

def after_migrate():
    after_install()
