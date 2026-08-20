# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 7a900640-4e1c-4749-ba23-6c8cea06a79a-run_294a4615-51d4-4ae4-9726-58ffbd79c824.spec.ts >> Vérifier le chargement de la page "Facebook"
- Location: 7a900640-4e1c-4749-ba23-6c8cea06a79a-run_294a4615-51d4-4ae4-9726-58ffbd79c824.spec.ts:6:1

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  ["ErrorUtils caught an error:·
Error connecting to Credential Management service.·
Subsequent non-fatal errors won't be logged; see https://fburl.com/debugjs. {column: 180, clientTime: 1784248281, extra: Object, guardList: Array(0), hash: fuwid1}"]
```

# Page snapshot

```yaml
- generic [ref=e12]:
  - generic [ref=e14]:
    - generic [ref=e17]:
      - img [ref=e20]
      - generic [ref=e24]: Explore the things you love.
    - generic [ref=e34]:
      - generic [ref=e41]: Log into Facebook
      - generic [ref=e46]:
        - generic [ref=e50]:
          - textbox "Email or mobile number" [active] [ref=e51]
          - generic: Email or mobile number
        - generic [ref=e55]:
          - textbox "Password" [ref=e56]
          - generic: Password
        - button "Log In" [ref=e59] [cursor=pointer]:
          - generic [ref=e62]: Log in
        - link "Forgot password?" [ref=e65] [cursor=pointer]:
          - /url: /recover/initiate/?privacy_mutation_token=eyJ0eXBlIjo1LCJjcmVhdGlvbl90aW1lIjoxNzg0MjQ4MjgwfQ%3D%3D&ars=facebook_login
          - generic [ref=e68]: Forgot password?
        - link "Create new account" [ref=e71] [cursor=pointer]:
          - /url: /reg/?entry_point=login&next=
          - generic [ref=e74]: Create new account
        - img "Meta logo" [ref=e76]
  - separator [ref=e84]
  - main [ref=e90]:
    - separator [ref=e92]
    - generic [ref=e97]:
      - generic [ref=e99]:
        - generic [ref=e101]: English (US)
        - link "Français (France)" [ref=e104] [cursor=pointer]:
          - /url: "#"
        - link "العربية" [ref=e107] [cursor=pointer]:
          - /url: "#"
        - link "Italiano" [ref=e110] [cursor=pointer]:
          - /url: "#"
        - link "Deutsch" [ref=e113] [cursor=pointer]:
          - /url: "#"
        - link "Español" [ref=e116] [cursor=pointer]:
          - /url: "#"
        - link "Русский" [ref=e119] [cursor=pointer]:
          - /url: "#"
        - link "More languages…" [ref=e122] [cursor=pointer]:
          - /url: "#"
      - generic [ref=e125]:
        - link "Sign Up" [ref=e128] [cursor=pointer]:
          - /url: https://www.facebook.com/reg/
        - link "Log In" [ref=e131] [cursor=pointer]:
          - /url: https://www.facebook.com/login/
        - link "Messenger" [ref=e134] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fmessenger.com%2F&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Facebook Lite" [ref=e137] [cursor=pointer]:
          - /url: https://www.facebook.com/lite/
        - link "Video" [ref=e140] [cursor=pointer]:
          - /url: https://www.facebook.com/watch/
        - link "Meta Pay" [ref=e143] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fabout.meta.com%2Ftechnologies%2Fmeta-pay&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Meta Store" [ref=e146] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2F&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Meta Quest" [ref=e149] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2Fquest%2F&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Ray-Ban Meta" [ref=e152] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.com%2Fai-glasses%2Fray-ban-meta%2F&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Meta AI" [ref=e155] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.meta.ai%2F&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Instagram" [ref=e158] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.instagram.com%2F&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Threads" [ref=e161] [cursor=pointer]:
          - /url: https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.threads.com%2F&h=AUBZIREPun-xENoCT0wyKjm5UWdxycbYcWx08_IMgGceqTM8jpQwA_AIe0Y9EiYf_lqDQttW7GiN7YP04oV_rUSU3o82kdCmvQRAtveiqeJrZQtih4-Oye1pdXS52cey6LCbVv73_DVryPkAPcvaMQ
        - link "Privacy Policy" [ref=e164] [cursor=pointer]:
          - /url: https://www.facebook.com/privacy/policy/?entry_point=facebook_page_footer
        - link "Privacy Center" [ref=e167] [cursor=pointer]:
          - /url: https://www.facebook.com/privacy/center/?entry_point=facebook_page_footer
        - link "About" [ref=e170] [cursor=pointer]:
          - /url: https://www.facebook.com/about/
        - link "Create ad" [ref=e173] [cursor=pointer]:
          - /url: https://www.facebook.com/ad_campaign/landing.php?placement=pflo&campaign_id=402047449186&nav_source=unknown&extra_1=auto
        - link "Create Page" [ref=e176] [cursor=pointer]:
          - /url: https://www.facebook.com/pages/create/?ref_type=site_footer
        - link "Developers" [ref=e179] [cursor=pointer]:
          - /url: https://developers.facebook.com/?ref=pf
        - link "Careers" [ref=e182] [cursor=pointer]:
          - /url: https://www.facebook.com/careers/?ref=pf
        - link "Cookies" [ref=e185] [cursor=pointer]:
          - /url: https://www.facebook.com/policies/cookies/
        - link "Ad choices" [ref=e188] [cursor=pointer]:
          - /url: https://www.facebook.com/help/568137493302217
          - text: Ad choices
        - link "Terms" [ref=e193] [cursor=pointer]:
          - /url: https://www.facebook.com/policies?ref=pf
        - link "Help" [ref=e196] [cursor=pointer]:
          - /url: https://www.facebook.com/help/?ref=pf
        - link "Contact Uploading & Non-Users" [ref=e199] [cursor=pointer]:
          - /url: https://www.facebook.com/help/637205020878504
      - generic [ref=e202]: Meta © 2026
```