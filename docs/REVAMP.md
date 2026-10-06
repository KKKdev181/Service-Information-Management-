# Technology Service Hub — repository review

## Keep
Excel relational sheets, serialized atomic writes and backups; optimistic revisions; preview-before-import; naming rules that fill missing values and flag conflicts; local SVG icons/ELK; editable diagrams and grouped projection.

## Findings and implemented direction
- `app.js` mixes routing, record forms, service details, dashboard and import. Extract service facts and workspace rendering into independently testable modules; retain existing import and CRUD controller for compatibility.
- Repeated CSS overrides obscure the design system. Add one scoped workspace stylesheet, with reusable layout primitives and responsive navigation; existing editor CSS remains isolated.
- Service detail repeats identity and presents five large tables at once. Replace with Overview, Infrastructure and Connections workspace views, contextual edit actions, environment filtering and an inline architecture preview.
- Host location and lifecycle environment are different concepts. Derive environment summaries from inventory, endpoints and platform components; preserve GCP/NIC/SALAM as hosting locations.
- OpenShift has only a service-level label, with no namespace/cluster inventory. Add a Components sheet with environment, location, platform type, cluster, namespace and endpoint. Accept Hybrid hosting.
- Manual server count can disagree with inventory. Surface recorded and declared counts distinctly and flag mismatch.
- Existing impact search is substring-based and only traverses connection rows. Include exact-address graph traversal through recorded publishing, VIP/backend and connection relationships, marking direct and indirect dependencies with evidence. This remains record-based, not live discovery.
- Diagram edits and Excel inventory are distinct. Store the inventory signature when generating/saving a diagram and show a stale-data notice when inventory changes. Do not silently replace manually maintained diagrams.
- Existing giant modal forms are overwhelming. Use expandable inventory sections and record rows, preserve unsaved fields, offer contextual section editing, and add keyboard close/focus restoration.
- Data checks should be actionable: missing codes/platform/location, counts that disagree, incomplete endpoints/connections, naming conflicts. Do not label checks as service availability.
- Legacy importer intentionally maps only known templates. Extend portal export/import to optional Components while preserving older workbooks.

## Practical boundaries
No database, live network discovery, verified SSO identity or real-time availability claims. Existing reverse-proxy authentication requirement remains. Saved diagrams remain separate from inventory; update them explicitly after reviewing inventory changes.
