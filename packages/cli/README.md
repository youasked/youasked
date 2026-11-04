# youasked

Add YouAsked feature requests to your app in one command.

```sh
npx youasked init
```

It works out what you're running, creates an app for you, saves the keys to your env file (and git-ignores it), installs the right SDK and wires it in. Every file it touches is listed with what changed. If it can't edit something safely it prints the exact code to paste instead.

| Project | SDK | What `init` does |
|---|---|---|
| Next.js (app or pages router), Vite + React, Remix / React Router, Create React App | `@youasked/react` | Installs it and wraps your app |
| Expo / React Native | `@youasked/react-native` | Installs it, adds the provider, and prints where each entry point goes |
| Vue, Nuxt, Svelte, SvelteKit, Angular, Astro, plain Vite | `@youasked/js` | Installs it and prints the `init` call and elements for your framework |
| iOS (an `.xcodeproj` or `Package.swift`) | Swift package | Creates the app and prints the Swift Package and SwiftUI steps |
| Android (a Gradle build) | `com.github.youasked:youasked` | Creates the app and prints the Gradle and Compose steps |

## Commands

| | |
|---|---|
| `youasked init` | Set up this project. Asks for an app name and which entry points to add (floating launcher, ask bar, feature card, settings row, embedded page). |
| `youasked doctor` | Checks the env vars, the install and that the API accepts your keys. |
| `youasked open` | Prints your dashboard URL. |

Options for `init`: `--yes` (take every default, no questions), `--no-install`, `--key ya_pub_… --secret ya_sec_…` (reuse an app), `--api <url>`.

Running `init` again is safe: it reuses the keys it finds and skips edits that are already made.

`init` also offers to add a Claude Code skill at `.claude/skills/youasked/SKILL.md` and a short section in `AGENTS.md` if you have one, so your agent knows how to add entry points and ship requests ("closes YA-12"). Pair it with [`@youasked/mcp`](../mcp) to let the agent read the requests.
