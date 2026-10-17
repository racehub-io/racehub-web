# Validation and limits

RaceHub has local tests with actual recordings and packet replays.
Some live simulator acceptance tests remain open.
Use the evidence for the exact revision and workflow that you need.

[Wiki home](Home.md) | [Professional analysis](Professional-Analysis.md) | [Capture and recovery](Capture-and-Recovery.md)

## Implementation and publication

The validation record below covers the local platform work checked on 16 October 2026.
Web, Rust, and iRacing changes use `telemetry/local-platform` until their pull requests merge.
The F1 Node library is published as `0.3.0`.

At this documentation check, the platform changes were prepared locally.
Signed platform pushes, their GitHub CI, and the first Pages deployment were still pending.
Check the repository's Actions runs and deployed revision for later status.
A passing local check is not a successful GitHub deployment.

## Checked behaviour

| Area | Evidence | What it establishes |
| --- | --- | --- |
| Web regression suite | 24 tests passed on Node.js 22.14 with all optional actual recording inputs | The checked import, row, analysis, recorder, and file-range cases pass |
| Rust suite | 11 tests passed; release build passed | The checked native parser, identity, storage, and lifecycle cases pass |
| Actual F1 packets | F1 24 and F1 25 recorded packet tests in the Node path | Those recorded packet families decode as checked |
| Native F1 | Actual F1 24 packet capture, clean stop, restart, and range reads | The checked native F1 24 path works locally |
| Actual Parquet | 3,982 recorded rows and 181 legacy Python F1 rows | Checked source values, aliases, lap identity, and selected reads survive import |
| Multipart Parquet | 100,103 rows across two parts from an unchanged actual-packet replay | One recording retains both sources and selected reads cross the part boundary |
| Export integrity | Original multipart downloads match source SHA-256 | Original Parquet export preserves those source bytes |
| Static hosting | Project-path assets, hash routes, hard reload, mobile layout, imports, charts, and exports checked | The built file analyser works on a strict local static server |
| Hosted isolation | Zero recorder API requests during those browser checks | The checked Pages workflow does not need the local recorder API |

Private acceptance recordings are not bundled in the repository or Pages artifact.
Shared F1 packet fixtures keep their source licence and attribution.
The checked cases do not cover every simulator state or packet combination.

## High-rate replay checks

Both runs sent unchanged actual F1 24 packet bytes over local loopback for five seconds.

| Scope | Offered rate | Recorded result |
| --- | --- | --- |
| Player telemetry | 2,000 packets per second | 10,000 packets and 10,000 rows |
| All-driver motion with source context | 1,000 motion packets per second | 5,000 repeated motion packets plus 11 context packets; 100,103 rows in two parts |

For these runs, received counts and raw archive counts matched sent counts.
Rejected packets and queue drops were zero.
These are short replay checks on macOS ARM64.
They are not live Windows acceptance tests or sustained varied-data storage benchmarks.
Repeated payloads are easier to compress than varied live telemetry.
Packets per second and rows per second measure different work.
One packet can contain many drivers or channels.

## Parser measurement

A local benchmark used 28 actual licensed F1 24 packets per round.
It used 50 warmup rounds, five trials, and 1,000 rounds per trial on macOS ARM64.
The saved median results were:

| Operation | Packets per second |
| --- | --- |
| JavaScript direct parsing | About 39,913 |
| Rust direct parsing | About 3,042,224 |
| JavaScript parsing and adapter | About 40,862 |
| Rust parsing and canonical row construction | About 35,209 |

Direct Rust parsing was about 76 times faster in this packet-sample benchmark.
That result does not establish the speed of complete capture, conversion, compression, or storage.
The two row paths do different work and emit different packet families.
The measured row paths do not establish a native end-to-end speed advantage.
Use workload-specific capture tests before making a performance claim for a new system.

## Simulator limits

| Source | Current boundary |
| --- | --- |
| Native F1 | F1 24 only; other F1 game years need a native decoder update |
| Node F1 client | F1 2018 through F1 25; experimental 2026 layouts lack recorded 2026 game tests |
| iRacing bridge | Windows SDK source; most detailed channels belong to the player; no world-coordinate map |
| rFactor 2 plug-in | Windows plug-in build and external SDK required; telemetry and scoring must be enabled |
| Driver scope | Limited by what the source sends and permits |
| External files | Only supported schemas and known units are safe to normalize |

Recorded F1 24/25 fixtures do not cover every packet type.
Read the [F1 client README](https://github.com/racehub-io/f1-telemetry-client#supported-formats) for those exact coverage limits.

## Open acceptance work

- Live Windows iRacing recording through the current bridge and both storage paths.
- Live Windows rFactor 2 recording with telemetry and scoring context.
- Complete-lap finish accuracy against an independent timing source.
- Long sessions with varied live data, disk pressure, and representative driver counts.
- Performance and memory checks on the user's actual hardware and browser.

Do not label the project certified, lossless on all networks, or validated for every professional use.
The collector cannot observe packet loss before receipt.
Raw recovery cannot recover packets that never reached the archive.
A crash can lose the last buffered data.

## Reproduce the public checks

From the matching Web branch:

```sh
npm ci --ignore-scripts
npm run check
npm run build
npm run build:pages
```

From the matching Rust branch:

```sh
cargo test --locked
cargo build --release --locked -p aggregator
```

Build the native binary before enabling the optional Web native integration checks.
Set `RACEHUB_NATIVE_BINARY` to the executable path for those checks.
Optional actual-file tests need local recordings and can be skipped when those inputs are absent.
A test run with skips has less coverage than the complete local acceptance run above.
Read the test files and CI results for the exact inputs and revision.

## Report an issue

Include the repository revision, operating system, game format, recording mode, and reproduction steps.
Include relevant counters, row totals, and the exact error message.
State whether the case was live capture, file import, or packet replay.
Share the smallest actual recording that reproduces the issue only when you have permission.
Do not post credentials or private driver data.
