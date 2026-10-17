# Troubleshooting

Check the source, recording mode, and site origin before changing the files.
Keep an original copy before conversion or recovery.

[Wiki home](Home.md) | [Getting started](Getting-Started.md) | [Capture and recovery](Capture-and-Recovery.md)

| Symptom | Check or action |
| --- | --- |
| Native mode is unavailable | Build the Rust release executable. Check `RACEHUB_NATIVE_BINARY`. Restart the local server. |
| The recorder sees no packets | Check the selected game, destination address, UDP port, packet format, and bridge process. |
| Native F1 rejects the game | Use F1 24 output. Use sampled JSON for another format supported by the Node client. |
| The UDP port is busy | Stop the other collector or select matching free ports in both source and collector. |
| rFactor 2 lacks driver or lap context | Enable telemetry and scoring in the plug-in. |
| Another driver has fewer channels | Check the source's player-only channels and privacy restrictions. |
| The map is absent | Check for world coordinates. The current iRacing bridge does not send them. |
| Steering is an angle instead of a normalized ratio | Use `steer_angle` in degrees. Do not guess a steering range. |
| A legacy file is rejected for unknown units | Export a supported schema with declared units. Do not rename fields to bypass validation. |
| A `.rhc` file will not import | Check its producer. Convert the binary archive with the matching recorder tools. |
| A selected Parquet view is too large | Select fewer laps. For external files, split oversized row groups with compatible tools. |
| A Parquet import rejects mixed recordings | Select all parts from only one recording. |
| A native recording has too many parts for the web reader | Split long captures into separate sessions for this workflow. Keep originals. |
| The browser library appears empty | Use the same site origin. Hosted and local libraries are separate. Import a saved export or load disk sessions locally. |
| A local Parquet reference cannot load on Pages | Import the original Parquet files. The hosted page cannot read local recorder references. |
| A native reference fails locally | Start the original recorder server and restore the source files at the saved location. |
| The sampled server directory stays locked after a crash | Stop other servers. Wait at least 30 seconds before retrying. |
| Native capture cannot reuse its output directory | Stop the owning process. The native OS lock releases when it exits. Use a new directory for capture or recovery. |
| Delta is unavailable | Check for shared valid distance and lap-time coverage. Inspect resets and incomplete segments. |
| The page loads but recording controls are absent | Check whether this is the Pages file-analysis build. Start the local application for capture. |
| Queue drops increase | Stop capture and inspect the error and retained files. Check disk throughput and source load before another run. |

## Request useful help

Include the repository revision, operating system, game, packet format, recording mode, and exact error.
State whether the issue came from live capture, replay, import, or export.
Include relevant counts and whether the original files still exist.
Read [Validation and limits](Validation-and-Limits.md) for open acceptance work.
Share actual telemetry only when you have permission.
