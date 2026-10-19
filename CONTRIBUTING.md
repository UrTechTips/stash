# Contributing to Stash

First off, thank you for considering contributing to Stash! 

## Development Workflow

1. **Fork & Branch:** Create a focused branch from the current default branch (`main` or `master`).
2. **Make Changes:** Make the smallest change that addresses the issue. 
3. **Test:** Add or update tests for any behavior changes. Keep financial calculations deterministic and explainable.
4. **Verify:** Run the following checks locally before pushing:
   - `npm run lint` (Expo ESLint configuration)
   - `npm run typecheck` (TypeScript, without emitting files)
   - `npm test` (Vitest unit and service tests)
   - `npm run test:ui` (Jest and React Native render tests)

## Important Rules for Financial Data
* **Local Data Compatibility:** Ensure any changes to `src/db` include proper schema migrations. Do not break existing local databases.
* **Privacy:** Avoid including real account, transaction data, or personal backups in fixtures, screenshots, logs, or git commits.

## Project Structure
* `src/app`: Main application routes (Expo Router)
* `src/engine`: Core financial calculations (allowance and purchase-verdict rules)
* `src/db`: Local SQLite database and persistence
* `src/components`: Reusable UI components