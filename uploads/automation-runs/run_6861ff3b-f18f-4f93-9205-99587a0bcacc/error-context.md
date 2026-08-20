# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 43977754-e12c-40da-9adb-4ec53fb3dfd6-run_6861ff3b-f18f-4f93-9205-99587a0bcacc.spec.ts >> Exécution d'une recherche via le champ de recherche
- Location: 43977754-e12c-40da-9adb-4ec53fb3dfd6-run_6861ff3b-f18f-4f93-9205-99587a0bcacc.spec.ts:6:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('body')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('body')
    18 × locator resolved to <body dir="ltr" rounded-container="">…</body>
       - unexpected value "hidden"

```

```yaml
- banner:
  - button "Guide"
  - link "YouTube Home":
    - /url: /
  - text: TN
  - button "Skip navigation"
  - search:
    - combobox "Search" [expanded]
    - button "Search"
  - button "Search with your voice"
  - tooltip "tooltip"
  - button "Settings"
  - link "Sign in":
    - /url: https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3Dhttps%253A%252F%252Fwww.youtube.com%252F&hl=en&ec=65620
- navigation:
  - link "Home":
    - /url: /
  - link "Shorts":
    - /url: /shorts/
  - link "Subscriptions":
    - /url: /feed/subscriptions
  - link "You":
    - /url: /feed/you
- main:
  - heading "Try searching to get started" [level=2]
  - text: Start watching videos to help us build a feed of videos you'll love.
```