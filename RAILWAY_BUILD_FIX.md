# Исправление ошибки Railpack «could not determine how to build»

## Почему падает сборка

1. **Root Directory** — у сервиса бэкенда в Railway должен быть указан **Root Directory: `back`** (без слэша).  
   Settings → Build → Root Directory → `back`.

2. **В папке `back/` в репозитории должен быть полный проект**: `package.json`, `Dockerfile`, `railway.toml`, папки `src/`, `prisma/` и т.д.  
   Сейчас в git под `back/` закоммичены только 2 файла, поэтому Railpack видит только `./` и `src/` и не находит `package.json`.

## Что сделать

- В Railway для сервиса бэкенда: **Root Directory** = **`back`**.
- Закоммитить и запушить в репозиторий **всю папку back/** (package.json, Dockerfile, railway.toml, src/, prisma/, scripts/, programs/, конфиги), чтобы при клонировании репо в `back/` был полный Node-проект.

В `back/` добавлены `railpack.json` и `start.sh` — после того как в репо будет полный `back/`, Railpack сможет собрать проект (или будет использоваться Dockerfile из `back/railway.toml`).
