# Data and units

Keep the measurement, its identity, its unit, and its source time together.
A common file format does not make every simulator channel equivalent.

[Wiki home](Home.md) | [Architecture](Architecture.md) | [Analysis workflow](Analysis-Workflow.md)

## Portable session model

A portable session document contains these fields:

| Field | Meaning |
| --- | --- |
| `format` | `racehub-telemetry` |
| `version` | `1` |
| `id` | Recording identity |
| `simulator` | `f1`, `iracing`, or `rfactor2` |
| `name` | Recording name |
| `createdAt` | Recording creation time |
| `trackName` | Track name when available |
| `rows` | Recorded telemetry rows |

Each row has a `participantId` and a finite `sessionTime` in seconds.
Other fields include lap identity, lap number, distance, and recorded channels.
The importer preserves compatible numeric channels beyond the default charts.
It excludes unsafe property names and non-finite numbers.

Large source session identifiers must keep their exact identity.
The Node F1 client exposes the session UID as a JavaScript `bigint` when enabled.
Convert it to a string for JSON. Do not round it through a floating-point number.

## Canonical units

| Measurement | Canonical unit or scale | Notes |
| --- | --- | --- |
| `sessionTime` | Seconds | Source clock; not browser arrival time |
| `lap_time`, `last_lap_time`, `sector_1_time`, `sector_2_time`, `sector_3_time` | Milliseconds | The chart time axis and delta display seconds |
| `lap_distance` | Metres | Used for distance comparison |
| `world_x`, `world_y`, `world_z` | Metres | Source coordinate frame; map uses available position |
| `speed` | km/h | Source adapters convert known m/s fields |
| `throttle`, `brake` | 0 to 1 | Missing values stay absent |
| `steer` | -1 to 1 | Normalized steering when the source supports it |
| `steer_angle` | Degrees | Kept separately when steering range is unknown |
| `engine_rpm` | Revolutions per minute | Only when supplied |

Fuel and clutch are source-specific. F1 fuel uses kilograms; rFactor 2 fuel uses litres.
F1 clutch uses percent; iRacing and rFactor 2 clutch use ratios.
Retained legacy `current_lap_time` and `previous_lap_time` channels stay in seconds.
Their canonical aliases use milliseconds.
Other channels keep their documented source units.
Check the relevant protocol or adapter before comparing tyre pressure, temperature, forces, or suspension measurements.
A matching channel name alone does not establish a matching measurement.

The iRacing bridge supplies steering angle without a known steering range.
Its angle cannot become normalized steering without that range.
Some older iRacing Parquet schemas do not declare speed and control units.
The reader rejects those unverified schemas instead of guessing.

## Source time and sparse packets

A game can send motion, lap state, telemetry, and status in separate packet families.
Their rates and timestamps can differ.
Native rows keep the packet family's own measurement time.
Carried lap state includes its source clock, such as `lap_source_time`.
World-coordinate state can include `world_source_time`.

A carried value is the latest known state from its source.
It is not a new measurement of that channel.
The chart reader selects the packet families that contain the requested channel.
A different family's sparse row does not automatically create a false channel gap.
A missing measurement within the selected channel still stays missing.

## Identity and lap segments

The reader keeps session, participant, and lap identities separate.
A lap reset, changed lap number, or interrupted sequence can create a new segment.
Partial segments remain marked incomplete.
Invalid state is retained when available.
JSON normalization can mark in-laps and out-laps from source pit state.
The current Parquet lap index does not derive those pit-lap flags.
Use available pit context or run notes for that check.

The application checks measured distance and timing coverage for comparison.
Complete-lap finish accuracy still needs independent acceptance tests.
An available lap label is not proof that every packet reached the recorder.

## File formats

| Input | Use | Important limit |
| --- | --- | --- |
| RaceHub version 1 JSON | Portable complete session | Bounded whole-file import |
| Row JSON, NDJSON, CSV | Compatible recorded rows | Game and units must be known |
| Gzip JSON | Compressed supported JSON | Expanded-size limit applies |
| Flat RaceHub `.pq` or `.parquet` | Column storage with lazy lap reads | Supported schema and row-group limits apply |
| Legacy Python F1 Parquet | Earlier prefixed F1 columns | Known aliases and unit conversions only |
| Python column or channel-series JSON | Earlier collector exports | Valid source times and consistent data |

Native Parquet parts can include recording metadata.
Select all parts from one recording in the same import.
The importer rejects identified parts from different recordings or games.
Keep original filenames and the full part set.
Legacy files without native identity metadata cannot establish a common origin as strongly.

A `.rhc` suffix does not identify one universal format.
The Python gzip packet archive and the Rust F1TEL archive are different binary formats.
Use the matching recorder conversion or recovery tool before web import.
Do not rename an unsupported binary archive to `.json` or `.parquet`.

## Storage and ownership

| Location | Contents | Effect of clearing the browser library |
| --- | --- | --- |
| Browser IndexedDB | Imported documents, imported Parquet blobs, indexes, and recorder references | Removes those browser copies or references |
| Local sampled directory | JSON recordings | Disk files remain |
| Local native directory | Manifest, Parquet parts, raw archives, capture state | Disk files remain |
| Private self-hosted server | Recorder files for that server | Files remain on the server |

The default collector root is `Documents/RaceHub/sessions` under the user directory.
The web server puts native sessions under its `native` directory.
Browser data belongs to one site origin.
Hosted Pages and a local address have separate libraries.
Use export and import to move data between them.

Recorder references need the original server and files.
The hosted site reads imported files. It does not fetch local recorder references.
The **Remove** action removes the browser entry. It does not delete recorder disk files.

## Memory and size limits

| Operation | Limit |
| --- | --- |
| JSON import or sampled recording | 500,000 rows and 128 MiB expanded data |
| One selected Parquet view | 500,000 rows and 64 MiB of selected row data |
| One Parquet row group | 131,072 rows |
| Bounded Parquet batch or selected columns per row group | 32 MiB |
| Native parts listed for one web recording | 4,096 |
| Indexed lap segments | 100,000 |

These are reader and application limits.
They are not guarantees about available browser memory or disk space.
Native storage does not use the JSON row limit.
Select fewer laps or use smaller compatible row groups when a view exceeds a limit.
The original files stay unchanged.

## Export meaning

JSON exports preserve the portable session fields and recorded rows.
CSV exports keep spreadsheet formula text inert.
Original Parquet export returns the imported source bytes.
The local checks compare original multipart exports by SHA-256.
Selected-lap exports from an opened Parquet recording contain the selected view.
JSON library exports contain the full portable document or all its rows.
Neither export is a complete raw archive.

Use the original files for a later audit of conversion or display behaviour.
Read [Capture and recovery](Capture-and-Recovery.md) for crash boundaries.
