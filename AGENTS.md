This repository uses explicit execution rules intended to reduce unnecessary model/tool cycles, repeated cached-context processing, and avoidable Codex-credit usage while preserving investigation quality.

These rules are based on repeated controlled tests in which explicit Code Mode batching reduced model/tool cycles, raw token use, cached-input processing, and weighted Codex usage. The central goal is not to do less work. The goal is to perform independent work within the same bounded stage before returning to the model.

## Mandatory tested batching instruction

The following paragraph is the exact instruction reported by the tester to produce the most consistent results. Preserve it exactly unless a newer controlled test demonstrates a better replacement.

> In Code Mode, within each bounded stage, run independent, functions.exec-available tool calls concurrently in one functions.exec call. Use await Promise.allSettled([...]) when partial results are useful, and inspect every result; use await Promise.all([...]) only when any failure should abort the batch. Keep dependencies, waits/resumes, approvals, conflicting or interdependent mutations, and adaptive investigations where each result may change the next step sequential. Do not split otherwise batchable inspections across outer tool calls.

## Primary objective

Complete each task with the fewest necessary model/tool cycles without skipping required work, weakening validation, hiding failures, or reducing correctness.

Optimize for:

- fewer returns to the model between independent operations;
- fewer repeated passes over the same accumulated context;
- complete inspection of all batched results;
- targeted implementation;
- targeted validation during development;
- one broader validation pass at the end when required.

Do not optimize by silently omitting inspections, reducing required coverage, shortening useful reports, or avoiding necessary tests.

## Required execution workflow

Follow this workflow for every non-trivial repository task.

### 1. Define the bounded stage

Before calling tools, identify the current bounded stage. Typical stages are:

1. repository discovery;
2. focused investigation;
3. implementation;
4. targeted validation;
5. final broader validation;
6. final reporting.

A bounded stage is a group of operations whose scope and purpose are already known before execution.

Do not mix unrelated goals into one stage merely to increase concurrency.

### 2. List the known operations for the stage

Before execution, determine which operations are already known and which operations depend on unseen results.

Examples of known operations:

- reading several already-identified source files;
- searching for several known symbols or configuration keys;
- checking multiple independent directories;
- running independent read-only diagnostic commands;
- inspecting several test files related to the same feature;
- gathering status information from unrelated subsystems;
- running independent linters or test groups when they do not mutate shared state.

Examples of result-dependent operations:

- deciding the next file only after inspecting the previous file;
- choosing a fix based on a test failure;
- tracing a call chain whose next symbol is not yet known;
- selecting a migration action after inspecting database state;
- deciding whether to edit a file based on another command's result.

### 3. Classify operations as concurrent or sequential

Batch an operation only when all of the following are true:

- it is independent of the other operations in the batch;
- its inputs are already known;
- it does not require the result of another operation in the same stage;
- it will not conflict with another operation;
- it does not require a separate approval or user decision;
- running it concurrently will not create unsafe or ambiguous state;
- every result can be inspected after the batch completes.

Keep an operation sequential when any of the following apply:

- one result determines the next action;
- execution order is required;
- one command produces input for another;
- operations mutate the same file, resource, database, process, or environment;
- operations may race or overwrite one another;
- an approval, wait, resume, or interactive step is required;
- a failure must immediately prevent the remaining operations;
- the investigation is adaptive and the next step cannot be selected safely in advance.

### 4. Execute independent operations in one Code Mode stage

For independent functions.exec-available operations, use one functions.exec call and run the nested calls concurrently.

Use this pattern when partial results remain useful:

```javascript
const results = await Promise.allSettled([
  // independent operation 1
  // independent operation 2
  // independent operation 3
]);
```

After `Promise.allSettled`, inspect every fulfilled and rejected result. Do not ignore rejected operations merely because the rest of the batch succeeded.

Use this pattern only when any failure should abort the entire batch:

```javascript
const results = await Promise.all([
  // independent operation 1
  // independent operation 2
  // independent operation 3
]);
```

