app_name = "naidapa_theme"
app_title = "Naidapa Theme"
app_publisher = "Naidapa Technologies"
app_description = "A Frappe Theme"
app_email = "iammusabutt@gmail.com"
app_license = "mit"

# Fixtures
# ------------------
# Configuration this app OWNS, so a fresh `install-app naidapa_theme` reproduces
# the theme it ships instead of it existing only on the machine it was built on.
#
# RULE: a fixture may carry *structure and defaults*. It must NEVER carry a
# customer's identity or their settings, because a Frappe fixture is applied on
# every `bench migrate` -- an unfiltered entry is therefore a data-loss event on
# the tenant's site, not a one-time seed.
#
# Removed from this list (2026-09-15), each for a concrete reason:
#
#   {"doctype": "Website Settings"}
#     A Single is exported as ONE record holding ALL 45 fields, so this
#     overwrote the tenant's app_name, app_logo, favicon, top/footer bar items
#     AND flipped `disable_signup` to 1 on every migrate. The app has no business
#     owning any of those. Nothing is lost by removing it: branding.py's
#     sync_branding() writes the logo/favicon the theme needs, and it derives
#     them from Navbar/Theme Settings rather than from this fixture.
#
#   {"doctype": "Navbar Settings"}
#     Same Single-record problem. It shipped the vendor's logo and Frappe's own
#     help/settings dropdowns. The theme reads only `app_logo` from this DocType
#     (branding.get_navbar_logo), so removing the fixture costs nothing and stops
#     the app branding every tenant with its own logo.
#
#   {"doctype": "Workspace Group"}
#     Unfiltered, and it shipped 9 groups (Masters, Sales, Purchases, Inventory,
#     Finance, HR, Projects, Reports, Administration) that are one client's menu
#     taxonomy. Because there is no filter, a tenant who created their OWN groups
#     would have had them exported back into this app and then pushed onto every
#     other tenant. Nothing needs it: the sidebar renders
#     `Theme Settings.workspace_order` labels as free text
#     (templates/includes/ocean/ocean_sidebar.html) and never resolves them
#     against Workspace Group, so a tenant can use any grouping they like.
#     install.py no longer creates these groups either.
#
# `Theme Settings` is kept because the app owns that DocType -- but note it is a
# Single too, so it is still a whole-record import. Its shipped branding fields
# (sidebar_logo, favicon_image, title) are deliberately EMPTY; a tenant supplies
# their own.
#
# WHAT THIS MEANS IN PRACTICE: because `theme_settings.json` is a whole-record
# import, every field listed in it is re-asserted on the tenant's site on every
# `bench migrate`. That is acceptable for the theme's own appearance settings
# (they ARE the product's defaults), but it is exactly the mechanism that made
# the Website/Navbar entries above so damaging -- a Single fixture cannot patch
# one field, it replaces the record. If any future field here would belong to the
# tenant rather than to the theme, it must be taken out of this fixture and
# seeded create-if-absent from install.py instead.
#
# KNOWN OPEN ITEM: `workspace_order` ships EMPTY, so get_desktop_pages() falls
# back to listing the tenant's own Workspaces. Setting it non-empty switches the
# sidebar into "order" mode, where a workspace the tenant has but the list does
# not mention is hidden. So it is currently correct-but-basic; the richer
# behaviour and the per-tenant question it raises are recorded as Slice 4b in
# myWorks/docs/theme-audit/2026-09-14-naidapa-theme-product-audit.md.
fixtures = [
    {"doctype": "Theme Settings"},
]

# Apps
# ------------------

