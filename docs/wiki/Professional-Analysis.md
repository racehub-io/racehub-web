# Professional analysis

RaceHub supports repeatable lap review with actual recorded telemetry.
Its main strength is a complete path from source packets to a lap comparison.
Retained files let you check the source measurements after the review.
A driver, coach, or engineer can compare an observation with the source measurements.
The useful result is a review that another person can reproduce from the same files.

Start with [Getting Started](Getting-Started.md) and [Analysis Workflow](Analysis-Workflow.md).
Use [Data and Units](Data-and-Units.md) to interpret each channel.

## What makes the workflow useful

| Need | Available support | Boundary |
| --- | --- | --- |
| Find where a lap changes | Reference lap, distance or time axis, lap delta, and a shared chart range | Delta needs overlapping recorded distance and lap time. |
| Review driver inputs | Recorded speed, throttle, brake, steering, gear, RPM, and other numeric channels | Games can omit or restrict channels. |
| Connect an input to a location | Chart cursor and recorded world path | A map needs world coordinates. The iRacing bridge does not provide them. |
| Keep fast source updates | Native UDP decoding and source-rate Parquet storage | The receive queue, disk, and machine still have limits. |
| Review long recordings | Compact Parquet lap index and selected-lap reads in a worker | One chart selection has a row and memory limit. |
| Repeat a review later | Original Parquet export, selected-lap JSON/CSV export, and a browser library | Keep an independent copy of the original files. |
| Inspect an interrupted recording | Original packet archives and conversion into a new directory | Recovery cannot recreate packets that were not saved. |

See [Architecture](Architecture.md) for the data path and [Modules](Modules.md) for the source responsibilities.

## Prepare a comparison

1. Record or import actual telemetry.
2. Confirm the game, track, participant, units, and recording scope.
3. Choose comparable laps and a reference lap.
4. Check partial and invalid lap labels.
5. Exclude laps affected by an out-lap, pit visit, traffic, or other conditions that invalidate your comparison.
6. Select a short section and the channels needed to answer one question.
7. Export the selected evidence and retain the original recording.

Keep your own notes about car setup, weather, tyres, fuel, and the purpose of the run.
The available channels do not establish all of these conditions for every source.
A difference between laps is an observation.
It does not establish which condition caused the difference.

Separate JSON sessions can be compared when their game and known track identity match.
For separate Parquet recordings, export the required laps as JSON and import those files.
Keep the original sessions separate.
Confirm the track layout and test conditions yourself.

## Use the channels together

A braking review can use speed, brake, steering, and lap delta over the same distance range.
A corner-exit review can use throttle, speed, gear, RPM, and the recorded path.
A vehicle-state review can use the fuel, tyre, temperature, or setup channels that the recording contains.
These are ways to inspect recorded data. RaceHub does not supply an automatic diagnosis.

Use the displayed units.
F1 fuel uses kilograms. rFactor 2 fuel uses litres.
iRacing steering stays in degrees when its steering range is unknown.
F1 clutch values use percent. iRacing and rFactor 2 clutch values use ratios.
See [Data and Units](Data-and-Units.md) before comparisons between sources.

Missing values stay unavailable.
The analyser separates gaps in a channel from unrelated packet families.
Its cursor selects a recorded point within the available segment.
It does not extrapolate a value beyond the segment.

The drawn chart can use fewer points than the selected recording.
Its reduction keeps actual samples and local extrema.
This changes the display workload, not the original Parquet files.
Use exports when you need to inspect the selected rows outside the chart.

## Interpret lap delta and completion

Use the distance axis to compare inputs at the same track position.
The time axis uses elapsed lap time.
The delta chart uses reference-lap elapsed time for its time axis.

Delta compares elapsed lap time at shared distance positions.
The analyser interpolates within usable recorded segments.
It does not stretch different lap endpoints to make them match.
A missing overlap leaves delta unavailable for that section.

Partial laps can still support a section review.
A full-lap result needs suitable start and next-lap evidence.
Read the complete/partial label and the recorded invalid flag separately.
Complete-lap finish accuracy still needs its acceptance test.
Confirm important full-lap results against the source timing until that check is complete.

A carried lap distance or lap time can be older than a driving-channel measurement.
Native rows preserve source times for that context.
A higher packet rate does not create new lap observations between the source's lap updates.

## Choose the recording mode

Use **Parquet - full game rate** for native capture.
The Rust process receives UDP directly and writes original packets and Parquet parts.
It does not impose the sampled JSON row limit.
Its bounded preview does not reduce the saved rate.

Use **Sampled JSON** when that mode better fits the source format or a smaller recording.
It defaults to the player at 10 samples per second.
The selected whole-number rate can be from 1 to 60 per driver.
The sampled collector stops at its row or byte limit.

Choose player scope for focused driver review.
Choose all drivers only when the source supplies the required data.
More driver rows increase file size and the work needed for a selected view.
The game still controls other drivers' privacy and channel availability.

## Evidence from local validation

The following results were recorded on 16 October 2026.
They are local validation results, not live game acceptance results.

- Actual licensed F1 24 packets have decoder and raw byte round-trip checks.
- An actual continuous recording was used for selected-lap values and delta overlap checks.
- Native capture was tested through stop, restart, and HTTP byte-range reads.
- Original multi-part Parquet exports matched their source SHA-256 values in a browser check.
- The browser-only build loaded recordings, charts, and a map without recorder API requests.

Two five-second UDP load checks used unchanged actual F1 24 packet bytes over loopback:

| Replay | Packets sent and received | Rows saved | Rejected packets | Writer queue drops |
| --- | ---: | ---: | ---: | ---: |
| Player telemetry, target 2,000 packets/s | 10,000 | 10,000 | 0 | 0 |
| All-driver motion, target 1,000 packets/s, plus 11 source packets for context | 5,011 | 100,103 | 0 | 0 |

The raw packet totals also matched the sent totals in both checks.
The all-driver replay produced two Parquet parts.
Repeated packets compress more easily than changing game data.
These short checks do not establish maximum sustained capture rate or session-length disk use.

A separate decoder benchmark used 28 actual F1 24 packets on one macOS ARM64 machine.
It used 50 warm-up rounds and five trials of 1,000 rounds each.
Median direct native parsing was approximately 3,042,224 packets/s.
Median native parsing plus canonical row construction was approximately 35,209 packets/s.

The JavaScript measurements were approximately 39,913 packets/s for parsing and 40,862 for its adapter.
The native decoder and JavaScript adapter construct different packet-family rows.
The parser-only result does not establish a complete capture or storage speed advantage.
See [Validation and Limits](Validation-and-Limits.md) for the test scope and remaining checks.

## Boundaries for technical decisions

- Native F1 capture currently accepts F1 24 only.
- Live Windows iRacing and rFactor 2 capture still need acceptance tests.
- A decoder test does not establish that a game connection works.
- Queue counters cannot detect packets lost before the process receives them.
- A file-completion state does not establish that a whole lap was recorded.
- Browser storage has quotas and belongs to one site origin.
- A selected Parquet view supports at most 500,000 rows and 64 MiB.
- Keep fewer laps open if a selection reaches its limit. The original recording stays intact.

Use [Capture and Recovery](Capture-and-Recovery.md) for capture checks and file retention.
Keep the source revision, configuration, files, and test conditions with a serious review.
This makes results easier to inspect and repeat.

Return to [Home](Home.md).