Do not use `Promise.all` merely because it is shorter. Use it only when continuing after any individual failure would make the batch invalid or unsafe.

### 5. Do not fake batching

The following does not count as effective batching:

- placing one nested tool call inside a `Promise.allSettled` array;
- creating several separate outer tool calls that each contain one operation;
- grouping operations syntactically while still returning to the model between them;
- batching unrelated work with no shared bounded-stage purpose;
- launching a very broad speculative batch before defining scope;
- creating so much output that the next model call must process unnecessary data.

A valid batch should contain multiple genuinely independent operations that would otherwise have required separate model/tool cycles.

### 6. Inspect every result before deciding the next stage

After a concurrent stage finishes:

- inspect every result;
- record failures and incomplete outputs;
- distinguish command failure from an empty but valid result;
- verify that expected files, searches, or checks were actually covered;
- do not claim an operation succeeded without reading its result;
- do not rerun successful operations unless their inputs changed or the result was incomplete;
- use the combined results to plan the next bounded stage.

Do not return to the model after each nested result. Return only after the stage results are available and ready to be interpreted together.

## Repository discovery rules

### Perform one broad but bounded discovery pass

At the beginning of a task, identify likely relevant areas and inspect them together where possible.

A discovery pass may include:

- repository structure;
- relevant `AGENTS.md` files;
- package and build configuration;
- likely implementation files;
- related tests;
- type definitions;
- call sites;
- configuration and environment references;
- recent errors supplied by the user.

Do not search the entire repository without a reason. Start from the task, known paths, symbols, errors, and architecture.

### Batch independent reads and searches

When several paths or symbols are already known, inspect them in one bounded stage instead of this pattern:

1. read one file;
2. return to the model;
3. read the next file;
4. return again;
5. search one symbol;
6. return again.

Prefer:

1. identify all immediately relevant files and symbols;
2. read and search them concurrently where independent;
3. inspect all results;
4. decide the next adaptive step.

### Avoid repeated reads

Do not reopen unchanged files unless:

- the previous output was truncated or incomplete;
- another result identified a specific section that now requires closer inspection;
- the file changed during implementation;
- validation indicates the earlier understanding was incorrect;
- a final review of the edited region is required.

Keep track of files already inspected during the task.

### Limit discovery output

Use targeted ranges, searches, filters, and concise command output where possible.

Avoid loading:

- generated files;
- dependency directories;
- build artifacts;
- large logs unrelated to the reported failure;
- lockfiles unless dependency resolution is relevant;
- binary files;
- minified files;
- coverage output;
- caches;
- unrelated historical data.

## Investigation rules

### Separate fixed inspections from adaptive investigation

Run fixed, already-known inspections concurrently.

Keep the adaptive portion sequential when each result determines the next question.

Example:

- Concurrent: read the service, controller, schema, and related tests already identified.
- Sequential: follow a newly discovered function call into an unknown module, inspect its result, then decide where to trace next.

Do not force an adaptive trace into a large speculative batch.

### Preserve quality and coverage

Batching must not reduce investigation quality.

For every requested investigation area:

- confirm it was inspected;
- record evidence supporting conclusions;
- distinguish verified facts from inferences;
- mention unresolved uncertainty;
- do not omit a required area merely because it was inconvenient to batch.

### Avoid redundant diagnostics

Do not run multiple commands that provide the same information unless cross-checking is necessary.

Do not rerun an unchanged failing command. Before retrying, change at least one relevant factor, such as:

- code;
- configuration;
- environment;
- command arguments;
- working directory;
- dependency state;
- test selection.

## Implementation rules

### Plan after discovery, then edit

Do not begin broad edits before the relevant discovery stage is complete.

After discovery:

1. identify the root cause or implementation gap;
2. define the smallest correct change set;
3. identify files that can be edited independently;
4. identify edits that overlap or depend on one another;
5. execute only safe independent mutations concurrently;
6. keep conflicting or dependent mutations sequential.

