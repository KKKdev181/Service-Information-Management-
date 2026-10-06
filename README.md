# Technology Service Hub

Internal service catalog, infrastructure inventory, architecture editor and record-based change-impact analysis. **No database:** inventory lives in Excel; saved architecture diagrams live in JSON.

## Run

Requires Node.js 20 or newer.

```bash
npm ci
npm run dev
```

Open forwarded port 3000 in Codespaces. Production command: `npm start`.

## Service workflow

- **Service catalog:** search names, addresses, URLs, platform components, clusters and namespaces; filter status and GCP/NIC/SALAM hosting locations. Four executive indicators open the records behind their counts.
- **Overview:** purpose, code, lifecycle status, hosting, derived environment summary, recorded infrastructure counts, publishing/WAF/VIP details, generated grouped architecture preview and actionable record checks.
- **Infrastructure:** filter by environment and name/IP; inspect expandable servers and platform components. Service-wide load-balancer pools and network/VLAN records remain visible because their environment is not assumed.
- **Connections & impact:** see recorded communication paths and trace an exact name, IP, URL or VIP across services. Direct and indirect relationships include publishing → WAF → VIP → backend and communication records. Traversal follows both directions to identify possible dependencies; it is not proof of an outage or live reachability.
- **Maintain records:** contextual edit buttons open expandable sections and individual records, with selectable environments/platforms and naming-rule assistance. Save explicitly. A server count entered manually is labeled separately from the actual recorded inventory and mismatches are flagged.
- **Architecture:** grouped overview by environment/role; expand groups, edit individual nodes, manage connections through searchable From/To selectors, automatic ELK arrangement and SVG export. Component changes remain separate from inventory.

## Data model

`DATA_DIR/services.xlsx` contains:

| Sheet | Purpose |
| --- | --- |
| Services | Name, code, status, purpose, hosting locations/type, optional declared count, update metadata and revision |
| Servers | Names/IPs, role, environment, location, zone, platform, OS and sizing |
| Components | OpenShift/platform components, cluster, namespace, environment, location, URL and role |
| Endpoints | Publishing URL/DNS, public IP, WAF IP, VIP and protocol/port |
| LoadBalancers | VIP, pool, backend addresses and ports, publishing and certificate details |
| Connections | Source/destination, type, protocol, ports, duration and request reference |
| Networks | Subnet, IPAM/range, VLAN, gateway and context |

Legacy customer/owner columns remain in the workbook for compatibility but are not displayed or required. Older portal workbooks without Components are supported. Schema migration maps columns by header and preserves existing records. Workbook writes are serialized and replaced atomically with a prior-version backup. Revision checks reject stale edits. Child IDs survive edits.

Platform can be VM, OpenShift or Hybrid. The workspace also derives Hybrid from explicitly recorded VM and OpenShift components. Server existence or naming prefixes alone are not proof of VM hosting.

## Naming rules

PN1 = old Production; PN3 = NIC Production; PE1 = SALAM Corporate Production; SN3 = NIC Staging; SE1 = SALAM Staging; BN4 = DR; TE/T = QA; DE = Dev IaaS; D = Dev; TG = GCP Dev. Longest prefixes match first, case-insensitively. Only missing values are filled; conflicts are surfaced in record review. Unspecified locations/platforms are not guessed. Existing workbook records are enriched when loaded; changes receive an updated revision and backup. The edit form also provides an explicit fill button.

## Import / export

Import one or more `.xlsx` files and review the preview before committing. Supported formats: portal exports and the mapped Implementation Sheet template (`Summary`, `Server Details`, communication matrix and NAT sheets). Unknown templates require a mapping. Re-imports with the same service name and code are skipped. The Components sheet is optional for older exports. Export downloads the full catalog, not just the selected service.

OneDrive files must be downloaded or synced before selecting them; there is no direct OneDrive API integration. Unmodeled legacy sheets such as checklists and physical connectivity are not imported.

## Diagram freshness

Saved diagrams are under `DATA_DIR/architecture/<service-id>.json`, with a prior-version backup and independent revisions. An inventory signature flags when source inventory has changed since generation. Legacy diagrams without a baseline also prompt review. **Generate from records replaces the diagram after confirmation**; it does not merge or silently discard manual diagrams. The service overview preview always uses current inventory and is labeled accordingly. SVG exports include local illustrations.

## Deployment and persistence

Use one Node process on one host with persistent `DATA_DIR` outside the public directory. Default `HOST=127.0.0.1`, `PORT=3000`. On Windows Server, place IIS with HTTPS and organization-approved authentication in front of Node, disable anonymous access and do not expose port 3000 directly. The app does not implement SSO or role-based authorization; `updatedBy` is manually entered, not verified identity.

Back up the entire DATA_DIR, including diagrams. Codespace data lasts only as long as its filesystem. Do not commit real workbooks or architecture data to Git or edit the workbook directly while the application is running.

## Maintenance and verification

- `public/service-facts.js`: derived facts, inventory signature and exact-address dependency traversal.
- `public/service-workspace.js`: Overview / Infrastructure / Connections rendering.
- `public/app.js`: catalog, routing, imports and record-edit controller.
- `public/intelligence.js`: inventory search and quality checks.
- `public/server-rules.js`: shared naming rules.
- `public/architecture-*.js`, `connection-manager.js`: generation, grouping, layout, rendering and editing.
- `server/store.js`: Excel persistence, migration and imports.
- `server/architecture.js`: diagram validation and persistence.
- `public/styles.css`: shared design tokens/components; `workspace.css`: service workspace; `architecture.css`: diagram workspace.

Run `node --test tests/*.test.js`. Tests cover data migration, Excel roundtrip, stale saves, duplicate import, naming rules, grouping, connection validation, impact traversal, derived hybrid facts and diagram persistence. See [repository review](docs/REVAMP.md) for product and refactoring decisions.
