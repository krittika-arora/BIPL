# Deployment: Render + MongoDB Atlas

Not deployed yet. These are the steps when it is time. The app needs one Node web service and one MongoDB database; everything else (sessions, uploads parsed in memory) lives in those two.

## 1. Database: MongoDB Atlas (free M0 cluster)

1. Sign in at cloud.mongodb.com and create a project, then **Create** a cluster: choose **M0 (free)** and a region close to where Render will run (e.g. Frankfurt or Singapore).
2. **Database Access**, then **Add New Database User**: password authentication, a username such as `coursetrack-app`, and a long generated password (save it in a password manager). Role: **Read and write to any database**. You can restrict it to the `coursetrack` database later.
3. **Network Access**, then **Add IP Address**: Render's free plan has no fixed outgoing IP, so allow `0.0.0.0/0`. The database user's password is then the protection, so keep it long and secret.
4. **Connect**, then **Drivers**: copy the connection string. It looks like:
   `mongodb+srv://coursetrack-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Put the database name after `.net/`: `...mongodb.net/coursetrack?retryWrites=true&w=majority`, and replace `<password>`. If the password contains special characters such as `@ : / ?`, URL-encode them.

Never put this string in the repository; it goes only into Render's environment settings.

## 2. Web service: Render

1. Sign in at render.com with GitHub and allow access to the `BIPL` repository.
2. **New**, then **Web Service**, then pick the repository and branch `main`.
3. Settings:

   | Setting | Value |
   | --- | --- |
   | Runtime | Node |
   | Build command | `npm ci` |
   | Start command | `npm start` |
   | Instance type | Free |

4. **Environment**, then add:

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | the Atlas string from step 1 |
   | `SESSION_SECRET` | a new long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (do not reuse the local one) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | as in `docs/email-setup.md` |
   | `NODE_VERSION` | `22` (any version ≥ 20.12 works) |

   `PORT` is set by Render automatically. Do not set `MAIL_TRANSPORT` or `MONGODB_URI_TEST` in production.
5. **Create Web Service.** Render builds and starts it, and the URL (`https://<name>.onrender.com`) appears at the top. The start-up log shows `MongoDB connected`, the `Mail:` line and `CourseTrack running`. If a required variable is missing the app stops immediately and the log names it.

With `NODE_ENV=production` the app trusts Render's proxy and marks the session cookie `Secure` (HTTPS only). It also sends HSTS, refuses to start without SMTP settings, and refuses to reseed unless explicitly allowed.

## 3. Demo data

Run the seed once, from your own computer, pointed at Atlas for that one command (PowerShell):

```powershell
$env:MONGODB_URI = "<the Atlas connection string>"
npm run seed
Remove-Item Env:MONGODB_URI
```

The variable set in the window takes precedence over `.env`, so only that command uses Atlas. The seed **deletes everything** in the database before loading the demo data: never run it against Atlas again once real people use the app. (On a machine where `NODE_ENV=production`, the seed refuses to run unless `ALLOW_SEED=true` is also set, as a guard against exactly that.)

## 4. Check it

1. Open the Render URL in a private window: the landing page and catalogue load without logging in.
2. Log in as `ananya.instructor@example.com` / `Instructor@123`: the dashboard shows numbers, the chart draws, and the **Alerts** badge shows a count.
3. Log in as `neha.learner@example.com` / `Learner@123` and complete a lesson.
4. Sign up with a real email address you can open: the verification code arrives by email.
5. Free Render services sleep after about 15 minutes without traffic; the first request afterwards takes up to a minute. Open the URL once before sharing it or demoing.
6. Put the URL into `SUBMISSION.md` (**Live application**) and commit.

## Updating

Every push to `main` redeploys automatically. Environment changes in Render trigger a redeploy too.
