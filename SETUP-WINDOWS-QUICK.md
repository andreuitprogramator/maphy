# Setup Maphy — Windows (comenzi rapide)

## Configurare Git
```bash
git config --global user.name "Numele Tau"
git config --global user.email "email@example.com"
```

## Clone + branch
```bash
cd Desktop
git clone https://github.com/andreuitprogramator/maphy.git
cd maphy
git switch -c feature/pip
```

## PostgreSQL (în psql ca postgres)
```sql
CREATE DATABASE maphy;
CREATE USER pip WITH SUPERUSER PASSWORD 'pip';
GRANT ALL PRIVILEGES ON DATABASE maphy TO pip;
\q
```

## Fișier .env
```bash
copy .env.example .env
```
Conținut `.env`:
```
DATABASE_URL="postgresql://pip:pip@localhost:5432/maphy?schema=public"
JWT_SECRET="dev-secret-change-me"
OPENAI_API_KEY="<cheia primită de la coleg>"
OPENAI_GRADING_MODEL="gpt-5-nano"
```

## Install + Prisma
```bash
npm install --ignore-scripts
npx prisma generate
npx prisma db push
npm run db:seed
```

## Dacă Prisma dă 403 (Zscaler)
Descarcă manual din browser:
```
https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/windows/query_engine.dll.node.gz
https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/windows/schema-engine.exe.gz
```
Dezarhivează cu 7-Zip, apoi:
```powershell
copy query_engine.dll.node node_modules\.prisma\client\query_engine-windows.dll.node
$env:PRISMA_SCHEMA_ENGINE_BINARY="C:\prisma-engines\schema-engine.exe"
$env:PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING="1"
npx prisma generate
npx prisma db push
npm run db:seed
```

## Pornire
```bash
npm run dev
```
→ http://localhost:3000
