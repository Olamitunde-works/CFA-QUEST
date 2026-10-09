# CFA Quest

A study game for CFA Level I. Each curriculum reading becomes a level set inside one fictional company you follow through all 10 topics: briefing → story missions → field manual → boss fight → spaced-repetition review. It also includes a module-by-module study plan, email and calendar reminders, a Coach chatbot, XP, streaks and a focus timer.

---

## Setup, step by step (about 20 minutes)

### 1. Put the code on GitHub
1. Create a free account at **github.com**.
2. Top-right **+** → **New repository** → name it `cfa-quest` → *Private* is fine → **Create repository**.
3. On the new repo page click **uploading an existing file**.
4. Unzip `cfa-quest.zip` on your computer, open the `cfa-quest` folder, select **everything inside it** (including the `netlify` folder) and drag it into the browser. Chrome and Edge keep the folder structure.
5. Click **Commit changes**. Check that `netlify/edge-functions/claude.js` appears in the repo.

### 2. Create the Netlify site
1. Sign up at **netlify.com** with your GitHub account.
2. **Add new site → Import an existing project → GitHub** → pick `cfa-quest`.
3. Leave the build command empty and the publish directory as `.` → **Deploy**.

### 3. Get your Anthropic API key (for Coach and level building)
1. Go to **console.anthropic.com** and sign up (separate from your Claude subscription).
2. **Billing** → add a card and a small amount of credit (e.g. $10).
3. **API keys** → **Create key** → copy it (starts with `sk-ant-`). You only see it once.

### 4. (Optional) Get a Resend key (for reminder emails)
1. Sign up at **resend.com** (free tier: 3,000 emails/month, 100/day).
2. **API Keys** → **Create API key** → copy it (starts with `re_`).
3. Without a domain, Resend only delivers to the email you signed up with — fine for yourself. To email friends too, add and verify a domain under **Domains**, then set `REMINDER_FROM` (see below).

### 5. Add the keys to Netlify
In your Netlify site: **Site configuration → Environment variables → Add a variable → Add a single variable**. Add each of these (keep the default "all scopes"):

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
| `ACCESS_CODE` | any password you choose — share it only with friends you invite |
| `RESEND_API_KEY` | your `re_...` key (only if you want emails) |
| `REMINDER_FROM` | optional, e.g. `CFA Quest <study@yourdomain.com>` once your domain is verified |
| `CLAUDE_MODEL` | optional, defaults to `claude-sonnet-5-5` |

Then **Deploys → Trigger deploy → Deploy site** so the new variables take effect.

### 6. Check it works
1. Open your site (`https://<name>.netlify.app`), enter your name, pick a story world, enter your access code.
2. **⚙ Settings → Test AI connection** should say ✅.
3. **Plan** → build your plan → enter your email under Reminders → **Email me reminders**. A confirmation email should arrive within a minute.

Keys never reach the browser: they're only read by the server functions in `netlify/`.

---

## Using it
- **Plan**: exam date, hours, goal and your status per topic → a schedule broken down by learning module (2027 Level I outline, 102 modules). Tick modules you've finished and the plan re-balances.
- **Reminders**: a daily email at your chosen hour listing that day's modules, or **Add to calendar (.ics)** for phone notifications with no email setup.
- **Add a reading**: pick the topic and module, drop screenshots of every page (LOS page first) → **Build level**. Check the coverage report, then play.
- **Review**: due items come back on a 1-3-7-14-30-60 day schedule. On a level's LOS tab, flag LOS you missed on CFA practice questions.
- **Settings**: turn off the animated background if it distracts you; export a backup to move progress to another device.

The module list comes from a prep-provider outline of the 2027 curriculum. Compare it with the official list on the CFA Institute portal.

## Costs
- Building one level ≈ 6–12 AI calls, usually well under $1 with Sonnet. Coach messages cost fractions of a cent.
- Netlify free tier covers the site, functions, scheduled reminders and storage for personal use.

## Sharing with friends
Give them the URL and access code. Each person's levels and progress stay in their own browser, and each person builds levels from their own curriculum access — don't share backups containing curriculum-based levels. AI usage bills to your key; change `ACCESS_CODE` to revoke access.

## Files
```
index.html, css/styles.css           app shell and theme
js/app.js                            views, gameplay, coach, background animation
js/ai.js                             AI client + screenshot → level pipeline
js/plan.js                           module-level study plan generator
js/reminders.js                      email subscription + .ics calendar export
js/srs.js, js/store.js, js/expr.js   review queue, storage, formula engine
js/data.js                           topics, 2027 modules, story worlds, demo level
netlify/edge-functions/claude.js     AI proxy (keeps your API key secret)
netlify/functions/reminders.mjs      subscribe / unsubscribe endpoint
netlify/functions/send-reminders.mjs hourly job that sends due reminders
netlify/lib/email.mjs                email template + Resend sender
```
