# Getting started

Use imported files for the first analysis.
Add the local recorder when you need game capture.

[Wiki home](Home.md) | [Modules](Modules.md) | [Troubleshooting](Troubleshooting.md)

## Choose a mode

| Mode | Requirements | Recording | File location |
| --- | --- | --- | --- |
| Hosted analyser | Browser with IndexedDB | Use a separate local recorder | Imported copies stay in browser storage |
| Local application | Git, Node.js 22.14 or later, browser | Sampled JSON; native Parquet when Rust is built | Recorder disk directory and browser library |
| Private self-hosting | Local application and private server access | Same collectors | Server disk and each browser's library |

The first dependency install needs internet access.
The installed local application does not need a RaceHub service.
The games keep their own access requirements.

## Analyse an existing file

After Pages deployment, open the [hosted analyser](https://racehub-io.github.io/racehub-web/#/analyser).
You can also use the local application below.

1. Select **Import telemetry**.
2. Select the game if the file does not identify it.
3. For one native recording, select all its `.parquet` parts together.
4. For JSON, CSV, NDJSON, or gzip JSON, select one file.
5. Select a lap. Choose channels in the charts.
6. Export a copy before you clear browser data.

Do not select parts from different recordings together.
A local recorder file reference cannot load on the hosted site.
Import its original files there.
Read [Data and units](Data-and-Units.md) for supported formats and limits.

## Start the local application

The current platform implementation uses `telemetry/local-platform`.
Use this branch in the three matching repositories until the pull requests merge.
These commands select it explicitly.

```sh
git clone --branch telemetry/local-platform https://github.com/racehub-io/racehub-web.git
cd racehub-web
npm ci --ignore-scripts
npm run build
npm start
```

Open <http://127.0.0.1:8081/analyser>.
Keep the terminal open during capture.
Use **Sampled JSON** if the native collector is not installed.
Its default rate is 10 samples per second for the player.
You can select 1 to 60 samples per second per driver.

## Add native Parquet capture

Install stable Rust and a C/C++ build toolchain for your operating system.
The build compiles native SQLite and Zstd dependencies.
From the `racehub-web` directory, run:

```sh
git clone --branch telemetry/local-platform https://github.com/racehub-io/racehub-rust.git ../racehub-rust
cd ../racehub-rust
cargo build --release --locked -p aggregator
cd ../racehub-web
npm start
```

Stop an existing web server before you start this one.
The server finds the sibling release executable.
On Windows, the executable is `aggregator.exe`.
Set `RACEHUB_NATIVE_BINARY` to its full path if your build is elsewhere.

In **Local recorder**, select **Parquet - full game rate**.
Select the game and driver scope. Enter a session name.
Select **Start recording**. Then select **Stop and analyse** when capture ends.
Read [Capture and recovery](Capture-and-Recovery.md) before a long session.

## Connect the game

| Game | What to start | Same-computer destination | Checks |
| --- | --- | --- | --- |
| F1 24 native | Built-in game UDP output | `127.0.0.1:20777` | Select F1 24 packet format |
| Other supported F1 formats | Built-in game UDP output and sampled JSON mode | `127.0.0.1:20777` | Check the Node client's supported formats |
| iRacing | Windows [RaceHub bridge](https://github.com/racehub-io/racehub-iracing-udp/tree/telemetry/local-platform) | `127.0.0.1:20900` | Enter a game session; check the player channels |
| rFactor 2 | Windows [UDP broadcaster](https://github.com/racehub-io/rfactor2-udp-broadcaster) | UDP port `20888` | Enable telemetry and scoring; keep `BroadcastToNetwork` off for local capture |

Build and install each Windows bridge with its repository instructions.
The rFactor 2 SDK and a ready plug-in binary are not bundled with the web application.
Live Windows capture for both bridges still needs acceptance tests.
The current iRacing bridge does not send world coordinates for a map.

For capture from another computer, read [Self-hosting and development](Self-Hosting-and-Development.md).
Do not start two collectors on the same UDP port.

## First session check

1. Check that received packets increase.
2. Check rejected packets and queue drops.
3. Stop the recording through the application.
4. Open a lap and check a known channel against the game or an independent tool.
5. Check units and source timing before comparison.
6. Keep the disk files and an export.

A successful import proves that the file can be read.
It does not prove complete game capture or correct simulator measurements.
Use [Validation and limits](Validation-and-Limits.md) before relying on a new setup.
