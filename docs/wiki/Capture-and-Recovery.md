# Capture and recovery

The native collector saves source-rate telemetry and the original UDP packets.
Use a normal stop to complete the files.
Keep the complete recording directory for analysis and recovery.

Follow [Getting Started](Getting-Started.md) for installation and game setup.
See [Architecture](Architecture.md) and [Modules](Modules.md) for the collector and analyser roles.

## Select a source

| Simulator | Source | Default UDP port |
| --- | --- | ---: |
| F1 24 | Built-in game UDP output | 20777 |
| iRacing | RaceHub iRacing UDP bridge on the game computer | 20900 |
| rFactor 2 | RaceHub UDP broadcaster with telemetry and scoring enabled | 20888 |

Native F1 decoding supports F1 24 only.
The web application's **Sampled JSON** mode uses the separate JavaScript F1 parser.
Use it for other formats that this parser supports.

The iRacing and rFactor 2 bridges have their own SDK and platform requirements.
Live Windows capture for both still needs acceptance tests.
Read [Validation and Limits](Validation-and-Limits.md) before you treat protocol compatibility as a game test.

## Start and stop capture

In the local web application:

1. Open **Local recorder**.
2. Select the game and **Parquet - full game rate**.
3. Select the player or all drivers.
4. Set a session name and start recording.
5. Drive, then select **Stop and analyse**.

The hosted Pages analyser imports recordings.
Live capture uses the local collector setup.

You can also run the native CLI from the Rust repository root:

```sh
cargo run --release --locked -p aggregator -- capture --simulator f1 --output-dir recordings/f1-session --scope player
```

This command binds UDP to `127.0.0.1:20777`.
Use a new output directory for each recording.
Use `--host` and `--port` when the receiving interface or port differs.
The producer's destination must match the receiver.
For rFactor 2 LAN capture, its plug-in uses broadcast rather than an arbitrary destination IP.

Enter `stop` and press Enter for an orderly CLI stop.
EOF and Ctrl+C also use the stop path.
On Unix, SIGTERM uses it too.
The collector stops UDP input, drains accepted packets, and completes the raw and Parquet files.

The source rate is independent of the preview.
The preview contains at most 22 actual rows, at most twice per second.

## Read the counters

| Counter | Meaning |
| --- | --- |
| `received` | Datagrams read by the collector. |
| `rejected` | Datagrams rejected by size or decode checks. |
| `dropped` | Datagrams that could not enter the writer queue. |
| `rows` | Canonical telemetry rows appended to storage. |

One packet can produce several driver rows, no rows, or only metadata.
A row count is not a packet count or a count of updates for each channel.

The queue holds at most 1,024 packets.
A full queue stops capture with an error.
The counters cannot measure loss in the game, network, or operating system before the receive call.
Compare an independently known sent count with received and raw counts when you run a controlled replay.
Zero queue drops alone is not proof that every source packet arrived.

Packets accepted by the writer are archived before row projection.
A packet rejected before that writer, or a packet that could not be written, cannot be recovered from its raw files.
Oversized datagrams can fail before they enter the queue.

Check both status errors and the final manifest's `error` field.
A process can complete usable files with a recorded error.
Do not use the process exit code as the only integrity check.

## Keep source sessions separate

The recording UUID identifies the saved recording.
The source session ID identifies the game session.
Native metadata preserves source IDs as text.

The collector stops projected capture if the source session changes.
Its clock guard also stops on a source clock rewind greater than two seconds.
The rFactor 2 adapter treats a rewind greater than one second as a new source generation.
Smaller packet reordering must stay within both checks.
Start another recording after a flashback, restart, or session change.

After a projection error, the collector still attempts to archive accepted queued packets.
A storage failure can also prevent those writes.
The final error and retained files show what completed.

## Keep these files together

| File | Purpose |
| --- | --- |
| `session.json` | Recording metadata, source ID, counters, state, ordered part list, and raw file list. |
| `part-*.parquet` | Completed immutable Parquet parts. |
| `original-*.rhc` | Original packet archives with receive timestamps. |
| `*.tmp` | A file that has not completed its final replacement. |
| `.capture.lock` | The operating system lock that prevents a second writer in the directory. |

The manifest uses `format: "racehub-telemetry"` and `version: 1`.
Each part entry records its name, byte size, and row count.
The footer key `racehub` contains JSON metadata for that Parquet part.
Use the final manifest for the latest track metadata and complete part list.

Parquet parts normally contain 65,536 rows.
A row group contains at most 8,192 rows.
An estimated 16 MiB decoded group budget can close a group early.
A new channel can close a part early because a part has one schema.
Rows are sorted by participant and source time within each group.
The full recording is not one globally sorted table.

The recorder syncs completed parts before their final names appear.
It replaces the session manifest atomically.
`state: "complete"` means file finalization.
Check errors, counters, and lap completeness separately.

