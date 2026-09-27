# Service Atlas — Service Information Portal

Internal service implementation records with servers, endpoints, load balancers and network connections. Arabic RTL UI with search across names, IPs, URLs and VIPs. **No database**: the API stores data in one Excel workbook (`data/services.xlsx`) with separate relational sheets. The workbook is generated on first use. Real data is ignored by Git and must never be committed to the public repository.

## Run in GitHub Codespaces / locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open forwarded port 3000. Add a service, then use **تصدير Excel** to download the workbook. The data persists in the Codespace filesystem until that environment is deleted; back it up or move `DATA_DIR` to persistent approved storage. This repository contains no production data.

## Deploy to one Windows Server

1. Install supported Node.js and copy the application to a secured directory.
2. Configure `DATA_DIR` to a persistent server directory writable by the app process, outside the public web root; give authorized administrators access only.
3. Run `npm ci` and `npm start`; by default the app binds to `127.0.0.1:3000`.
4. Publish through IIS as a reverse proxy to that local address, with internal DNS, HTTPS, and organization approved authentication enforced at the proxy. Do not expose port 3000 directly. Disable anonymous access to the site. The application currently does **not** implement authentication or role based authorization; the `updatedBy` field is manually entered, not verified identity.
5. Back up `data/services.xlsx` regularly. The app also writes `services.backup.xlsx` before each update. Use one application process and one host for this file based storage; do not use multiple app instances against the same workbook.

Environment: `PORT` (default 3000), `HOST` (default 127.0.0.1), `DATA_DIR` (default `./data`). Do not edit the workbook directly while the application is running. Use the export for analysis and offline review.

## Workbook sheets

- `Services`: identity, customer, owner, status, environment, last update, revision.
- `Servers`: host, IPs, role, OS, site.
- `Endpoints`: URL, DNS, VIP, port, protocol.
- `LoadBalancers`: VIP, pool, members, port, WAF.
- `Connections`: NAT, GSN, Site-to-Site VPN or other connections with source, destination, port and ticket reference.

The update API checks revisions to prevent accidentally overwriting a newer service edit. Writes are serialized within the process and the workbook is replaced atomically. Excel is the primary data file, not a database server. Importing legacy workbooks requires field mapping and validation; this first version provides export and manual entry.
