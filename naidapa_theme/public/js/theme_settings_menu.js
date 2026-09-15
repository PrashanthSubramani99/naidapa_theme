/* Naidapa Theme — sidebar menu editor on the Theme Settings form.
 *
 * Gives the "Workspace Order" child table (the curated sidebar) a
 * tenant-usable starting point. Before this, a tenant had to hand-type every
 * row; the button here replaces that with "seed from my workspaces, then
 * reorder/relabel/delete".
 *
 * The child table is the single source of truth: nothing here is stored
 * outside Theme Settings, and an EMPTY table always falls back to the default
 * ERP navigation, so the button is safe to experiment with.
 */

frappe.ui.form.on("Theme Settings", {
    refresh: function (frm) {
        frm.add_custom_button(__("Populate from workspaces"), function () {
            naidapa_theme_menu.populate_workspace_order(frm);
        }, __("Menu"));
    },
});

const naidapa_theme_menu = {
    populate_workspace_order: function (frm) {
        const existing = (frm.doc.workspace_order || []).length;

        const run = function () {
            frappe.call({
                method: "naidapa_theme.menu_editor.list_workspaces_for_menu",
                freeze: true,
                freeze_message: __("Reading workspaces…"),
            }).then((r) => {
                const rows = r.message || [];

                // Clear then re-add, so the order always matches the source
                // (sequence_id) instead of appending onto a stale list.
                frm.clear_table("workspace_order");
                rows.forEach((row) => {
                    const child = frm.add_child("workspace_order");
                    child.target_type = "Workspace";
                    child.target = row.target;
                    child.workspace_label = row.workspace_label;
                    child.workspace = row.target;
                    child.enabled = 1;
                });
                frm.refresh_field("workspace_order");

                frappe.show_alert(
                    __("{0} workspace(s) added. Reorder, relabel or remove rows, then Save.", [rows.length]),
                    8
                );
            });
        };

        if (existing === 0) {
            run();
            return;
        }

        // Replacing an existing list destroys the tenant's curation, so make
        // the destructive intent explicit.
        frappe.confirm(
            __(
                "Replace the current {0} menu row(s) with a fresh list of all {1} workspace(s)? Your ordering, labels and groups will be lost.",
                [existing, __("your")]
            ),
            run
        );
    },
};
