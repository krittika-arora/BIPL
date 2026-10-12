# Email setup (sign-up verification codes)

New learners confirm their email address with a 6-digit code before their account is created. The code is sent through an SMTP server that you configure with environment variables. Nothing about email is hardcoded in the repository.

## How it behaves without SMTP

| Environment | No `SMTP_HOST` set |
| --- | --- |
| Development (`NODE_ENV` not `production`) | The email, including the code, is **printed in the terminal** running `npm run dev`. The verification page says so. Good for trying the app without any mail account. |
| Production (`NODE_ENV=production`) | The app **refuses to start** (`Missing required environment variable: SMTP_HOST`), so sign-up can never silently break in production. |

## The settings

| Variable | What to put | Example |
| --- | --- | --- |
| `SMTP_HOST` | Your provider's SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | `465` (TLS from the start) or `587` (upgraded with STARTTLS) | `465` |
| `SMTP_SECURE` | `true` for port 465, `false` for 587 | `true` |
| `SMTP_USER` | The login for the SMTP server, usually the full email address | `yourname@gmail.com` |
| `SMTP_PASS` | The SMTP password. **For Gmail this is an App Password**, not your normal password | `abcdefghijklmnop` |
| `MAIL_FROM` | Sender name and address shown to users (defaults to `SMTP_USER`) | `CourseTrack <yourname@gmail.com>` |

`SMTP_PORT` and `SMTP_SECURE` must match: 465 with `true`, or 587 with `false`. A mismatch shows up as a timeout or a "wrong version number" error.

## Where to put them

### On your computer: the `.env` file

1. Open the project folder and find the file named `.env` in the top level (next to `package.json`). If it is missing, copy `.env.example` to `.env`.
2. Add or fill in the SMTP lines at the bottom, for example for Gmail:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcdefghijklmnop
   MAIL_FROM=CourseTrack <yourname@gmail.com>
   ```

   No quotes are needed. Do not put spaces around `=`.
3. Save the file. **`.env` is listed in `.gitignore` and must never be committed**; check with `git status` that it does not appear.
4. Restart the app (Ctrl + C, then `npm run dev`). `.env` is only read at start-up. The start-up log shows which mail setup is active, without the password, for example:
   `Mail: SMTP smtp.gmail.com:465 (TLS) as yourname@gmail.com, from CourseTrack <yourname@gmail.com>`
5. Check the settings on their own, before trying a sign-up:

   ```
   npm run mail:test -- you@example.com
   ```

   It connects, logs in and sends one test email. If something is wrong it says which part failed (login rejected, server unreachable, etc.).

### In production (e.g. Render)

Do not upload a `.env` file. In the Render dashboard open the web service, then **Environment**, then **Add Environment Variable**, and add the same six names and values. Saving redeploys the service. Use `NODE_ENV=production` there too, so the app refuses to start if any required setting is missing.

Some hosting providers block outgoing SMTP on free plans. If `npm run mail:test` works locally but sign-up emails time out in production, use a provider that also listens on port **2525** (Brevo, SendGrid and Mailtrap do) and set `SMTP_PORT=2525`, `SMTP_SECURE=false`.

## Provider settings

### Gmail (personal account)

Gmail no longer accepts your normal password from apps; you need an **App Password**, which requires 2-Step Verification.

1. Go to your Google Account, then **Security**, and turn on **2-Step Verification** if it is off.
2. Open **App passwords** (search for "App passwords" in the Google Account search bar, or visit `myaccount.google.com/apppasswords`).
3. Enter a name such as `CourseTrack` and click **Create**.
4. Google shows a 16-character password like `abcd efgh ijkl mnop`. Copy it **without the spaces** into `SMTP_PASS`. It is shown only once; if you lose it, delete it and create another.
5. Settings:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=<the 16 characters, no spaces>
   MAIL_FROM=CourseTrack <yourname@gmail.com>
   ```

   (Port 587 with `SMTP_SECURE=false` also works.)

Notes: Gmail always sends from the account you log in with, so keep `MAIL_FROM` on that address. Personal Gmail allows roughly 500 emails a day, plenty for a demo. If the "App passwords" page is missing, 2-Step Verification is not on yet, or the account is managed by an organisation that disabled it.

### Brevo (free transactional email, good for a deployed demo)

1. Create a free account at brevo.com and verify the sender address you will use.
2. Go to **SMTP & API**, then the **SMTP** tab, and generate an SMTP key.
3. Settings: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=<the SMTP login shown on that page>`, `SMTP_PASS=<the SMTP key>`, `MAIL_FROM=CourseTrack <your verified sender>`.

### SendGrid

Create an API key with "Mail Send" permission and verify a sender. Then: `SMTP_HOST=smtp.sendgrid.net`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=apikey` (literally the word `apikey`), `SMTP_PASS=<the API key>`, `MAIL_FROM=<the verified sender>`.

### Mailtrap (testing only: emails are caught, not delivered)

Useful for checking the email without sending to a real inbox. In Mailtrap open **Email Testing**, then your inbox, then **SMTP settings**, and copy the host (`sandbox.smtp.mailtrap.io`), port (`2525`), username and password. Use `SMTP_SECURE=false`. Messages appear in the Mailtrap inbox in the browser.

### Outlook.com / Hotmail

Microsoft has been turning off password-based SMTP for personal Outlook.com accounts in favour of OAuth, which this app does not use. It may be rejected even with correct details; prefer Gmail or one of the providers above.

## Troubleshooting `npm run mail:test`

| Message | Usual cause |
| --- | --- |
| `Invalid login: 535 ...` / "rejected the username or password" | Wrong `SMTP_USER`/`SMTP_PASS`. For Gmail: an App Password is required, and it must be pasted without spaces. |
| `connect ETIMEDOUT` / `ECONNREFUSED` | Wrong `SMTP_HOST` or `SMTP_PORT`, or the network or host blocks that port. Try 587 or 2525. |
| `wrong version number` / TLS errors | `SMTP_SECURE` does not match the port (465 = `true`, 587 = `false`). |
| `Mail: no SMTP_HOST set ...` | `.env` was not saved, is not in the project folder, or the app was not restarted. |
| Test email sent but not in the inbox | Check spam. For Brevo/SendGrid, make sure `MAIL_FROM` is a verified sender. |