# The theme is not standalone: install.py seeds Workspace defaults and an icon
# map that reference ERPNext workspaces (Accounting, Selling, Stock, ...), and it
# reads `Navbar Settings` / `Website Settings`, both of which ERPNext shapes for a
# business site. Declaring this makes a wrong install fail fast with Frappe's own
# dependency error instead of succeeding and then misbehaving.
required_apps = ["frappe", "erpnext"]

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "naidapa_theme",
# 		"logo": "/assets/naidapa_theme/logo.png",
# 		"title": "Naidapa Theme",
# 		"route": "/naidapa_theme",
# 		"has_permission": "naidapa_theme.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
#
# NOTE: these are plain /assets/... paths (not esbuild-hashed *.bundle.*
# names), so they're served with Cache-Control: max-age=43200 and no content
# hash. Browsers can keep serving a stale copy through normal and even hard
# reloads until that window lapses or the URL itself changes. Bump the "?v="
# query string below on every edit to naidapa_theme.css/js so browsers are
# forced to fetch the new content instead of trusting their cached copy.
NAIDAPA_ASSET_VERSION = "50"
app_include_css = [
    "/assets/naidapa_theme/vendor/simplebar/simplebar.css",
    f"/assets/naidapa_theme/css/naidapa_admin_base.css?v={NAIDAPA_ASSET_VERSION}",
    f"/assets/naidapa_theme/css/naidapa_theme.css?v={NAIDAPA_ASSET_VERSION}",
]
app_include_js = [
    "/assets/naidapa_theme/vendor/simplebar/simplebar.js",
    "/assets/naidapa_theme/vendor/animated_icon/iconify-icon.min.js",
    f"/assets/naidapa_theme/js/naidapa_theme.js?v={NAIDAPA_ASSET_VERSION}",
]

# include js, css files in header of web template (portal/customer pages)
web_include_css = [
    f"/assets/naidapa_theme/css/naidapa_portal.css?v={NAIDAPA_ASSET_VERSION}",
]
web_include_js = [
    "/assets/naidapa_theme/vendor/animated_icon/iconify-icon.min.js",
    f"/assets/naidapa_theme/js/naidapa_portal.js?v={NAIDAPA_ASSET_VERSION}",
]

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "naidapa_theme/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Workspace": "public/js/workspace_icon_picker.js",
    "Theme Settings": "public/js/theme_settings_menu.js",
}


# Website route rewrites
website_route_rules = [
    {"from_route": "/dashboard", "to_route": "portal_dashboard"},
]

# Portal menu items
portal_menu_items = [
    {"title": "Dashboard", "route": "/dashboard", "role": "Customer"},
]

# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "naidapa_theme/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "naidapa_theme.utils.jinja_methods",
# 	"filters": "naidapa_theme.utils.jinja_filters"
# }

# Installation
# ------------

extend_bootinfo = "naidapa_theme.events.sidebar.boot_session"

# before_install = "naidapa_theme.install.before_install"
after_install = "naidapa_theme.install.after_install"
after_migrate = "naidapa_theme.install.after_migrate"

# Uninstallation
# ------------
# Registered so removing the app cleans up the schema it added to ERPNext's
# Workspace DocType. Previously both hooks were commented out, so uninstalling
# left that Custom Field (and its column) behind permanently.
# See naidapa_theme/uninstall.py, which also documents what uninstall must NOT
# touch (the tenant's own Website/Navbar Settings).

after_uninstall = "naidapa_theme.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "naidapa_theme.utils.before_app_install"
# after_app_install = "naidapa_theme.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "naidapa_theme.utils.before_app_uninstall"
# after_app_uninstall = "naidapa_theme.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "naidapa_theme.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# The logo on the Navbar Settings screen is the master branding switch: saving it
# mirrors the logo into Website Settings so the favicon and the app logo follow
# on the desk, login, portal and website pages alike. Theme Settings is hooked as
# well so a private logo set there is published too. See naidapa_theme/branding.py.
doc_events = {
	"Navbar Settings": {
		"on_update": "naidapa_theme.branding.sync_branding",
	},
	"Theme Settings": {
		"on_update": "naidapa_theme.branding.sync_branding",
	},
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"naidapa_theme.tasks.all"
# 	],
# 	"daily": [
# 		"naidapa_theme.tasks.daily"
# 	],
# 	"hourly": [
# 		"naidapa_theme.tasks.hourly"
# 	],
# 	"weekly": [
# 		"naidapa_theme.tasks.weekly"
# 	],
# 	"monthly": [
# 		"naidapa_theme.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "naidapa_theme.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "naidapa_theme.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "naidapa_theme.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["naidapa_theme.utils.before_request"]
# after_request = ["naidapa_theme.utils.after_request"]

# Job Events
# ----------
# before_job = ["naidapa_theme.utils.before_job"]
# after_job = ["naidapa_theme.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"naidapa_theme.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

