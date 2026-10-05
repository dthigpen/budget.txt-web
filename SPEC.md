# budget.txt Web Specification

## Overview

This project is a browser UI for the plain-text `budget.txt` household budgeting format. The app treats the file as the source of truth, while the browser interface makes it easier to inspect, edit, and reason about budgets.

The goal is not to replace the plain text file with a database or proprietary schema. Instead, the app reads and writes a text document that remains readable by humans, tools, scripts, and other compatible software.

## Format model

The underlying format is envelope-based budgeting.

A file may contain:

- `!options` declarations
- dated records such as `allocate`, `spend`, `move`, `deallocate`, `envelope`, and `note`
- optional metadata or extension fields in keyword arguments

The core meaning is intentionally simple:

- an envelope defines a budget category
- allocations add money to an envelope
- spending removes money from an envelope
- movement transfers value between categories
- reports derive current balances from the event stream

## Supported operations

### Envelope definition

```text
2026-09-01 envelope groceries budget=500
```

This declares an envelope named `groceries` with a target budget of 500.

### Allocation

```text
2026-09-02 allocate 250 groceries
```

Adds 250 to the `groceries` envelope.

### Spending

```text
2026-09-03 spend 42.18 groceries account=mastercard merchant="Target"
```

Subtracts 42.18 from `groceries` and records optional context such as account and merchant.

### Moving money

```text
2026-09-08 move 50 groceries dining
```

Transfers 50 from `groceries` to `dining`.

### Deallocation

```text
2026-09-25 deallocate 80 groceries
```

Removes money from the envelope and returns it outside the budgeting model.

## App behavior

The browser app supports the following user-facing features:

- local-first editing of a `budget.txt` document in browser storage
- envelope summary cards showing budget and available balance
- transaction entry for allocation, spending, and moving values
- raw text editing for direct compatibility with the spec
- optional login to Plain File Server for remote file access
- read/write operations against a server file path using the API's ETag model

## Server integration

This app can optionally read and write a remote file using Plain File Server.

The server API is used as a file transport layer only. The app is responsible for understanding the budget semantics in the file itself. The server does not interpret or enforce envelope meaning; it simply provides safe, versioned file access.

## Compatibility requirements

The app must preserve the plain-text file as the canonical source of truth. It should never silently rewrite or reinterpret the data beyond normal budget.txt syntax. It should allow direct editing and keep the format understandable in a plain editor.

## Future extensions

The app can add richer reporting features later, such as:

- monthly summaries and category rollups
- CSV export for spreadsheets
- category filters and trend charts
- import of bank or card data
- server conflict resolution for multiple concurrent edits

The core format remains the anchoring layer that keeps the app portable and interoperable.
