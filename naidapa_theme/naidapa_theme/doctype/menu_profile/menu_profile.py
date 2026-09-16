# Copyright (c) 2026, Naidapa Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class MenuProfile(Document):
	def validate(self):
		if self.applies_to == "User" and not self.user:
			frappe.throw(_("User is required when Applies To is 'User'."))
		if self.applies_to == "Role" and not self.role:
			frappe.throw(_("Role is required when Applies To is 'Role'."))

		if self.enabled:
			self.check_no_duplicate_target()

	def check_no_duplicate_target(self):
		"""Only one enabled profile per exact User, and warn-free multiple Role
		profiles are allowed (resolved by `priority`), but flag exact duplicates
		(same role, same priority) since resolution order would be ambiguous.
		"""
		filters = {
			"applies_to": self.applies_to,
			"enabled": 1,
			"name": ["!=", self.name],
		}
		if self.applies_to == "User":
			filters["user"] = self.user
			clash = frappe.db.exists("Menu Profile", filters)
			if clash:
				frappe.throw(
					_("User {0} already has an enabled Menu Profile ({1}).").format(self.user, clash)
				)
		else:
			filters["role"] = self.role
			filters["priority"] = self.priority
			clash = frappe.db.exists("Menu Profile", filters)
			if clash:
				frappe.throw(
					_(
						"Role {0} already has an enabled Menu Profile ({1}) at the same priority ({2})."
						" Resolution order would be ambiguous — change the priority."
					).format(self.role, clash, self.priority)
				)
