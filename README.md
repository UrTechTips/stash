 # Stash

Stash is a personal money manager for iOS, Android, and the web. It answers two practical questions: **how much can I safely spend today?** and **is this purchase safe right now?**

Stash is built with Expo, React Native, TypeScript, Expo Router, and a local SQLite database. Your financial data is stored on the device rather than in a hosted service.

## Why Stash

- **Safe-to-spend number:** calculates today's available allowance after accounting for the monthly budget, spending, upcoming recurring bills, and the user's safety buffer.
- **Purchase verdicts:** evaluates goals with explainable checks and labels such as `Buy now`, `Almost there`, `Keep saving`, and `Don't buy`.
- **Goals and earmarks:** save toward wants, set money aside across accounts, and see how a purchase affects other goals.
- **Budgeting and transactions:** manage accounts, categories, income, expenses, transfers, and monthly category limits.
- **Recurring activity:** schedule recurring income and expenses and receive reminders for upcoming bills.
- **Insights:** review saving rate, income versus spending, category trends, and top places for discretionary spending.
- **Private by default:** data lives in an app-private SQLite database. Optional biometric or device-PIN app locking is available.
- **Portable data:** export a JSON backup or transaction CSV, import a JSON backup, and share backups through the platform share sheet.

## Getting Started

### Prerequisites

- Node.js LTS and npm
- Android Studio, an Android SDK, and an emulator or connected device for Android development
- macOS and Xcode for iOS development
- A browser for the web target

Install dependencies from the repository root:

```bash
npm install
```

Start the Expo development server:

```bash
npm run start
```

Then choose a target from the Expo CLI, or use one of the platform commands:

```bash
npm run android  # Build and run the native Android app
npm run ios      # Build and run the native iOS app (macOS only)
npm run web      # Start the web version
```

On first launch, complete onboarding by entering the information Stash uses to calculate allowances, then add an account, budget, and transaction. The main tabs provide the daily allowance, activity, accounts, budget, goals, and related settings.

### Production builds

The repository includes EAS build profiles for development, internal preview APKs, and production builds. With the EAS CLI authenticated and configured for the project, use:

```bash
npx eas build --profile development
npx eas build --profile preview
npx eas build --profile production
```

The preview profile produces an Android APK for internal distribution. See [eas.json](eas.json) for the complete profile configuration.

## Development

Useful checks before opening a pull request:

```bash
npm run lint       # Expo ESLint configuration
npm run typecheck  # TypeScript, without emitting files
npm test           # Vitest unit and service tests
npm run test:ui    # Jest and React Native render tests
```

The main application routes are in [src/app](src/app). Core financial calculations live in [src/engine](src/engine), persistence is in [src/db](src/db), and reusable UI is in [src/components](src/components). Tests are colocated with the relevant modules, with broader app flows covered in [src/__tests__](src/__tests__) and service acceptance tests in [src/services](src/services).

### Data and backups

Stash creates and migrates its local database on startup. Before a schema migration, it writes an automatic backup to the app's private documents storage. Users can also use **Settings** to export JSON or CSV data and import a JSON backup.

Treat exported files as sensitive financial data. Do not commit personal backups, credentials, or local configuration to the repository.

## Support

Start with the source and tests linked above, especially the engine and service tests, which document the allowance and purchase-verdict rules. For project-specific help, open an issue in the repository hosting service with:

- the platform and OS version;
- the Stash and Expo versions;
- reproduction steps;
- relevant logs with personal financial data removed.

For native build problems, also include the output of the relevant Expo command and your Android Studio or Xcode version.

## Contributing

Stash does not currently include a separate contribution guide. To contribute:

1. Create a focused branch from the current default branch.
2. Make the smallest change that addresses the issue and add or update tests for behavior changes.
3. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:ui` as applicable.
4. Open a pull request describing the behavior change, test coverage, and any platform-specific considerations.

Keep financial calculations deterministic and explainable, preserve local data compatibility, and avoid including real account or transaction data in fixtures, screenshots, or logs.

## Maintainer

Stash is maintained by the project owner. No public maintainer contact or project hosting URL is configured in this checkout; use the repository's hosting service and issue tracker when one is available.

## License

Stash is distributed under the [MIT License](LICENSE).