### Treat mutations more conservatively than reads

Read-only inspections are usually safer to batch than mutations.

Keep mutations sequential when they:

- touch the same file;
- touch tightly coupled generated outputs;
- depend on prior edits;
- update shared configuration;
- modify database state;
- restart shared processes;
- affect the same lockfile or dependency graph;
- can produce merge or ordering conflicts.

Do not batch mutations solely to reduce tool cycles.

### Avoid unrelated changes

Do not expand the task into unrelated cleanup, renaming, refactoring, dependency upgrades, comment rewriting, formatting changes, or architecture changes unless required for correctness or explicitly requested.

A smaller, focused change set reduces both risk and repeated context processing.

### Do not pause unnecessarily

When the user has requested a complete implementation and no approval is required, continue through:

1. investigation;
2. implementation;
3. targeted validation;
4. final validation;
5. report.

Do not stop after each phase to ask for permission unless:

- a destructive action requires confirmation;
- essential information is missing;
- multiple materially different product decisions exist;
- credentials or external access are required;
- continuing would be unsafe.

## Validation rules

### Run the narrowest relevant checks first

After editing, run targeted checks related to the changed area.

Examples:

- one affected test file;
- one package's type check;
- one focused lint command;
- one affected integration test;
- one build target;
- one reproduction command.

Batch independent targeted checks in one bounded validation stage when they do not mutate shared state or depend on one another.

### Run broader checks once at the end

After targeted checks pass, run the required broader validation once.

Examples:

- full test suite;
- full type check;
- full lint;
- production build;
- integration suite.

Do not repeatedly run the full suite after every individual edit unless the repository or task requires it.

### Handle failures deliberately

When validation fails:

1. inspect the complete relevant failure output;
2. determine whether the failure is caused by the change, the environment, or a pre-existing issue;
3. choose one targeted correction;
4. apply the correction;
5. rerun the narrowest affected check;
6. rerun broader validation only after the targeted failure is resolved.

After two unsuccessful approaches to the same blocker, stop speculative retries and report:

- what failed;
- what was attempted;
- the evidence collected;
- the most likely cause;
- what information or access is needed next.

## Context and session-efficiency rules

### Keep context relevant

Do not pull unrelated repository content into the session.

Prefer:

- known paths;
- exact symbols;
- targeted searches;
- concise command output;
- focused diffs;
- relevant test failures.

Avoid pasting or reading huge outputs when a filtered form is sufficient.

### Do not repeat information already established

Do not repeatedly restate the full task, repository structure, or previous findings during internal execution.

Carry forward only the details necessary for the next stage.

### Use fresh task boundaries

Treat unrelated user requests as separate tasks. Do not reuse an old investigation path merely because it exists in session history.

When a task is complete, report completion clearly instead of continuing optional exploration.

## Subagent and multi-agent rules

Use a single agent by default.

Do not create subagents for:

- one bug fix;
- one focused feature;
- one file review;
- one bounded investigation;
- routine test failures;
- work that depends heavily on shared context.

Use subagents only when the task contains genuinely independent, substantial workstreams that can be completed without duplicating repository discovery or repeatedly carrying the same large context.

If subagents are used:

- give each a distinct non-overlapping scope;
- avoid having every subagent inspect the entire repository;
- prevent overlapping mutations;
- collect their outputs once;
- reconcile results in one integration stage;
- validate the integrated result.

## Permissions, waits, and interactive operations

Keep the following sequential:

- approval requests;
- permission escalations;
- authentication steps;
- interactive prompts;
- long-running commands that require later resume;
- operations that wait for an external condition;
- commands requiring user-provided secrets or decisions.

Do not place an operation into a concurrent batch when it may pause the entire batch awaiting interaction.

## Failure handling for concurrent batches

When using `Promise.allSettled`:

1. inspect every item;
2. associate each result with its original operation;
3. report or handle every rejection;
4. retain useful successful results;
5. retry only rejected operations whose retry conditions have changed;
6. do not rerun the entire successful batch because one operation failed.

