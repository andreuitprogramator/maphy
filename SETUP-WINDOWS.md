# Setup Maphy pe Windows

## 1. Instalare software necesar

### Git
- Descarcă de pe https://git-scm.com/download/win și instalează (next-next-finish).
- La "Adjusting your PATH" alege **"Git from the command line and also from 3rd-party software"**.

### Node.js 22 LTS
- Descarcă de pe https://nodejs.org/ versiunea **22 LTS** (nu Current).
- Instalează cu setările default.

### PostgreSQL
- Descarcă de pe https://www.enterprisedb.com/downloads/postgres-postgresql-downloads versiunea **17**.
- La instalare:
  - Parola pentru superuser `postgres`: pune **postgres** (e doar local).
  - Port: lasă **5432**.
  - Bifează **pgAdmin** dacă vrei interfață grafică.

---

## 2. Configurare Git

Deschide **PowerShell** sau **Git Bash** și rulează:

```bash
git config --global user.name "Radu Pipernea"
git config --global user.email "radu.pipernea@yahoo.com"
```

---

## 3. Clone repo

```bash
cd Desktop
git clone https://github.com/andreuitprogramator/maphy.git
cd maphy
git switch -c feature/pip
```

---

## 4. Creare user PostgreSQL "pip"

Deschide **SQL Shell (psql)** din Start Menu (vine cu PostgreSQL):
- Server: `localhost`
- Database: `postgres`
- Port: `5432`
- Username: `postgres`
- Password: `postgres` (cea pusă la instalare)

Apoi rulează:

```sql
CREATE DATABASE maphy;
CREATE USER pip WITH SUPERUSER PASSWORD 'pip';
GRANT ALL PRIVILEGES ON DATABASE maphy TO pip;
\q
```

---

## 5. Creare fișier .env

În folderul `maphy`, copiază `.env.example` la `.env`:

```bash
copy .env.example .env
```

Deschide `.env` în editor și pune:

```
DATABASE_URL="postgresql://pip:pip@localhost:5432/maphy?schema=public"
JWT_SECRET="dev-secret-change-me"
OPENAI_API_KEY="<cheia primită de la coleg>"
OPENAI_GRADING_MODEL="gpt-5-nano"
```

---

## 6. Fix schema Prisma

Deschide `prisma/schema.prisma` și verifică datasource-ul — trebuie să arate așa:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

(Dacă lipsește linia `url = env("DATABASE_URL")`, adaug-o.)

---

## 7. Install dependențe

```bash
npm install --ignore-scripts
```

(`--ignore-scripts` pentru că Prisma engines pot eșua dacă ești pe rețea cu Zscaler.)

---

## 8. Prisma engines (dacă ai Zscaler)

Dacă `npx prisma generate` dă **403 Forbidden**, trebuie descărcate manual.

### Versiunea Prisma 6.19.3 — commit `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`

Descarcă aceste 2 fișiere dintr-un browser (dezactivează Zscaler sau folosește hotspot):

1. **Query Engine:**
   ```
   https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/windows/query_engine.dll.node.gz
   ```

2. **Schema Engine:**
   ```
   https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/windows/schema-engine.exe.gz
   ```

Dezarhivează fișierele `.gz` (cu 7-Zip de ex.) și copiază-le:

- `query_engine.dll.node` → `maphy\node_modules\.prisma\client\query_engine-windows.dll.node`
- `schema-engine.exe` → pune-l într-un loc known, de ex. `C:\prisma-engines\schema-engine.exe`

Apoi rulează:

```powershell
$env:PRISMA_SCHEMA_ENGINE_BINARY="C:\prisma-engines\schema-engine.exe"
$env:PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING="1"
npx prisma generate
```

### Dacă NU ai Zscaler (rețea normală)

Pur și simplu:

```bash
npx prisma generate
```

---

## 9. Setup baza de date

```bash
npx prisma db push
npm run db:seed
```

(Dacă `db push` cere engine, setează `$env:PRISMA_SCHEMA_ENGINE_BINARY` ca mai sus.)

---

## 10. Pornire server

```bash
npm run dev
```

Deschide **http://localhost:3000** în browser. Creează un cont nou.

---

## Pornire rapidă (data viitoare)

PostgreSQL pornește automat ca serviciu Windows. Deci doar:

```bash
cd maphy
npm run dev
```

---

## Troubleshooting

| Problemă | Soluție |
|----------|---------|
| `403 Forbidden` la Prisma | Dezactivează Zscaler sau folosește hotspot, descarcă engines manual (pasul 8) |
| `ECONNREFUSED` la db push | Verifică că PostgreSQL rulează: Start → Services → `postgresql-x64-17` trebuie să fie Started |
| `password authentication failed` | Verifică user/parola în `.env` — trebuie să fie `pip:pip` |
| Port 5432 ocupat | În `.env` schimbă portul, sau oprește alt PostgreSQL |
