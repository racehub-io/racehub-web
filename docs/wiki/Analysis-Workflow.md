# Analysis workflow

Choose comparable laps. Then use the delta and recorded channels to examine one section at a time.

[Wiki home](Home.md) | [Professional analysis](Professional-Analysis.md) | [Data and units](Data-and-Units.md)

## Prepare the comparison

1. Keep the original recording and note the application revision.
2. Check the game, track layout, car, session conditions, fuel, and tyre state when available.
3. Check the recording counters and the channels supplied for each driver.
4. Select laps that answer the same question.
5. Inspect incomplete and invalid labels before choosing a reference.
6. For JSON, inspect in-lap and out-lap labels when the source has pit state.
7. For Parquet, inspect available pit context or run notes before excluding pit laps.

These checks are analysis practice.
The app does not automatically match fuel, weather, tyre condition, or car setup.
A difference between two laps can have several causes.

## Open and select laps

Open a session in **Session library**.
Use the lap list to choose laps, colours, and a reference lap.
Use **Chart axis** to select distance or lap time.
For Parquet, the worker reads the selected lap samples.
Select fewer laps when a view reaches its memory limit.

For separate JSON sessions from the same game and track, use **Compare with open session**.
The comparison keeps the original sessions separate.
Save the comparison or export it before opening another session.
For separate Parquet recordings, export the required laps as JSON first.
Import those JSON files and compare them.
There is no direct multi-recording Parquet merge control.

## Read the delta

The delta is the selected lap's elapsed time minus the reference lap's elapsed time at shared distance.
A positive value means the selected lap reaches that position later.
A negative value means it reaches that position earlier.

The reader interpolates elapsed time within measured distance segments.
It uses only overlapping distance.
It does not stretch lap endpoints or extrapolate past recorded coverage.
A missing delta can mean that distance or lap time is absent, ambiguous, or insufficient.
A reset or reverse segment breaks the valid comparison range.

Drag across the delta chart or enter a range to inspect a section in the charts.
Use the change in delta through the section to locate where time changes.
Do not treat the curve alone as proof of the cause.

## Inspect a corner

Use these steps with the channels that the recording provides:

1. Locate a gain or loss in the delta.
2. Compare approach speed and the start of braking.
3. Compare brake release and steering through the entry.
4. Check minimum speed and gear through the corner.
5. Compare throttle application and exit speed.
6. Inspect the recorded path if world coordinates exist.
7. Repeat with another comparable lap before drawing a conclusion.

The map comes from recorded coordinates.
It is not a surveyed circuit model.
The current iRacing bridge has no world coordinates, so it has no map path.

## Choose channels

The default charts show throttle, brake, steering, speed, gear, and engine speed.
Select another recorded numeric channel in a chart control.
Fuel, tyre, wheel, suspension, and other channels depend on the source and permissions.
The application does not create channels that a game or bridge did not send.

A missing value is not zero.
Packet families can have different measurement rates and source times.
A line between samples does not prove that the source measured every intermediate point.
Read [Data and units](Data-and-Units.md) before combining channels.

The linked cursor helps you inspect the same chart position.
Use the arrow keys to move the cursor.
The cursor uses recorded samples within the available range.
Display point reduction retains recorded extrema and leaves the source file unchanged.

## Export and preserve the result

| Export | Purpose |
| --- | --- |
| Original JSON | Preserve the portable session document |
| Selected Parquet laps JSON | Move a selected comparison into another RaceHub session or tool |
| Selected Parquet laps CSV | Inspect rows in a spreadsheet or analysis program |
| Original Parquet | Keep every original part from the imported recording |

For an opened Parquet recording, export the selected laps as JSON or CSV.
For an opened JSON recording, the library exports the complete document or all its rows.
A saved or exported JSON comparison includes its combined rows.

Keep all original Parquet parts together.
Keep the native manifest and raw archives with the disk recording.
Record the reference lap, selected range, units, and conditions with your analysis notes.
The app does not provide an engineering report or shared review workspace.

## Avoid misleading conclusions

- Use the same track layout and a comparable session context.
- Check whether a driver's channels were private or absent.
- Check unit conversions before importing an external export.
- Use only the distance coverage shared by the selected laps.
- Confirm a complete-lap result independently while finish acceptance remains open.
- Distinguish a measured value from interpolation and a visual estimate.

Read [Validation and limits](Validation-and-Limits.md) before using a new simulator setup.