When using `Promise.all`:

1. use it only when one failure invalidates the whole batch;
2. understand that later results may not be available after rejection;
3. avoid it when partial inspection data would still be useful;
4. do not use it for broad discovery unless every result is mandatory before any conclusion can be formed.

## Examples

### Good: batched read-only discovery

Known relevant files:

- `src/auth/session.ts`
- `src/auth/middleware.ts`
- `src/app/api/login/route.ts`
- `tests/auth/session.test.ts`

Read and search these in one bounded stage because their paths are already known and none depends on the contents of another merely to be opened.

### Good: mixed concurrent and sequential investigation

1. Concurrently inspect the service, controller, tests, and configuration already linked to the failure.
2. Inspect all results.
3. Discover that the service calls an unexpected adapter.
4. Sequentially inspect that adapter because its relevance was learned from the first stage.
5. Decide the fix.

### Bad: sequential independent reads

1. Read service file.
2. Return to model.
3. Read controller file.
4. Return to model.
5. Read test file.
6. Return to model.

This creates avoidable model/tool cycles.

### Bad: unsafe concurrent mutation

Do not concurrently edit the same configuration file from multiple nested calls.

Do not concurrently run two dependency installers that modify the same lockfile.

Do not concurrently apply database migrations whose order matters.

### Bad: superficial Promise batching

```javascript
await Promise.allSettled([
  tools.readFile({ path: "src/a.ts" })
]);
```

A one-item array does not reduce model/tool cycles.

### Good: partial-result discovery

```javascript
const results = await Promise.allSettled([
  tools.readFile({ path: "src/a.ts" }),
  tools.readFile({ path: "src/b.ts" }),
  tools.search({ query: "createSession" }),
  tools.search({ query: "SESSION_SECRET" })
]);

for (const result of results) {
  // Inspect fulfilled and rejected results.
}
```

### Good: failure-aborts-all validation

Use `Promise.all` only when every validation result is required and any one failure makes the stage unusable.

```javascript
const results = await Promise.all([
  runRequiredSchemaCheck(),
  runRequiredGeneratedCodeCheck()
]);
```

## Final completion report

At the end of the task, report:

1. the root cause or objective completed;
2. the files changed;
3. the important implementation decisions;
4. the targeted checks run and their results;
5. the broader checks run and their results;
6. any checks not run and the reason;
7. any remaining risk, uncertainty, or follow-up requirement.

Keep the report factual. Do not claim success when required checks failed or were not run.

## Non-negotiable summary

- Use the exact mandatory batching instruction above.
- Batch genuinely independent functions.exec-available operations inside one functions.exec call.
- Prefer `Promise.allSettled` when partial results are useful, and inspect every result.
- Use `Promise.all` only when any failure must abort the batch.
- Keep dependencies, approvals, waits, adaptive steps, and conflicting mutations sequential.
- Do not split otherwise batchable inspections across outer tool calls.
- Do not fake batching with one-item arrays or separate outer calls.
- Perform broad but bounded discovery once.
- Avoid reopening unchanged files.
- Run targeted validation first and broader validation once at the end.
- Do not repeat unchanged failing commands.
- Use one agent by default.
- Preserve quality, coverage, and correctness; the objective is fewer cycles, not less work.

## Output-bounded batching

Before launching a concurrent batch, consider the combined output volume.

- Use targeted file ranges, exact searches, filters, and concise command flags.
- Do not batch several commands that may each return very large outputs.
- Split a batch when its combined results may exceed the available tool-output
  or history budget.
- Prefer summaries, counts, filenames, and matching lines over complete logs or
  unrestricted directory dumps.
- Avoid tool-catalogue dumps and broad recursive output unless directly needed.
- If output is truncated, do not assume missing sections succeeded or contained
  no relevant evidence. Rerun only the affected operation with narrower output.
- Optimize the number of model round trips without producing oversized,
  low-signal tool responses.

## Rules
- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.