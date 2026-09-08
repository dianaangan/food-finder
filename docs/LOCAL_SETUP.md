# This machine's prepared environment

Project: `D:\My Projects\food-finder`.

A portable MySQL 8.4.11 instance is prepared under the ignored `work` folder. It binds to `127.0.0.1:3307`, uses databases `food_finder` and `food_finder_test`, and does not install a Windows service. The generated password is already in the ignored `backend/.env`. Do not paste it into chat or commit the file.

If MySQL is no longer running, start it in a separate PowerShell terminal from the project root:

```powershell
& '.\work\mysql\mysql-8.4.11-winx64\bin\mysqld.exe' --no-defaults --basedir='D:/My Projects/food-finder/work/mysql/mysql-8.4.11-winx64' --datadir='D:/My Projects/food-finder/work/mysql-data' --port=3307 --bind-address=127.0.0.1 --mysqlx=OFF --console
```

Do not run initialization again; the existing data directory is already initialized. Keep this terminal open. Stop the process with Ctrl+C after stopping the app.

Start the applications from another terminal:

```powershell
pnpm dev
```

Open [the application](http://localhost:3000).

Stripe is intentionally disabled until all three test settings are entered in `backend/.env`. Follow the README's Stripe setup and restart Express afterwards. No live key is accepted.

The portable archive was verified against the MD5 shown on the official MySQL download page. The portable runtime, its databases, dependencies, and local environment files are excluded from Git; they are convenience files for this machine, not required source artifacts.
