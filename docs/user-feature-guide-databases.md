# AFFiNE Database Features: User Guide

This guide covers the new relational and linked database features in AFFiNE. These tools allow you to connect data across different tables and create dynamic views of your information.

## 1. Relation Property

The **Relation** property allows you to link rows from one database to another database (within the same page/document).

### How to use:

1. Click the **+** button in your database header to add a new column.
2. Select **Relation** from the property type menu.
3. In the configuration panel, click **Select a database**.
4. Choose the target database from the list of available databases on the current page.
5. (Optional) Toggle **Show on target database** if you want a back-link column to be automatically created in the other database.
6. Click into a cell to search and select rows from the linked database.

---

## 2. Rollup Property

The **Rollup** property aggregates data from related rows. For example, if you have a "Tasks" database related to a "Projects" database, you can use a Rollup to "Sum" the "Total Hours" of all tasks for a project.

### How to use:

1. Ensure you have at least one **Relation** property already set up.
2. Add a new column and select **Rollup**.
3. **Relation:** Choose which relation property to pull data from.
4. **Target Property:** Select which column in the related database you want to aggregate.
5. **Calculation:** Choose how to summarize the data (e.g., Sum, Average, Count All, Earliest Date, etc.).

---

## 3. Linked Database View

A **Linked Database** allows you to show a view of an existing database elsewhere on your page. Changes made to the data in a linked view will update the source database immediately.

### How to use:

1. Type `/linked` in any blank line of your document.
2. Select **Linked view of database** from the slash menu.
3. Choose the source database you want to display.
4. You can now add multiple views (Table, Kanban, List, Gallery) to this linked instance.

**Note:** Filters and sorts applied to a Linked Database are independent. They do not affect the original "Source" database views.

---

## 4. Table vs database vs simple table

- **Table (slash / keyboard):** Inserts a full **database** in **table view** — use this when you want **Relation**, **Rollup**, **linked views**, and multiple view types later.
- **Simple table (slash):** Inserts the legacy **grid** block. Use it for a lightweight layout-only grid. You can **Upgrade to database table** from the banner above the grid when you need database features.
- **Existing simple tables** keep working; conversion is optional and replaces the block with a database (confirm first).

## 5. To-do list / workspace query view (`affine:data-view`)

When the **To-do list** (workspace query) block is shown as a table, you can add **Relation** and **Rollup** columns the same way as in a database:

- **Relation** links each query row (e.g. a to-do item) to **rows in a database on the same page**; the row picker is the same as for databases.
- **Rollup** aggregates values from the **linked database** through that relation.
- **Optional back-reference:** You can enable the reverse link on the target database; reverse columns store **query row block ids** (see the short note in the relation settings when configuring from a query view).
- If a to-do **leaves** the query (e.g. type changes), linked data in the query view **may still be stored** on that block id even when the row no longer appears in the view—until you edit or clear the cell.

For deeper product constraints and file-level references, see [affine-notion/data-view-block-relation-spike.md](./affine-notion/data-view-block-relation-spike.md). Contributor-facing verification and follow-up work (tests, Phase D) are tracked in [affine-notion/implementation_plan.md](./affine-notion/implementation_plan.md) and [affine-notion/table_database_unify_task_tracker.md](./affine-notion/table_database_unify_task_tracker.md).

## Important Constraints

- **Doc-Local Scope:** Currently, relations and linked views only work with databases located on the **same page**.
- **Bidirectional Sync:** If you delete a bidirectional relation column, the counterpart column in the related database will also be removed.
- **Rollup Calculations:** Some calculations (like Sum or Average) only appear if the target property is a Number type.
