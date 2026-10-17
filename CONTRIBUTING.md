# Contribute to RaceHub Web

RaceHub is a free, open source project.
Help with code, documentation, usability, protocol support, or reproducible bug reports.
No RaceHub account or subscription is needed to run the local application.

## Set up the project

Follow the [README](README.md#quick-start) for the supported Node.js version and install commands.
Use `npm run dev` for the local development server.
For native recording work, also build [racehub-rust](https://github.com/racehub-io/racehub-rust).

Run these checks before a pull request:

```sh
npm run check
npm run build
```

Set `RACEHUB_NATIVE_BINARY` to the collector executable to run native integration tests.
Some Parquet and continuous-recording checks use optional local fixture paths.
A skipped check does not validate that recording path.
For changes to the native collector, also run its locked Rust workspace tests.

## Propose a change

- Open an issue with the problem and expected result. Include the revision and operating system.
- For capture issues, include the simulator, packet format, recording mode, and bridge version.
- Keep each pull request focused. Explain the result and the checks you ran.
- State what remains unverified. Separate parser tests, packet replays, and live game tests.
- Update the README and relevant app text when behavior or setup changes.
- Keep missing channels absent. Preserve measured values, source clocks, and source units.
- Use recordings that you have permission to share. Include their source and licence.
- Keep credentials, account data, and private recordings out of source, logs, fixtures, and public issues.

## Licence and conduct

Preserve third-party notices. State the source and licence of copied material.
State that you offer new original contributions under CC0 1.0.
Grant only rights that you own. Keep the applicable terms for third-party changes.
Read [LICENSING.md](LICENSING.md) for the repository's licence scope.

Use respectful, direct language.
Maintenance depends on contributor time. No response time or release date is promised.
Use [SECURITY.md](SECURITY.md) for sensitive reports.
