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

## Importing existing Excel files

Choose **استيراد Excel** and select one or more `.xlsx` files. The portal first previews the services and shows any files whose format is not recognized. Review the list and click **استيراد الخدمات** to save. Matching service name + code pairs are skipped, so re-importing the same file does not duplicate them. Imports are saved to the server workbook, not to OneDrive.

This first importer recognizes workbooks exported from this portal (sheets `Services`, `Servers`, `Endpoints`, `LoadBalancers`, `Connections`). Existing Implementation Sheet files with different headers or layouts need a mapping. Provide one representative **redacted** workbook so its server, URL, IP and network fields can be mapped and tested before importing the whole OneDrive folder. Download or sync the files from OneDrive locally, then choose them in the browser; the application has no direct OneDrive authorization.

### Implementation Sheet template mapping

The importer also recognizes the supplied `Implementation details_Template v1.0 New.xlsx` layout, reading the project name, server inventory (including CPU, RAM, domain and storage), publishing endpoints, load balancer rows, subnet/VLAN rows, application and standard communication matrix rows, and populated NAT rows. Example rows and empty template cells are ignored. The source workbook remains in OneDrive; the application imports selected structured fields into its own server workbook. Sheets such as checklist, design, software/hardware assets, physical connectivity and storage inventory are not yet modeled or imported. Other versions of the template may need adjusted mapping; review the preview before committing any batch.

## Impact analysis and record checks

Open **تحليل الأثر وجودة البيانات** to search an IP, server name, URL, VIP or service name. The page shows matching assets and network flows, and brings in flows from other service records when they explicitly contain the same server IP. It flags missing owner/CODE/server/endpoint fields and duplicate server IPs across services for review. The analysis is derived from the local Excel workbook each time data is loaded; it makes no live calls to F5, firewall, CMDB, DNS or OneDrive and cannot prove actual network reachability. Verify proposed changes against those systems before implementation.
