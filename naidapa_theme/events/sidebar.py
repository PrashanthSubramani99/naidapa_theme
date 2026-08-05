import json
import frappe
from frappe.desk.desktop import get_workspace_sidebar_items, get_desktop_page

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

@frappe.whitelist()
def get_desktop_pages():
    pages_data = get_workspace_sidebar_items()
    pages = pages_data.get("pages")
    
    hidden_workspaces = []
    pages = [page for page in pages if page.get("title") not in hidden_workspaces]
    original_pages = pages
    
    parent_pages = [d for d in pages if not d.get('parent_page')]
    
    for row in parent_pages:
        custom_icon = frappe.db.get_value("Workspace", row.get("name"), "custom_animated_icon")
        row["custom_animated_icon"] = custom_icon
        row["icon_name"] = resolve_icon(row.get("title") or row.get("name"), custom_icon)
        
        row_json = json.dumps(row, default=str)
        desktop_page = get_desktop_page(row_json)
        
        row["cards"] = desktop_page.get("cards")
        
        children = [d for d in original_pages if d.get('parent_page') == row.get("name")]
        for child in children:
            child_custom = frappe.db.get_value("Workspace", child.get("name"), "custom_animated_icon")
            child["custom_animated_icon"] = child_custom
            child["icon_name"] = resolve_icon(child.get("title") or child.get("name"), child_custom)
            
        row["child_workspace"] = children
        
    return parent_pages

def boot_session(bootinfo):
    try:
        theme_settings = frappe.get_cached_doc("Theme Settings")
        bootinfo.sidebar_logo = theme_settings.get("sidebar_logo") or "/files/dr-codex-logo.png"
        bootinfo.theme_settings = theme_settings.as_dict()
    except Exception:
        bootinfo.sidebar_logo = "/files/dr-codex-logo.png"