# budget.txt Web

A local-first, installable web app for envelope budgeting with the plain-text `budget.txt` format. It lets you track envelopes, allocations, spending, and transfers in a readable file while staying compatible with plain text workflows and optional Plain File Server storage.

## What it does

This project turns the `budget.txt` spec into a lightweight browser UI. You can:

- define envelopes and budget targets
- record allocate, spend, move, and deallocate events
- edit the underlying `.txt` file directly in the app
- keep a local browser copy with instant saves
- optionally connect to a Plain File Server instance and read/write remote budget files
- install the app as a PWA and use it like a desktop/mobile app

## Why this app exists

The format is intentionally plain and open, but a file alone is not always convenient to work with. budget.txt Web gives you a friendly interface for the same source-of-truth file without taking away its portability or interoperability.

The app stays aligned with the design principles of the spec:

- plain text remains the source of truth
- data is easy to inspect, edit, and version
- the app does not lock you into a proprietary storage model
- server sync is optional and path-based

## Quick start

Requires Node.js 20.19 or newer.

```sh
npm install
npm run dev
```

Then open the local Vite URL in a browser.

## Using the app

### Local mode

The app starts with a sample `budget.txt` document in the browser. You can:

- add new envelopes with target budgets
- add allocation or spend events
- move money between envelopes
- edit the raw file in a textarea
- save the document in browser storage

### Plain File Server mode

Enter your server API base and login credentials. The app then:

- lists accessible files from the server
- opens a remote path into the current document
- writes the current document back using the server's conditional write API

This keeps the app compatible with the server's ETag-based conflict detection and remote file permissions.

## Project status

This is a small, working foundation for a `budget.txt` web client. It focuses on the core model and local-first file editing, with optional server connectivity and PWA support. The design is intentionally simple and extensible so it can grow toward richer reporting, import/export tooling, and more advanced budget analysis.

## Learn more

- See [SPEC.md](SPEC.md) for the file format and app behavior.
- See the [budget.txt repository](https://github.com/dthigpen/budget.txt) for the underlying format specification.
- See [Plain File Server](https://github.com/dthigpen/plain-file-server) for the optional remote file backend.
