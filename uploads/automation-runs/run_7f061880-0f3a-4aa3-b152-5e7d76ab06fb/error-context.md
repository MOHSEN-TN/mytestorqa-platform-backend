# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 824adcfc-4800-4f33-b183-50eefd6e227f-run_7f061880-0f3a-4aa3-b152-5e7d76ab06fb.spec.ts >> Vérifier le champ "Mot de passe"
- Location: 824adcfc-4800-4f33-b183-50eefd6e227f-run_7f061880-0f3a-4aa3-b152-5e7d76ab06fb.spec.ts:6:1

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  ["ErrorUtils caught an error:·
Error connecting to Credential Management service.·
Subsequent non-fatal errors won't be logged; see https://fburl.com/debugjs. {column: 180, clientTime: 1784248267, extra: Object, guardList: Array(0), hash: fuwid1}"]
```

# Page snapshot

```yaml
- generic [ref=e12]:
  - generic [ref=e14]:
    - generic [ref=e17]:
      - img [ref=e20]
      - generic [ref=e24]: Explore the things you love.
    - generic [ref=e34]:
      - generic [ref=e36]:
        - generic [ref=e41]: Log into Facebook
        - button "Logged in on your phone? Scan a QR code" [ref=e44] [cursor=pointer]:
          - img [ref=e45]
      - generic [ref=e52]:
        - generic [ref=e56]:
          - textbox "Email or mobile number" [active] [ref=e57]
          - generic: Email or mobile number
        - generic [ref=e61]:
          - textbox "Password" [ref=e62]
          - generic: Password
        - button "Log In" [ref=e65] [cursor=pointer]:
          - generic [ref=e68]: Log in
        - link "Forgot password?" [ref=e71] [cursor=pointer]:
          - /url: /recover/initiate/?privacy_mutation_token=eyJ0eXBlIjo1LCJjcmVhdGlvbl90aW1lIjoxNzg0MjQ4MjY1fQ%3D%3D&ars=facebook_login
          - generic [ref=e74]: Forgot password?
        - link "Create new account" [ref=e77] [cursor=pointer]:
          - /url: /reg/?entry_point=login&next=
          - generic [ref=e80]: Create new account
        - img "Meta logo" [ref=e82]
  - separator [ref=e90]
  - main [ref=e96]:
    - separator [ref=e98]
    - generic [ref=e103]:
      - generic [ref=e105]:
        - generic [ref=e107]: English (US)
        - link "Français (France)" [ref=e110] [cursor=pointer]:
          - /url: "#"
        - link "العربية" [ref=e113] [cursor=pointer]:
          - /url: "#"
        - link "Italiano" [ref=e116] [cursor=pointer]:
          - /url: "#"
        - link "Deutsch" [ref=e119] [cursor=pointer]:
          - /url: "#"
        - link "Español" [ref=e122] [cursor=pointer]:
          - /url: "#"
        - link "Русский" [ref=e125] [cursor=pointer]:
          - /url: "#"
        - link "More languages…" [ref=e128] [cursor=pointer]:
          - /url: "#"
      - generic [ref=e131]:
        - link "Sign Up" [ref=e134] [cursor=pointer]:
          - /url: https://www.facebook.com/reg/
        - link "Log In" [ref=e137] [cursor=pointer]:
          - /url: https://www.facebook.com/login/
        - link "Messenger" [ref=e140] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fmessenger.com%2F&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Facebook Lite" [ref=e143] [cursor=pointer]:
          - /url: https://www.facebook.com/lite/
        - link "Video" [ref=e146] [cursor=pointer]:
          - /url: https://www.facebook.com/watch/
        - link "Meta Pay" [ref=e149] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fabout.meta.com%2Ftechnologies%2Fmeta-pay&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Meta Store" [ref=e152] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2F&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Meta Quest" [ref=e155] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2Fquest%2F&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Ray-Ban Meta" [ref=e158] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2Fai-glasses%2Fray-ban-meta%2F&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Meta AI" [ref=e161] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.ai%2F&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Instagram" [ref=e164] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.instagram.com%2F&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Threads" [ref=e167] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.threads.com%2F&h=AUCAda7Xkqhuud8Kpl3K7vQ0q3TlQDFk2CjTBWDfZznpGXaO5fRkHCEXJUX4tPR26f66JgvwMqotRiSTNKmjRMnsEFnI8clEVfr1JvgyFykHt6tv0D7b89uJlBgNQNxUCUxexzA1WT3HrQrqgFrgKQ
        - link "Privacy Policy" [ref=e170] [cursor=pointer]:
          - /url: https://www.facebook.com/privacy/policy/?entry_point=facebook_page_footer
        - link "Privacy Center" [ref=e173] [cursor=pointer]:
          - /url: https://www.facebook.com/privacy/center/?entry_point=facebook_page_footer
        - link "About" [ref=e176] [cursor=pointer]:
          - /url: https://www.facebook.com/about/
        - link "Create ad" [ref=e179] [cursor=pointer]:
          - /url: https://www.facebook.com/ad_campaign/landing.php?placement=pflo&campaign_id=402047449186&nav_source=unknown&extra_1=auto
        - link "Create Page" [ref=e182] [cursor=pointer]:
          - /url: https://www.facebook.com/pages/create/?ref_type=site_footer
        - link "Developers" [ref=e185] [cursor=pointer]:
          - /url: https://developers.facebook.com/?ref=pf
        - link "Careers" [ref=e188] [cursor=pointer]:
          - /url: https://www.facebook.com/careers/?ref=pf
        - link "Cookies" [ref=e191] [cursor=pointer]:
          - /url: https://www.facebook.com/policies/cookies/
        - link "Ad choices" [ref=e194] [cursor=pointer]:
          - /url: https://www.facebook.com/help/568137493302217
          - text: Ad choices
        - link "Terms" [ref=e199] [cursor=pointer]:
          - /url: https://www.facebook.com/policies?ref=pf
        - link "Help" [ref=e202] [cursor=pointer]:
          - /url: https://www.facebook.com/help/?ref=pf
        - link "Contact Uploading & Non-Users" [ref=e205] [cursor=pointer]:
          - /url: https://www.facebook.com/help/637205020878504
      - generic [ref=e208]: Meta © 2026
```