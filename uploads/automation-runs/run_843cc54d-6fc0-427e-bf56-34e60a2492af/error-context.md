# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 104b643f-c40f-46b2-b7f1-16539d9d4216-run_843cc54d-6fc0-427e-bf56-34e60a2492af.spec.ts >> Vérifier le champ "Light"
- Location: 104b643f-c40f-46b2-b7f1-16539d9d4216-run_843cc54d-6fc0-427e-bf56-34e60a2492af.spec.ts:6:1

# Error details

```
Error: locator.fill: Error: Element is not an <input>, <textarea>, <select> or [contenteditable] and does not have a role allowing [aria-readonly]
Call log:
  - waiting for getByLabel(/Light/i).or(getByPlaceholder(/Light/i)).or(locator('input[name*="light" i], textarea[name*="light" i], input[id*="light" i], textarea[id*="light" i]')).first()
    - locator resolved to <button lang="" jsname="jerT5" aria-pressed="true" jscontroller="xzbRj" data-sync-idom-state="true" data-idom-class="fzRBVc tmJved mN1ivc rrPCWc" aria-label="Switch between light and dark theme" class="VfPpkd-Bz112c-LgbsSe VfPpkd-Bz112c-LgbsSe-OWXEXe-IT5dJd VfPpkd-Bz112c-LgbsSe-OWXEXe-e5LLRc-SxQuSe fzRBVc tmJved mN1ivc rrPCWc" jsaction="click:cOuCgd; mousedown:UX7yZ; mouseup:lbsD7e; mouseenter:tfO1Yc; mouseleave:JywGue; touchstart:p6p2H; touchmove:FwuNnf; touchend:yfqBxc; touchcancel:JMtRjd; focus:AHm…>…</button>
    - fill("Valeur de test")
  - attempting fill action
    - waiting for element to be visible, enabled and editable

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - button "Main menu" [ref=e5] [cursor=pointer]:
          - img [ref=e6]
        - link "Google Translate" [ref=e10] [cursor=pointer]:
          - /url: /?hl=en&tab=TT
          - generic [ref=e12]: Translate
      - generic [ref=e14]:
        - button "Switch between light and dark theme" [pressed] [ref=e20] [cursor=pointer]:
          - img [ref=e22]
        - button "Settings" [ref=e33] [cursor=pointer]:
          - img [ref=e35]
      - generic [ref=e40]:
        - button "Google apps" [ref=e44] [cursor=pointer]:
          - img [ref=e45]
        - link "Sign in" [ref=e48] [cursor=pointer]:
          - /url: https://accounts.google.com/ServiceLogin?passive=1209600&continue=https://translate.google.com/?sl%3Den%26tl%3Dfr%26op%3Dtranslate&followup=https://translate.google.com/?sl%3Den%26tl%3Dfr%26op%3Dtranslate&ec=GAZAMw
  - generic [ref=e53]:
    - navigation "Translation types" [ref=e55]:
      - heading "Translation types" [level=2] [ref=e56]
      - button "Text translation" [ref=e59]:
        - img [ref=e62]
        - generic [ref=e64]: Text
      - button "Image translation" [ref=e67]:
        - img [ref=e71]
        - generic [ref=e73]: Images
      - button "Document translation" [ref=e76]:
        - img [ref=e80]
        - generic [ref=e82]: Documents
      - button "Website translation" [ref=e85]:
        - img [ref=e88]
        - generic [ref=e90]: Websites
    - main "Text translation" [ref=e92]:
      - heading "Text translation" [level=1] [ref=e93]
      - generic [ref=e94]:
        - generic [ref=e98]:
          - generic [ref=e99]:
            - tablist [ref=e102]:
              - generic [ref=e105]:
                - tab "Detect language" [ref=e106] [cursor=pointer]:
                  - generic:
                    - generic: Detect language
                - tab "English" [selected] [ref=e108] [cursor=pointer]:
                  - generic:
                    - generic: English
                - tab "Spanish" [ref=e110] [cursor=pointer]:
                  - generic:
                    - generic: Spanish
                - tab "French" [ref=e112] [cursor=pointer]:
                  - generic:
                    - generic: French
            - button "More source languages" [ref=e115] [cursor=pointer]:
              - img [ref=e117]
          - button "Swap languages (Ctrl+Shift+S)" [ref=e121] [cursor=pointer]:
            - img [ref=e123]
          - generic [ref=e125]:
            - tablist [ref=e128]:
              - generic [ref=e131]:
                - tab "French" [selected] [ref=e132] [cursor=pointer]:
                  - generic:
                    - generic: French
                - tab "English" [ref=e134] [cursor=pointer]:
                  - generic:
                    - generic: English
                - tab "Spanish" [ref=e136] [cursor=pointer]:
                  - generic:
                    - generic: Spanish
            - button "More target languages" [ref=e139] [cursor=pointer]:
              - img [ref=e141]
        - generic [ref=e145]:
          - generic [ref=e147]:
            - heading "Source text" [level=2] [ref=e148]
            - combobox "Source text" [active] [ref=e152]
            - generic [ref=e158]:
              - button "Translate by voice" [ref=e163] [cursor=pointer]:
                - img [ref=e165]
              - img "0 of 5,000 characters used"
              - generic [ref=e177]:
                - generic:
                  - button [ref=e178]
                  - button "Show the Input Tools menu" [ref=e180]
          - region "Translation results" [ref=e182]:
            - heading "Translation results" [level=2] [ref=e183]
            - generic [ref=e185]: Translation
        - button "Send feedback" [ref=e191]
    - navigation "Side panels" [ref=e192]:
      - heading "Side panels" [level=2] [ref=e193]
      - link "History" [ref=e194] [cursor=pointer]:
        - /url: ./history
        - img [ref=e197]
        - generic [ref=e200]: History
      - link "Saved" [ref=e201] [cursor=pointer]:
        - /url: ./saved
        - img [ref=e205]
        - generic [ref=e208]: Saved
```