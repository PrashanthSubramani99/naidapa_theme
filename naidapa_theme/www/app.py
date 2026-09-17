import os
import json
import re

import frappe
import frappe.sessions
from frappe import _
from frappe.utils.jinja_globals import is_rtl
from naidapa_theme.branding import get_favicon, get_logo
from naidapa_theme.events.sidebar import get_desktop_pages

SCRIPT_TAG_PATTERN = re.compile(r"\<script[^<]*\</script\>")
CLOSING_SCRIPT_TAG_PATTERN = re.compile(r"</script\>")


def get_app_name():
    """The name shown in the browser tab and desk shell.

    Never falls back to "Frappe" -- that is the framework's name, not a
    tenant's identity, and showing it (or any vendor name) is exactly the
    kind of leak the theme must not ship (see the per-tenant branding
    principle in myWorks/docs/theme-audit/2026-09-14-naidapa-theme-product-audit.md).
    Order: the tenant's own explicit setting, then their own Company name
    (already configured via the ERPNext setup wizard on every real site, so
    this is free and genuinely theirs), then a neutral generic label.
    """
    explicit = frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name")
    if explicit and explicit != "Frappe":
        return explicit

    default_company = frappe.defaults.get_global_default("company")
    if default_company:
        company_name = frappe.db.get_value("Company", default_company, "company_name")
        if company_name:
            return company_name

    return "ERP"


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.throw(_("Log in to access this page."), frappe.PermissionError)
    elif frappe.db.get_value("User", frappe.session.user, "user_type", order_by=None) == "Website User":
        frappe.throw(_("You are not permitted to access this page."), frappe.PermissionError)

    hooks = frappe.get_hooks()
    try:
        boot = frappe.sessions.get()
    except Exception as e:
        raise frappe.SessionBootFailed from e

    # this needs commit
    csrf_token = frappe.sessions.get_csrf_token()

    frappe.db.commit()

    boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))

    # remove script tags from boot
    boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)
    boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)

    include_js = hooks.get("app_include_js", []) + frappe.conf.get("app_include_js", [])
    include_css = hooks.get("app_include_css", []) + frappe.conf.get("app_include_css", [])
    include_icons = hooks.get("app_include_icons", [])
    frappe.local.preload_assets["icons"].extend(include_icons)

    context.update(
        {
            "no_cache": 1,
            "build_version": frappe.utils.get_build_version(),
            "include_js": include_js,
            "include_css": include_css,
            "include_icons": include_icons,
            "layout_direction": "rtl" if is_rtl() else "ltr",
            "lang": frappe.local.lang,
            "sounds": hooks.get("sounds", []),
            "boot": boot if context.get("for_mobile") else json.loads(boot_json),
            "desk_theme": boot.get("desk_theme") or "Light",
            "csrf_token": csrf_token,
            "google_analytics_id": frappe.conf.get("google_analytics_id"),
            "google_analytics_anonymize_ip": frappe.conf.get("google_analytics_anonymize_ip"),
            "app_name": get_app_name(),
            "menu_data": get_desktop_pages(),
            "pages": (get_desktop_pages().get("pages", []) if isinstance(get_desktop_pages(), dict) else get_desktop_pages()),
        }
    )

    # The Navbar Settings logo is the master switch for both the app logo and the
    # favicon; see naidapa_theme/branding.py. The old fallback here was
    # "/files/dr-codex-logo.png", which does not exist on this site.
    context["app_logo"] = get_logo()
    context["favicon"] = get_favicon()

    try:
        context["theme_settings"] = frappe.get_cached_doc("Theme Settings")
    except Exception:
        context["theme_settings"] = frappe._dict()

    # Fixed footer (templates/includes/ocean/main.html): a single centred line.
    # The text comes from Frappe's own footer setting -- Website Settings ->
    # Copyright -- so it stays editable in the UI rather than being hardcoded
    # here. The year is resolved per request, so the notice rolls over on its own
    # every January with no code change.
    context["footer_copyright"] = (frappe.get_website_settings("copyright") or "").strip()
    context["current_year"] = frappe.utils.now_datetime().year

    return context
