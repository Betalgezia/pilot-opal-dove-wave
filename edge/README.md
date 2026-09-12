# Relay Edge

Vercel edge-публикация подписки для Relay с хранением снапшотов в Upstash Redis REST API.

## Деплой в Vercel

1. Импортируйте репозиторий `Betalgezia/pilot-opal-dove-wave` в Vercel.
2. В проекте откройте **Settings → General → Root Directory** и установите `edge`.
3. Добавьте переменные окружения:
   - `SECRET` — общий секрет для publish/sub endpoint.
   - `UPSTASH_URL` — REST URL вашей базы Upstash Redis.
   - `UPSTASH_TOKEN` — REST token вашей базы Upstash Redis.
4. Выполните deploy.

После деплоя:
- публикация: `POST https://<your-edge-domain>/api/publish?secret=<SECRET>&fmt=b64`
- публикация: `POST https://<your-edge-domain>/api/publish?secret=<SECRET>&fmt=clash`
- получение b64: `GET https://<your-edge-domain>/api/sub?secret=<SECRET>&fmt=b64`
- получение Mihomo YAML: `GET https://<your-edge-domain>/api/sub?secret=<SECRET>&fmt=clash`

## Curl

```bash
curl -X POST \
  'https://<your-edge-domain>/api/publish?secret=<SECRET>&fmt=b64' \
  --data-binary @relay.txt

curl -X POST \
  'https://<your-edge-domain>/api/publish?secret=<SECRET>&fmt=clash' \
  --data-binary @relay.yaml

curl -f \
  'https://<your-edge-domain>/api/sub?secret=<SECRET>&fmt=b64' \
  -o relay.txt

curl -f \
  'https://<your-edge-domain>/api/sub?secret=<SECRET>&fmt=clash' \
  -o relay.yaml
```

Edge-код намеренно не имеет npm-зависимостей и использует только встроенные Node.js API и `fetch`.

## Relay

В панели Relay укажите Edge URL вида `https://<your-edge-domain>/api/publish`, тот же секрет и включите автопубликацию после скана. Relay публикует b64 и clash снапшоты после успешного скана, а результат публикации отображается в логах.
