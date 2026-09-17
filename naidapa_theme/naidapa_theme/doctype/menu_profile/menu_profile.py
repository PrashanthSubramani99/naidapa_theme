# Copyright (c) 2026, Naidapa Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class MenuProfile(Document):
	def validate(self):
		if self.applies_to == "User" and not self.user:
			frappe.throw(_("User is required when Applies To is 'User'."))
		if self.applies_to == "Role" and not self.roles:
			frappe.throw(_("At least one Role is required when Applies To is 'Role'."))

		if self.enabled:
			self.check_no_duplicate_target()

	def check_no_duplicate_target(self):
		"""Only one enabled profile per exact User. For Role profiles, multiple
		are allowed (resolved by `priority`), but flag two enabled profiles that
		share a role AND a priority, since resolution order between them would
		be ambiguous.
		"""
		if self.applies_to == "User":
			clash = frappe.db.exists(
				"Menu Profile",
				{"applies_to": "User", "enabled": 1, "user": self.user, "name": ["!=", self.name]},
			)
			if clash:
				frappe.throw(
					_("User {0} already has an enabled Menu Profile ({1}).").format(self.user, clash)
				)
			return

		my_roles = {r.role for r in self.roles}
		if not my_roles:
			return

		clashing = frappe.get_all(
			"Menu Profile",
			filters=[
				["Menu Profile", "applies_to", "=", "Role"],
				["Menu Profile", "enabled", "=", 1],
				["Menu Profile", "priority", "=", self.priority],
				["Menu Profile", "name", "!=", self.name],
				["Menu Profile Role", "role", "in", list(my_roles)],
			],
			fields=["name"],
		)
		if clashing:
			frappe.throw(
				_(
					"{0} already covers one of these roles at the same priority ({1})."
					" Resolution order would be ambiguous — change the priority."
				).format(clashing[0].name, self.priority)
			)
