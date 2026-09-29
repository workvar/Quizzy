<!-- BEGIN awc-ui -->
## @awc-ui/core

This project uses **@awc-ui/core**, a Material Design 3 web component library.
Its full documentation is installed locally — read it, do not guess at APIs.

| Read this | For |
|---|---|
| `node_modules/.pnpm/@awc-ui+core@1.0.1/node_modules/@awc-ui/core/main-llm.md` | **Start here.** Match the task scope, choose components, and find relevant setup and recipes |
| `node_modules/.pnpm/@awc-ui+core@1.0.1/node_modules/@awc-ui/core/src/components/<tag>/readme.md` | One component: full API, accessibility contract, anti-patterns |

**Before writing markup for a component, open its manual** and read its
*When NOT to use* and *Anti-patterns* sections. They describe the mistakes
assistants actually make with this library.

Follow the user's task: reuse existing project decisions, ask only about
consequential missing choices for a new app, and keep reviews read-only unless
a fix is requested. A focused edit does not require a new interview or scaffold.

Rules that apply everywhere:

- Integration for **next**: Import '@awc-ui/core/css/tokens.css' once in the application stylesheet/entry. Use @awc-ui/react/server in Server Components and @awc-ui/react inside client boundaries. Do not use /define in a server module. Follow the Next.js starter configuration.
- **Arrays, objects and functions are properties, not attributes.** Assign them
  in JavaScript (`el.data = [...]`); as an attribute they stringify to nothing
  useful.
- **Never invent an API.** If a prop, event, slot or CSS part is not in that
  component's manual, it does not exist — do not infer one from a sibling.
- Every icon-only control needs an `aria-label`.
- Density rungs are `-1` through `-4`. `density="0"` is the default and is
  inert — it does NOT opt out of an inherited `data-density`; set
  `--md-sys-density-scale: 0` for that.
- Theme through `--md-sys-*` tokens and the documented `::part()` names. Do not
  reach into shadow DOM.
<!-- END awc-ui -->
