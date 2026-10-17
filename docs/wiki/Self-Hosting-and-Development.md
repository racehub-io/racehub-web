# Self-hosting and development

Use the local defaults first.
Add private network access only when the recording setup needs it.

[Wiki home](Home.md) | [Getting started](Getting-Started.md) | [Architecture](Architecture.md)

## Local service configuration

Command-line options override matching environment variables.

| Option | Environment variable | Default |
| --- | --- | --- |
| `--port` | `RACEHUB_PORT` | `8081` |
| `--f1-port` | `RACEHUB_F1_PORT` | `20777` |
| `--iracing-port` | `RACEHUB_IRACING_PORT` | `20900` |
| `--rfactor2-port` | `RACEHUB_RFACTOR2_PORT` | `20888` |
| `--udp-host` | `RACEHUB_UDP_HOST` | `127.0.0.1` |
| `--data-dir` | `RACEHUB_DATA_DIR` | User `Documents/RaceHub/sessions` |
| `--static-dir` | `RACEHUB_STATIC_DIR` | Built `dist` directory |
| Environment only | `RACEHUB_NATIVE_BINARY` | Sibling Rust release executable |
| Environment only | `RACEHUB_ALLOWED_ORIGINS` | Local browser origins |
| Environment only | `RACEHUB_MAX_ROWS` | `500000`, sampled JSON only |
| Environment only | `RACEHUB_MAX_BYTES` | `134217728`, sampled JSON only |

The JSON limit settings can lower the limits. They cannot raise them.
They do not set the native packet rate.
Use a dedicated recording directory with enough free disk space.
Do not run two servers with the same recording directory.

## Receive from another computer

Start the collector with:

```sh
npm start -- --udp-host 0.0.0.0
```

Set the F1 game or iRacing bridge destination to the collector's LAN address.
For rFactor 2, use the plug-in's `BroadcastToNetwork` option and matching port.
Permit only the required UDP port on your private network.
HTTP control remains on loopback.
Keep game UDP capture off the public internet.

## Private self-hosting

Run the same Node server behind an authenticated private reverse proxy or private network.
The collector API has no user login or multi-user access control.
Origin and Host checks do not provide user authentication.

Forward the application, `/api`, and `/api/events` to the local server.
Keep the server-sent event connection open.
Preserve HTTP range requests and responses for Parquet files.
Set the upstream Host header to `127.0.0.1:8081`, or the configured port.
Add an exact browser origin through `RACEHUB_ALLOWED_ORIGINS` when needed.
Separate multiple origins with commas.

Recorder files stay on the server.
Imported files and session references stay in each browser library.
Define your own server access and backup policy.
The current application does not provide team accounts, shared permissions, or a hosted collaboration service.

## Local API overview

The API is an application interface for the matching local revision.
It is not a versioned public service contract.
Read [the server source](../../server/index.mjs) for exact request and response fields.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/status` | Read recorder availability, current state, and counters |
| `GET` | `/api/events` | Receive status, sample, and saved-session events |
| `GET` | `/api/sessions` | List saved sessions, including usable interrupted native captures |
| `GET` | `/api/sessions/{id}` | Read a sampled document or native session descriptor |
| `POST` | `/api/recording/start` | Select simulator, name, scope, engine, and sampled rate |
| `POST` | `/api/recording/stop` | Finish the active recording |
| `GET` | `/api/native/sessions/{id}` | Read native session metadata and part URLs |
| `GET` or `HEAD` | `/api/native/sessions/{id}/parts/{name}` | Read a validated native part; HTTP ranges are supported |
| `DELETE` | `/api/sessions/{id}` | Delete a completed recorder session from disk |

The API disk-delete operation differs from **Remove** in the browser library.
The browser action removes its own entry only.
Do not use disk deletion without a separate copy of files that you need.

## Build and develop

Use the matching implementation branches from [Getting started](Getting-Started.md).
From the Web repository:

```sh
npm ci --ignore-scripts
npm run check
npm run build
npm run dev
```

Stop an existing `npm start` process first.
The development command starts the web app and its collector.
Open <http://127.0.0.1:3000>.
The development proxy forwards the API to port `8081`, or `RACEHUB_PORT`.

For native work, build and test the Rust workspace separately.
Set `RACEHUB_NATIVE_BINARY` before running optional native Web integration tests.
Use recorded packets with a clear licence for public regression cases.
Keep private acceptance data outside the repository.

## Static Pages build

```sh
npm run build:pages
npm run preview:pages
```

The standard project path is `/racehub-web/`.
The build uses hash navigation so a direct analyser URL can reload on a static host.
`RACEHUB_BASE_PATH` changes the asset base path.
The deployment workflow sets `VITE_RACEHUB_SOURCE_REF` to the exact commit.
Its source and setup links then identify that deployed revision.

Pages serves file analysis. It cannot provide the collector API.
Only the built `dist` directory belongs in the Pages artifact.
Never include credentials, private recordings, or recorder directories.
Read [the Pages workflow](../../.github/workflows/pages.yml) for the reviewed deployment path.

## Contribute a change

1. Check which module owns the behaviour.
2. Open an issue with the actual use case and source format.
3. Make a focused change with recorded-data checks where relevant.
4. Verify units, identity, source clocks, and missing-data behaviour.
5. Update these wiki pages when the public workflow changes.
6. Submit a pull request with the tested scope and any limits.

Use [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks.
Use [SECURITY.md](../../SECURITY.md) for private security reports.
Keep existing licences and attribution when moving or adapting source.
