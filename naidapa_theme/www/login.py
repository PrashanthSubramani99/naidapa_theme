import frappe
from frappe.core.doctype.navbar_settings.navbar_settings import get_app_logo

no_cache = 1


def get_context(context):
	try:
		theme_settings = frappe.get_cached_doc("Theme Settings")
		app_logo = theme_settings.get("sidebar_logo") or get_app_logo() or "/files/dr-codex-logo.png"
	except Exception:
		app_logo = get_app_logo() or "/files/dr-codex-logo.png"

	context["app_logo"] = app_logo
	context["app_name"] = (
		frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name") or "Frappe"
	)
	return context
