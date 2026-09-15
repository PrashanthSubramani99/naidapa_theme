import frappe

from naidapa_theme.branding import get_favicon, get_logo

no_cache = 1


def get_context(context):
	# The Navbar Settings logo is the master switch for both the app logo and the
	# favicon; see naidapa_theme/branding.py. These run after
	# BaseTemplatePage.init_context(), so they also override the favicon that
	# Frappe's get_website_settings() put in the context.
	context["app_logo"] = get_logo()
	context["favicon"] = get_favicon()
	context["app_name"] = (
		frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name") or "Frappe"
	)
	return context
