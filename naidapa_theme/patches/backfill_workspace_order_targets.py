"""Move ``Workspace Order.workspace`` into the new typed ``target`` fields.

``workspace`` was declared ``Link -> Workspace`` but every row actually held a
DocType name, a ``query-report/...`` route or a ``dashboard-view/...`` route --
none of which resolve to a Workspace document. That made the Theme Settings form
impossible to save at all: any save raised

    LinkValidationError: Could not find Row #1: Workspace: Customer, Row #2: ...

so the menu could not be reordered or extended from the UI. The value was
tolerated only because fixtures are imported with ``ignore_links=True``.

This patch splits each legacy value into ``target_type`` + ``target`` (and
``route_query`` for the ``?field=value`` suffix), which the new Dynamic Link
field then validates correctly. ``workspace`` is kept as a hidden read-only
column for one release so the change is reversible without a restore.
"""

import frappe

# Routes that are not plain DocType paths.
ROUTE_PREFIXES = {
	"query-report/": "Report",
	"dashboard-view/": "Dashboard",
}

# DocType that owns each target type, used to drop rows pointing nowhere.
TARGET_DOCTYPE = {
	"DocType": "DocType",
	"Report": "Report",
	"Dashboard": "Dashboard",
	"Workspace": "Workspace",
}


def classify(raw):
	"""Split a legacy ``workspace`` value into (type, target, query)."""
	value, _, query = (raw or "").strip().partition("?")

	for prefix, target_type in ROUTE_PREFIXES.items():
		if value.startswith(prefix):
			return target_type, value[len(prefix) :], query

	return "DocType", value, query


def execute():
	rows = frappe.db.sql(
		"""
		select name, workspace, workspace_label
		from `tabWorkspace Order`
		where parent = 'Theme Settings'
		order by idx asc
		""",
		as_dict=True,
	)

	migrated = skipped = 0

	for row in rows:
		target_type, target, query = classify(row.workspace)

		if not target:
			print(f"  SKIP {row.workspace_label or row.name!r}: empty legacy value")
			skipped += 1
			continue

		owning_doctype = TARGET_DOCTYPE.get(target_type)
		if owning_doctype and not frappe.db.exists(owning_doctype, target):
			print(f"  SKIP {row.workspace_label or row.name!r}: no {target_type} named {target!r}")
			skipped += 1
			continue

		frappe.db.set_value(
			"Workspace Order",
			row.name,
			{
				"enabled": 1,
				"target_type": target_type,
				"target": target,
				"route_query": query,
			},
			update_modified=False,
		)
		migrated += 1

	frappe.db.commit()
	print(f"Workspace Order: migrated {migrated}, skipped {skipped}")
