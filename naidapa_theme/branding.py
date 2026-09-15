"""Single source of truth for the site logo and the favicon.

"Navbar Settings -> Application Logo" is the master switch: upload a logo there
and it becomes the desk sidebar logo, the login card logo, and the browser
favicon on every page (desk, login, portal and website).

Before this module the three branding settings were wired independently, which
made the Navbar Settings logo look broken:

  * ``Theme Settings.sidebar_logo`` outranked it in ``templates/includes/ocean/
    ocean_sidebar.html``, so editing the logo on the Navbar Settings screen
    changed nothing while a theme logo was set;
  * ``www/app.html`` (the desk shell) emitted no ``<link rel="icon">`` at all,
    so the desk tab had no icon -- and ``desk.js:set_favicon()`` then read the
    missing tag and injected ``href="undefined"``;
  * ``Theme Settings.favicon_image`` existed as a field but was read by nothing.

``sync_branding`` closes the loop the other way too: it mirrors the resolved
logo into ``Website Settings``, which is what Frappe's stock ``base.html`` reads
for the login, portal and website pages. That keeps those pages correct without
patching Frappe.
"""

import frappe

DEFAULT_FAVICON = "/assets/frappe/images/frappe-favicon.svg"
DEFAULT_LOGO = "/assets/frappe/images/frappe-framework-logo.svg"

NAVBAR_SETTINGS = "Navbar Settings"
THEME_SETTINGS = "Theme Settings"
WEBSITE_SETTINGS = "Website Settings"


def get_navbar_logo():
	"""The logo uploaded on the Navbar Settings screen, if any."""
	return frappe.db.get_single_value(NAVBAR_SETTINGS, "app_logo", cache=True)


def get_theme_setting(fieldname):
	"""Read a Theme Settings field, tolerating the DocType being absent."""
	try:
		return frappe.get_cached_doc(THEME_SETTINGS).get(fieldname)
	except Exception:
		return None


def get_logo():
	"""Logo for the desk sidebar and the login card.

	Navbar Settings wins. ``Theme Settings.sidebar_logo`` and
	``Website Settings.app_logo`` are fallbacks, and the ``app_logo_url`` hook is
	the last resort -- mirroring Frappe's own ``get_app_logo()``, except that the
	Navbar Settings value is checked first instead of last.
	"""
	logo = get_navbar_logo() or get_theme_setting("sidebar_logo") or frappe.get_website_settings("app_logo")
	if logo:
		return logo

	logos = frappe.get_hooks("app_logo_url") or [DEFAULT_LOGO]
	# Frappe allows [light_logo, dark_logo]; prefer the dark one, as it does.
	return logos[1] if len(logos) == 2 else logos[0]


def get_favicon():
	"""Favicon for every page: desk, login, portal and website."""
	return (
		get_navbar_logo()
		or get_theme_setting("favicon_image")
		or frappe.db.get_single_value(WEBSITE_SETTINGS, "favicon", cache=True)
		or DEFAULT_FAVICON
	)


def publish_logo_url(url):
	"""Return a Guest-reachable URL for ``url``.

	A logo has to render on the login page, where the viewer is a Guest, but
	Frappe serves ``/private/files/...`` only to authenticated users holding
	permission on the backing File -- a Guest request gets 403, so a logo uploaded
	as a private attachment leaves the login page logo and the favicon broken.

	Uploads dropped onto an Attach field are private by default, so promote the
	File to public here. ``File.handle_is_private_changed`` moves it from
	``private/files`` to ``public/files`` and rewrites ``file_url`` to
	``/files/...``; the caller is responsible for writing the returned URL back
	over the stale ``/private/files/...`` value.
	"""
	if not url or not url.startswith("/private/files/"):
		return url

	name = frappe.db.get_value("File", {"file_url": url}, "name")
	if not name:
		return url

	file_doc = frappe.get_doc("File", name)
	if not file_doc.is_private:
		return file_doc.file_url

	file_doc.is_private = 0
	file_doc.save(ignore_permissions=True)
	return file_doc.file_url


def sync_branding(*args, **kwargs):
	"""Mirror the tenant's logo into Website Settings.

	Registered as a ``doc_events`` hook on ``Navbar Settings -> on_update`` and
	``Theme Settings -> on_update``, and called from ``install.after_install``.

	``Website Settings.app_logo`` is mirrored because Frappe's own
	``get_app_logo()`` reads that field *before* the Navbar Settings value; without
	the mirror the navbar logo would be shadowed in ``frappe.boot.app_logo_url``.
	The favicon is mirrored so it reaches the pages that render through Frappe's
	stock ``get_website_settings()`` path -- login, portal, website and print.

	MULTI-TENANT RULE: this function may only write what the *tenant* configured.
	It derives everything from Navbar/Theme Settings and writes only when the
	tenant actually has a logo -- it never falls back to this app's own defaults,
	because writing those would overwrite a customer's app_logo/favicon and brand
	their instance with ours. With nothing configured by the tenant it writes
	nothing at all.

	The resolved values are never read back from Website Settings, so clearing the
	navbar logo cannot leave a stale favicon pinned in place.
	"""
	navbar_logo = get_navbar_logo()
	public_navbar_logo = publish_logo_url(navbar_logo)
	if public_navbar_logo != navbar_logo:
		# The File moved to /files/..., so the /private/files/... value the user
		# just saved no longer resolves to anything. Repoint it at the file that
		# now exists -- via set_single_value, not a doc save, so this cannot
		# re-enter on_update.
		frappe.db.set_single_value(NAVBAR_SETTINGS, "app_logo", public_navbar_logo)
		navbar_logo = public_navbar_logo

	theme_logo = publish_logo_url(get_theme_setting("sidebar_logo"))
	if theme_logo != get_theme_setting("sidebar_logo"):
		frappe.db.set_single_value(THEME_SETTINGS, "sidebar_logo", theme_logo)

	theme_favicon = publish_logo_url(get_theme_setting("favicon_image"))
	if theme_favicon != get_theme_setting("favicon_image"):
		frappe.db.set_single_value(THEME_SETTINGS, "favicon_image", theme_favicon)

	logo = navbar_logo or theme_logo
	favicon = navbar_logo or theme_favicon

	changed = []

	# Only ever mirror a logo the tenant supplied. If they have configured
	# nothing, leave Website Settings exactly as we found it.
	if logo:
		if frappe.db.get_single_value(WEBSITE_SETTINGS, "app_logo", cache=True) != logo:
			frappe.db.set_single_value(WEBSITE_SETTINGS, "app_logo", logo)
			changed.append("app_logo")
		if favicon and frappe.db.get_single_value(WEBSITE_SETTINGS, "favicon", cache=True) != favicon:
			frappe.db.set_single_value(WEBSITE_SETTINGS, "favicon", favicon)
			changed.append("favicon")

	if navbar_logo and navbar_logo.startswith("/files/"):
		changed.append("published_private_logo")

	if changed:
		frappe.logger("branding").info(f"Branding synced: {', '.join(sorted(changed))}")

	return sorted(changed)
