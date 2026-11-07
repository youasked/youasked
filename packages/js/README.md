# @youasked/js

In-app feature requests for any website: plain HTML, Vue, Svelte, Angular, Nuxt, Astro, Webflow, Framer, WordPress and anything else that runs JavaScript. People ask and vote without leaving your site, you hear about it in Telegram, Slack or Discord, and when you ship, everyone who asked is told right where they asked.

It's the same widget as `@youasked/react`, bundled with Preact so your site doesn't need React. About 46 KB gzipped.

Using React or Next.js? Use [`@youasked/react`](https://www.npmjs.com/package/@youasked/react). React Native or Expo? [`@youasked/react-native`](https://www.npmjs.com/package/@youasked/react-native).

## A script tag (no build step)

```html
<script
  src="https://cdn.jsdelivr.net/npm/@youasked/js"
  data-app-key="ya_pub_…"
  data-label="Ask us"
  defer
></script>
```

That adds the launcher in the corner. The tag also takes:

| Attribute | |
|---|---|
| `data-accent`, `data-mode` (`auto`, `light`, `dark`), `data-radius`, `data-button-radius` (a number or `pill`), `data-font` | Appearance |
| `data-trigger="none"` | No corner launcher, for when you use the elements or your own buttons |
| `data-position="bottom-left"` | Launcher on the left |
| `data-offset="80"` | Lifts the launcher, the in-app cards and the "Show us" bar above a bottom bar |
| `data-nudge="off"` | Turns the occasional "Got an idea?" prompt off on this page |
| `data-wait-for-user` | Waits for `YouAsked.identify(…)` before doing anything |
| `data-demo` | Sample data and no network, for trying it out |

## npm (Vue, Svelte, Angular, Nuxt, Astro…)

```sh
npm install @youasked/js
```

```js
import { init, identify, open } from "@youasked/js";

init({ appKey: "ya_pub_…", label: "Ask us" });

// When someone signs in. The signature is made on your server (see below).
identify({ id: user.id, name: user.firstName }, signatureFromYourServer);

// From any button.
open();                    // the home screen
open({ topic: "charts" }); // "What would make charts better?"
open({ view: "board" });   // the full list
```

Call `init` once, in the browser (in Nuxt or SvelteKit, inside `onMounted` / `onMount`). `update({...})` changes options later, for example when your site switches to dark mode, and `destroy()` removes it.

### Vue

```vue
<script setup>
import { onMounted } from "vue";
import { init, open } from "@youasked/js";
onMounted(() => init({ appKey: "ya_pub_…", trigger: "none" }));
</script>

<template>
  <button @click="open()">Request a feature</button>
  <youasked-feature-card limit="3" />
</template>
```

Tell Vue the `youasked-` tags are custom elements: `compilerOptions.isCustomElement = (tag) => tag.startsWith("youasked-")`.

### Svelte

```svelte
<script>
  import { onMount } from "svelte";
  import { init, open } from "@youasked/js";
  onMount(() => init({ appKey: "ya_pub_…" }));
</script>

<button on:click={() => open()}>Request a feature</button>
<youasked-ask-bar />
```

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the component that uses the elements, and call `init(...)` in `ngOnInit`.

## Elements

Put these anywhere on the page. They're the real components, they take your appearance, and they all open the same sheet.

```html
<youasked-ask-bar placeholder="Ask for a feature…"></youasked-ask-bar>
<youasked-feature-card limit="3"></youasked-feature-card>
<youasked-request-button variant="row"></youasked-request-button>   <!-- or "pill", "icon" -->
<youasked-ask-about topic="charts" prompt="Want more from charts?"></youasked-ask-about>
<youasked-board start="board" height="640px"></youasked-board>
```

No-code builders (Webflow, Framer, WordPress): any link or button with `data-youasked-open` opens the sheet. Add `data-youasked-topic="charts"` or `data-youasked-draft="Export to Excel"` if you like.

```html
<a href="#" data-youasked-open>Request a feature</a>
```

## Who's asking

Anonymous visitors can ask and vote. To link requests to your accounts (so people are told when what they asked for ships, wherever they sign in), pass the user and a signature from your server:

```js
// your server, Node
import { createHmac } from "node:crypto";
const signature = createHmac("sha256", process.env.YOUASKED_SECRET_KEY).update(String(user.id)).digest("hex");
```

Never put the secret key in the browser. `email` and `name` are optional; only send them if you're happy for your team to see them.

## Appearance

It picks up shadcn-style CSS variables (`--primary`, `--background`, `--radius`) on its own. Otherwise:

```js
init({
  appKey: "ya_pub_…",
  appearance: {
    accent: "#2b4bee",
    mode: "auto",          // follows a .dark class or data-theme on the page
    radius: 16,            // cards, rows and the sheet
    buttonRadius: "pill",  // buttons, the ask bar, the composer and chips
    fontFamily: "inherit",
  },
});
```

## Free while you build

On localhost it runs in test mode for free: up to 25 people. On your live site it needs a plan. See [youasked.dev/pricing](https://youasked.dev/pricing).

MIT licensed.
