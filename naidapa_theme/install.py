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
    
def after_migrate():
    after_install()