Missing channels remain absent in rows and become Parquet nulls.
Carried lap data keeps its source time.
See [Data and Units](Data-and-Units.md) for measurements and [Analysis Workflow](Analysis-Workflow.md) for import and selection.

## Preserve data integrity

Stop normally before you copy the full directory.
Retain the originals and analyse a copy when recovery or conversion is needed.
Keep the game format, bridge version, source revision, recording scope, and capture errors with the files.

The manifest records sizes and row counts.
It does not contain a cryptographic content hash for each file.
Use an external SHA-256 tool when you need to verify that a transfer preserved the exact bytes.
For example, run `shasum -a 256` on macOS, `sha256sum` on Linux, or `Get-FileHash -Algorithm SHA256` in PowerShell.
Hash files after they stop changing and compare the hashes after transfer.
A matching hash establishes byte identity. It does not establish sensor accuracy or source authenticity.

Local browser checks verified that original multi-part Parquet exports matched their source SHA-256 values.
Keep your own exported copies.
Browser IndexedDB is a separate library with its own quota.
Clearing site data removes that browser library.
Native references also need the original local server and files to remain available.

## What a crash can leave

Raw buffers flush every 100 packets.
They sync on a normal finish.
A crash can lose the last buffered writes or leave an incomplete final frame.
The Parquet part that was open can also remain incomplete.
Completed Parquet parts can still be read.

The file lock releases when its owning process ends.
The native CLI rejects an output directory that already contains recording files.
It does not resume writing into that directory.
The sampled JSON recorder has a separate stale-lock and interrupted-recording recovery path.
Its lock can require at least 30 seconds after a crash before a restart succeeds.

Keep the original files even when the manifest still says `recording`.
Use a new directory for recovery.
Do not rename an unfinished file and assume that it completed.

## Convert a raw archive

Set the shell variable `RACEHUB_RAW_FILE` to the actual archive path.
Then run this command from the Rust repository root:

```sh
cargo run --release --locked -p aggregator -- convert --simulator f1 --input "$RACEHUB_RAW_FILE" --output-dir recordings/f1-recovered --scope player
```

Select `iracing` or `rfactor2` for those sources.
Use an output directory that has no existing recording files.
Convert each raw file separately.
The converter also saves a new raw copy of the packets that it reads.

For an input with interleaved source sessions, `--source-session-id` selects one exact source ID for the projected rows.
The F1 UID filter runs before it mutates the selected decoder state.
The same source clock checks still apply.
It does not combine different game sessions into one recording.

If an archive has complete frames before a truncated frame, conversion saves that readable prefix.
It completes the recovered Parquet files, records the error, and returns an error.
A test with actual source packets recovered two rows before a truncated final frame.
This does not recover bytes that were never saved.
Inspect the new manifest and rows before you use the result.

## Identify the raw format

The `.rhc` suffix alone does not identify a format.
Read its producer and magic bytes.

| Format | Meaning | Reader |
| --- | --- | --- |
| `F1TEL`, version 1 | Rust F1 packet archive | Native `aggregator convert`; legacy `rhc2json` for packet inspection. |
| `RHRAW`, version 1 | Native generic packet archive for other simulators or unrecognized F1 headers | Native `aggregator convert`. |
| Python gzip packet archive | Separate Python collector format | Use its producing project's tools. |

F1TEL and RHRAW store one Zstd frame per archived original datagram.
Their envelope uses big-endian integer fields.
Each packet has a receive timestamp in Unix microseconds.
The payload keeps its original protocol bytes.
The native reader limits compressed frames to 1 MiB and expanded datagrams to 65,507 bytes.
A partial final frame is an error.

The native converter can also read the line-delimited raw packet format used by the licensed F1 test fixture.
It decodes `message.data` and its receive time.
It does not trust the fixture's saved `parsed` object.
That fixture is a sparse packet sample. It is not a continuous lap.

## Load the recovered result

For browser file import, select all completed Parquet parts from one recovered recording together.
Do not mix parts from different recording IDs.
The analyser rejects mismatched recording or game metadata.
Retain the recovered manifest and raw files as supporting evidence.

A selected chart view supports at most 500,000 rows and 64 MiB.
The web recorder catalogue accepts at most 4,096 parts per recording.
Those analyser limits differ from the native recorder's total row count.
Select fewer laps or split future captures into separate sessions when needed.
See [Validation and Limits](Validation-and-Limits.md) for the complete current boundary.

The [Rust repository](https://github.com/racehub-io/racehub-rust) contains the CLI and format guide.
The [web repository](https://github.com/racehub-io/racehub-web) contains file import and analysis.
Use [Professional Analysis](Professional-Analysis.md) for a repeatable technical review.
Return to [Home](Home.md).
