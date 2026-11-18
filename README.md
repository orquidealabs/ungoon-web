# ungoon-web

Static pages for Ungoon (Orquidea Labs), published with GitHub Pages at
`https://orquidealabs.github.io/ungoon-web/`.

| Page | Purpose |
|------|---------|
| `reset-password.html` | Landing page of the password reset email. Opens the app on a phone, or lets the person choose the new password on the web (for example from a computer). |
| `verified.html` | Landing page of the email confirmation link. |

How it works: Supabase checks the link and redirects here with the answer after the `#`
(`access_token`, `refresh_token`, or an error). `app-link.js` reads it, clears it from the address
bar, and can pass it to the app through `ungoon://`.

- `config.js` holds the project URL and the **public** key (publishable/anon). It is meant to be in
  client code. Never put a service key here.
- `supabase-js` is loaded from jsDelivr with a pinned version and an integrity hash. When changing
  the version, recompute the hash (`openssl dgst -sha384 -binary <file> | openssl base64 -A`).
- The password rules in `reset-password.js` mirror the app and `supabase/config.toml` of the app
  repository (at least 8 characters, letters and numbers).
- Both pages must be allowed in the Supabase project's redirect URLs.

## Checking the pages

`tests/check-pages.js` runs the real scripts in jsdom with a fake Supabase client and checks every
state (expired link, form, weak password, success, phone, computer):

```
npm install --no-save jsdom
node tests/check-pages.js
```
