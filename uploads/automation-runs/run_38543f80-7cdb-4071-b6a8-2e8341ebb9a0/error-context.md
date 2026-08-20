# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 3b541345-ca69-46f3-bc7f-90e9441e2bab-run_38543f80-7cdb-4071-b6a8-2e8341ebb9a0.spec.ts >> Vérifier le champ "E-mail ou numéro de mobile"
- Location: 3b541345-ca69-46f3-bc7f-90e9441e2bab-run_38543f80-7cdb-4071-b6a8-2e8341ebb9a0.spec.ts:6:1

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  ["ErrorUtils caught an error:·
Error connecting to Credential Management service.·
Subsequent non-fatal errors won't be logged; see https://fburl.com/debugjs. {column: 180, clientTime: 1786669203, extra: Object, guardList: Array(0), hash: furix1}"]
```

# Page snapshot

```yaml
- generic [ref=e12]:
  - generic [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e17]:
        - img [ref=e20]
        - generic [ref=e24]: Explore the things you love.
      - img [ref=e25]
    - generic [ref=e35]:
      - generic [ref=e42]: Log into Facebook
      - generic [ref=e47]:
        - generic [ref=e51]:
          - textbox "Email or mobile number" [active] [ref=e52]
          - generic: Email or mobile number
        - generic [ref=e56]:
          - textbox "Password" [ref=e57]
          - generic: Password
        - button "Log In" [ref=e60] [cursor=pointer]:
          - generic [ref=e63]: Log in
        - link "Forgot password?" [ref=e66] [cursor=pointer]:
          - /url: /recover/initiate/?privacy_mutation_token=eyJ0eXBlIjo1LCJjcmVhdGlvbl90aW1lIjoxNzg2NjY5MjAwfQ%3D%3D&ars=facebook_login
          - generic [ref=e69]: Forgot password?
        - link "Create new account" [ref=e72] [cursor=pointer]:
          - /url: /reg/?entry_point=login&next=
          - generic [ref=e75]: Create new account
        - img "Meta logo" [ref=e77]
  - separator [ref=e85]
  - main [ref=e91]:
    - separator [ref=e93]
    - generic [ref=e98]:
      - generic [ref=e100]:
        - generic [ref=e102]: English (US)
        - link "Français (France)" [ref=e105] [cursor=pointer]:
          - /url: "#"
        - link "العربية" [ref=e108] [cursor=pointer]:
          - /url: "#"
        - link "Italiano" [ref=e111] [cursor=pointer]:
          - /url: "#"
        - link "Deutsch" [ref=e114] [cursor=pointer]:
          - /url: "#"
        - link "Español" [ref=e117] [cursor=pointer]:
          - /url: "#"
        - link "Русский" [ref=e120] [cursor=pointer]:
          - /url: "#"
        - link "More languages…" [ref=e123] [cursor=pointer]:
          - /url: "#"
      - generic [ref=e126]:
        - link "Sign Up" [ref=e129] [cursor=pointer]:
          - /url: https://www.facebook.com/reg/
        - link "Log In" [ref=e132] [cursor=pointer]:
          - /url: https://www.facebook.com/login/
        - link "Messenger" [ref=e135] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fmessenger.com%2F&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Facebook Lite" [ref=e138] [cursor=pointer]:
          - /url: https://www.facebook.com/lite/
        - link "Video" [ref=e141] [cursor=pointer]:
          - /url: https://www.facebook.com/watch/
        - link "Meta Pay" [ref=e144] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fabout.meta.com%2Ftechnologies%2Fmeta-pay&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Meta Store" [ref=e147] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2F&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Meta Quest" [ref=e150] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2Fquest%2F&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Ray-Ban Meta" [ref=e153] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2Fai-glasses%2Fray-ban-meta%2F&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Meta AI" [ref=e156] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.ai%2F&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Instagram" [ref=e159] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.instagram.com%2F&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Threads" [ref=e162] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.threads.com%2F&h=AUApeShu_Eooa1lsC6y9IY4l3Br2AtGRwIW7ePpD0vFISPH60w2kcrHNMvP844XLlnP-BGcyULxjUSJIivRZUL6zig9iL9xQ7j06eM1gseBsH55JkgIIMs7ekbwXcrTTJCqAixvg9lvSAnRkISetOg
        - link "Privacy Policy" [ref=e165] [cursor=pointer]:
          - /url: https://www.facebook.com/privacy/policy/?entry_point=facebook_page_footer
        - link "Privacy Center" [ref=e168] [cursor=pointer]:
          - /url: https://www.facebook.com/privacy/center/?entry_point=facebook_page_footer
        - link "About" [ref=e171] [cursor=pointer]:
          - /url: https://www.facebook.com/about/
        - link "Create ad" [ref=e174] [cursor=pointer]:
          - /url: https://www.facebook.com/ad_campaign/landing.php?placement=pflo&campaign_id=402047449186&nav_source=unknown&extra_1=auto
        - link "Create Page" [ref=e177] [cursor=pointer]:
          - /url: https://www.facebook.com/pages/create/?ref_type=site_footer
        - link "Developers" [ref=e180] [cursor=pointer]:
          - /url: https://developers.facebook.com/?ref=pf
        - link "Careers" [ref=e183] [cursor=pointer]:
          - /url: https://www.facebook.com/careers/?ref=pf
        - link "Cookies" [ref=e186] [cursor=pointer]:
          - /url: https://www.facebook.com/policies/cookies/
        - link "Ad choices" [ref=e189] [cursor=pointer]:
          - /url: https://www.facebook.com/help/568137493302217
          - text: Ad choices
        - link "Terms" [ref=e194] [cursor=pointer]:
          - /url: https://www.facebook.com/policies?ref=pf
        - link "Help" [ref=e197] [cursor=pointer]:
          - /url: https://www.facebook.com/help/?ref=pf
        - link "Contact Uploading & Non-Users" [ref=e200] [cursor=pointer]:
          - /url: https://www.facebook.com/help/637205020878504
      - generic [ref=e203]: Meta © 2026
```