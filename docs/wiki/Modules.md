# Modules

RaceHub separates game access, recording, storage, and analysis.
Use the current local platform for a new installation.
Keep earlier clients separate unless you need their file formats or interfaces.

Navigation: [Home](Home.md) | [Architecture](Architecture.md) | [Getting Started](Getting-Started.md) | [Data and Units](Data-and-Units.md) | [Capture and Recovery](Capture-and-Recovery.md) | [Validation and Limits](Validation-and-Limits.md)

## Current application modules

| Module | Responsibility | Input | Output | Use it when |
| --- | --- | --- | --- | --- |
| [racehub-web](https://github.com/racehub-io/racehub-web) | Recording controls, file library, lap selection, comparison, charts, maps, and exports. | Supported recording files, or the local recorder API. | Browser views, portable JSON, CSV, and original recording exports. | You want to analyse recordings or control local capture. |
| [racehub-rust](https://github.com/racehub-io/racehub-rust) | Native packet decoding, source-rate recording, raw archives, and Parquet storage. | F1 24 UDP, the iRacing bridge protocol, or the rFactor 2 broadcaster protocol. | `session.json`, Zstd Parquet parts, raw packet archives, and process status. | You want the received source rate without the sampled JSON limit. |
| [f1-telemetry-client](https://github.com/racehub-io/f1-telemetry-client) | F1 UDP reception, packet parsing, types, constants, and optional packet forwarding in Node.js. | F1 game UDP packets or an existing packet buffer. | Decoded packet events and original packet buffers. | You need a Node.js F1 integration or the web app's sampled F1 recording mode. |
| [racehub-iracing-udp](https://github.com/racehub-io/racehub-iracing-udp) | Read the Windows iRacing SDK and send the RaceHub bridge protocol. | The current iRacing SDK buffer. | One Protobuf `TelemetryPacket` per UDP datagram. | You want iRacing data in either current collector. |
| [rfactor2-udp-broadcaster](https://github.com/racehub-io/rfactor2-udp-broadcaster) | Send rFactor 2 telemetry and scoring from a Windows game plug-in. | rFactor 2 plug-in callbacks. | Protobuf `DataPacket` UDP datagrams. | You want rFactor 2 data in either current collector. |

The native collector is optional for file analysis.
The iRacing bridge and rFactor 2 plug-in are separate game-side processes.
They do not replace the collector or the analyser.

## The web application

`racehub-web` contains two parts.
The React application runs in the browser.
The Node.js server supplies local recording and file access.

| Source area | Responsibility |
| --- | --- |
| `src/components/Canvas/Explorer/` | Import files, list saved recordings, load disk recordings, and export data. |
| `src/components/Canvas/Recorder/` | Select the simulator, recording mode, and driver scope. Start and stop local recording. |
| `src/components/Canvas/SessionPanel/` | Select laps and a reference lap. |
| `src/components/Canvas/LineChartPanel/` | Compare recorded channels, inspect lap delta, and select a shared section. |
| `src/components/Canvas/MapPanel/` | Display recorded world positions when the source provides them. |
| `src/telemetry/data.ts` | Parse portable files and construct session and lap data. |
| `src/telemetry/library.ts` | Save the browser library in IndexedDB. |
| `src/telemetry/parquet.ts` | Read Parquet metadata, build lap indexes, and read selected lap rows. |
| `src/telemetry/parquet.worker.ts` | Run Parquet indexing and selected-row reads in a browser worker. |
| `server/index.mjs` | Serve the local application and its recording API. |
| `server/adapters.mjs` | Convert sampled F1, iRacing, and rFactor 2 packets to portable rows. |
| `server/native.mjs` | Control the Rust process and serve completed Parquet file ranges. |
| `server/storage.mjs` | Store and recover sampled JSON recordings. |

The local server uses HTTP and server-sent events.
It does not use the earlier Fangio WebSocket interface.
The sampled F1 adapter calls `F1TelemetryClient.parseBufferMessage` from version `0.3.0`.
The native path does not call that JavaScript parser.

The GitHub Pages build contains the browser application only.
It supports file import and analysis.
It cannot start a game collector or serve files from a local recorder.
Export those files from the local setup, then import them into Pages.
Select all Parquet parts from one recording together.

See [Getting Started](Getting-Started.md) for the local and hosted workflows.

## The Rust workspace

The current recorder executable is `aggregator`.
Its name does not mean that it averages the captured telemetry.
It decodes packets and writes rows at the received source rate.
The source or bridge sets that rate.

| Crate or source area | Responsibility | Current integration |
| --- | --- | --- |
| `common/src/f12024/` | F1 24 packet structures and constants. | Shared protocol definitions. |
| `capture/src/native.rs` | Select the simulator decoder and project F1 24 data to portable rows. | Called by the native recorder. |
| `capture/src/protocols/` | Decode the iRacing and rFactor 2 Protobuf protocols and map their channels. | Called by the native recorder. |
| `aggregator/src/main.rs` | Capture CLI, packet queue, session checks, counters, and orderly shutdown. | The executable started by the web server or command line. |
| `aggregator/src/storage.rs` | Arrow columns, Parquet parts, and atomic session manifests. | Stores projected telemetry. |
| `aggregator/src/raw.rs` | Original packet archive writing and bounded archive reads. | Keeps source bytes for inspection and conversion. |
| `capture/src/lib.rs`, `capture/src/recorder.rs`, and `capture/src/db.rs` | Earlier C ABI capture, F1TEL recording, and SQLite frame storage. | Separate library interfaces. The current recorder does not use the C callback path or SQLite frame store. |

The `capture` crate can also build a dynamic library.
The current web application starts the `aggregator` executable instead.
Do not install the earlier library interface as a required web dependency.

Native F1 decoding currently supports F1 24 only.
The JavaScript client supports more F1 game formats.
Those two support lists are different.
See [Capture and Recovery](Capture-and-Recovery.md) for command lines and file handling.

## The game bridges

### iRacing

The bridge is a Python program that runs on Windows beside iRacing.
It reads the latest SDK buffer at each poll.
It sends to `127.0.0.1:20900` by default.
The Rust and sampled Node collectors both accept this wire format.

The bridge has more driving channels for the player than for other cars.
It does not send world coordinates.
It can send the same SDK sample more than once.
Full-rate recording preserves the received bridge stream.
It does not add measurements that the bridge never observed.

Python stays in the iRacing source path even when Rust records the packets.
Live Windows acceptance remains separate from packet-decoder tests.

### rFactor 2

The broadcaster is a Windows plug-in with a Protobuf schema.
Telemetry carries driving measurements.
Scoring supplies driver and lap context.
Enable both for the current analysis workflow.
The default collector port is `20888`.

The broadcaster build needs the rFactor 2 SDK, compatible Protobuf libraries, and its documented Visual Studio toolset.
The public source does not include the excluded SDK headers or a ready plug-in binary.
Use its README for those build requirements.

The Rust and Node collectors each decode the protocol directly.
They do not need the older `rfactor2-udp-parser` package.
Live Windows acceptance remains open.

## Earlier collectors and file compatibility

These public modules remain useful for existing recordings or custom work.
They are separate from the current default setup.

| Repository | Implemented role | Boundary with the current platform |
| --- | --- | --- |
| [racehub-client-python](https://github.com/racehub-io/racehub-client-python) | Python recording and processing workers. Its source includes gzip packet archives, `.pq` parsing, and a local WebSocket service. | Import its supported Parquet, column JSON, or channel-series JSON exports into `racehub-web`. Its binary gzip `.rhc` archive is not the native Rust archive format. |
| [f1-game-telemetry-client-python](https://github.com/racehub-io/f1-game-telemetry-client-python) | Python packet structures for F1 2022 and F1 2023. | A separate parser library. It is not a required dependency of the current web or Rust path. |
| [f1game-udp-parser](https://github.com/racehub-io/f1game-udp-parser) | An earlier Rust-backed Node.js F1 parser built with Neon. | Distinct from `f1-telemetry-client` and the current standalone Rust recorder. The current web dependency list does not use it. |
| [rfactor2-udp-parser](https://github.com/racehub-io/rfactor2-udp-parser) | Node.js UDP reception and Protobuf packet decoding for the broadcaster. | Useful for a separate Node integration. Current collectors contain their own protocol adapters. |
| [racehub-client-nodejs](https://github.com/racehub-io/racehub-client-nodejs) | An earlier local recorder, parser, and optional upload client with a WebSocket interface. | It is not the Node server inside the current `racehub-web` repository. |
| [fangio](https://github.com/racehub-io/fangio) | An earlier React analyser with a local client connection at `ws://localhost:8082` and optional Firebase features. | Keep its setup separate. The current application is `racehub-web`, with its own local collector and Pages build. |

The web importer supports specific file dialects.
It does not accept every format from these repositories.
Unknown binary archives and Parquet dialects with unverified units are rejected.
See [Data and Units](Data-and-Units.md) before moving a recording between tools.

## Other public project modules

These modules do not form part of the current validated capture path.
Their existence does not establish a supported integration.

| Repository | Role and limit |
| --- | --- |
| [bono](https://github.com/racehub-io/bono) | Optional Firebase API for authenticated file uploads, checks, and machine logs. Local use does not need it. Its current README states that live deployment integration has not run. |
| [racehub-client](https://github.com/racehub-io/racehub-client) | An unfinished Electron desktop shell. Its README states that it does not contain the full telemetry client interface. |
| [atlas_tcp](https://github.com/racehub-io/atlas_tcp) | ATLAS TCP configuration and sample sender code. The sample sends generated wave values. It is not a validated current RaceHub recording integration. |
| [racehub-client-grpc](https://github.com/racehub-io/racehub-client-grpc) | A gRPC telemetry stream experiment. Its server generates values. It is not a real simulator source or evidence of capture accuracy. |
| [udp-emitter-go](https://github.com/racehub-io/udp-emitter-go) | A Go desktop message emitter. Its current source sends configured Protobuf messages over WebSocket. It is not a current game UDP collector, despite the repository name. |

The current analyser does not use these generated-data experiments.
They do not supply recorded laps or performance evidence for this wiki.

## Historical repositories

These public repositories preserve earlier work.
They are not required by the current local platform.

| Repository | Historical role |
| --- | --- |
| [old-racehub-client](https://github.com/racehub-io/old-racehub-client) | Earlier Electron recorder and parser interface for F1 and rFactor 2. Automatic updates and publishing are disabled. Read its licence scope before reuse. |
| [old-racehub-client-firebase](https://github.com/racehub-io/old-racehub-client-firebase) | Earlier Electron/Firebase authentication library. It needs the operator's Firebase project. |
| [old-racehub-firebase-client](https://github.com/racehub-io/old-racehub-firebase-client) | Legacy desktop app that uses the authentication library above. Its recorder start code is incomplete. |
| [race-token](https://github.com/racehub-io/race-token) | Separate ERC20 and ERC721 contract experiments. Recording and analysis do not use a token. |

## Integration and contribution boundaries

- Change game access in the game-side bridge or plug-in.
- Change packet decoding in the matching protocol adapter.
- Change native file writing in `racehub-rust`.
- Change local recorder control or browser analysis in `racehub-web`.
- Change the reusable Node.js F1 API in `f1-telemetry-client`.
- Keep the bridge schema, generated bindings, and both collectors compatible when you change a Protobuf field.
- Preserve field numbers and scalar-presence rules.
- Document units and source timestamps with each added channel.
- Validate a recorded source value before you add a conversion.
- Keep original packet archives when you investigate decoder errors.

A shared row name does not make two measurements interchangeable.
For example, F1 fuel uses kilograms and rFactor 2 fuel uses litres.
iRacing steering angle uses degrees when its steering range is unknown.
See [Data and Units](Data-and-Units.md) for these distinctions.

## Licence files

Each public repository listed here has a root `LICENSING.md` and `LICENSES/CC0-1.0.txt`.
Read the repository's scope before you reuse its files.
RaceHub applies CC0 to the rights it owns in its original contributions.
Separate contributor, dependency, SDK, game, recording, and artwork terms remain in force.

| Component | Scope file | Other relevant terms |
| --- | --- | --- |
| Web app | [racehub-web/LICENSING.md](https://github.com/racehub-io/racehub-web/blob/main/LICENSING.md) | [CC0 text](https://github.com/racehub-io/racehub-web/blob/main/LICENSES/CC0-1.0.txt). Separate dependency and artwork rights remain. |
| Native recorder | [racehub-rust/LICENSING.md](https://github.com/racehub-io/racehub-rust/blob/main/LICENSING.md) | [Protocol notices](https://github.com/racehub-io/racehub-rust/blob/telemetry/local-platform/capture/src/protocols/NOTICE). Recorded fixtures have their own notices. |
| F1 Node client | [f1-telemetry-client/LICENSING.md](https://github.com/racehub-io/f1-telemetry-client/blob/master/LICENSING.md) | Existing [MIT licence](https://github.com/racehub-io/f1-telemetry-client/blob/master/LICENSE). |
| iRacing bridge | [racehub-iracing-udp/LICENSING.md](https://github.com/racehub-io/racehub-iracing-udp/blob/main/LICENSING.md) | iRacing and external SDK packages keep their terms. |
| rFactor 2 broadcaster | [rfactor2-udp-broadcaster/LICENSING.md](https://github.com/racehub-io/rfactor2-udp-broadcaster/blob/main/LICENSING.md) | Existing [MIT licence](https://github.com/racehub-io/rfactor2-udp-broadcaster/blob/main/LICENSE). SDK and bundled Protobuf terms remain separate. |
| Python collector | [racehub-client-python/LICENSING.md](https://github.com/racehub-io/racehub-client-python/blob/main/LICENSING.md) | Third-party interfaces and dependencies keep their terms. |

For another repository, open its root `LICENSING.md` from the repository link above.
No project licence grants access to a game account or removes the game's own terms.

See [Validation and Limits](Validation-and-Limits.md) before you describe an integration as accepted or quote a performance result.
