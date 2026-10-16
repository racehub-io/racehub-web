# RaceHub Web

RaceHub Web is free software maintained by the community.
All existing features are available without payment or an access approval.

## Local use

- Run `yarn install --frozen-lockfile` and `yarn start`.
- Open `/analyser`. No account or cloud settings are needed.
- Start the legacy RaceHub client on the same computer. This app connects to `ws://localhost:8081`.
- Local recorder controls need that client. The saved-session explorer still needs cloud storage.

## Optional cloud features

Accounts use Firebase Authentication. Saved sessions use Firestore and Firebase Storage.
Configure your own project and protect user data with access rules.
Cloud hosting and storage costs depend on your provider.

Set `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`,
`REACT_APP_FIREBASE_PROJECT_ID`, `REACT_APP_FIREBASE_STORAGE_BUCKET`,
`REACT_APP_FIREBASE_MESSAGING_SENDER_ID`, and `REACT_APP_FIREBASE_APP_ID`
for your Firebase project. Set `REACT_APP_FIREBASE_DATABASE_URL` and
`REACT_APP_FIREBASE_MEASUREMENT_ID` if your project uses them.

Set `REACT_APP_CLIENT_DOWNLOAD_URL` to an approved public installer URL.
The download link stays hidden when its URL is absent.
React includes these values in the browser bundle. Do not use server secrets.

The source export excludes the cover video and deployment workflows.
Configure storage access rules and CORS for your own web origin.

## Community maintenance

Report bugs and propose changes through GitHub issues and pull requests.
Read the [contribution guide](CONTRIBUTING.md), [security policy](SECURITY.md),
and [licensing notes](LICENSING.md). Third-party code keeps its existing licences.
There is no payment service or paid feature tier.

Use the Yarn lockfile for reproducible installs. The legacy build scripts enable
the OpenSSL compatibility option that Webpack 4 needs on current Node.js.
