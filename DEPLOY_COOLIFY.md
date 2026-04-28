# Deploy AI Gateway on Coolify

This project is designed to run on Coolify as a single **Dockerfile-based Application**.

## Why Dockerfile mode

The repository already includes a production [Dockerfile](./Dockerfile) that:

- builds the dashboard
- builds the server
- serves the dashboard from the Node server
- exposes port `3000`
- stores SQLite data in `/data`

That makes it a good fit for one Coolify application without Docker Compose.

## Coolify Setup

### 1. Create the application

- In Coolify, create a new **Application**
- Connect your Git repository
- Choose the branch you want to deploy
- Select **Dockerfile** as the build pack
- Use the repository root [Dockerfile](./Dockerfile)

### 2. Configure networking

- Set the application port to `3000`
- Add your public domain in Coolify
- Let Coolify handle the reverse proxy and HTTPS

You do not need [nginx.conf](./nginx.conf) for the standard Coolify setup.

### 3. Add persistent storage

Add a persistent volume with:

- **Destination path**: `/data`

This is required so SQLite survives redeployments. The container writes the database to:

```env
DB_PATH=/data/gateway.db
```

### 4. Add runtime environment variables

Use the values from [coolify.env.example](./coolify.env.example) as the starting point.

Minimum recommended variables:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
ADMIN_PASSWORD=change-this-dashboard-password
JWT_SECRET=change-this-to-a-long-random-secret
EXTENSION_TOKEN=change-this-extension-token
CORS_ORIGINS=https://gateway.example.com
DB_PATH=/data/gateway.db
LOG_RETENTION_DAYS=30
```

Notes:

- Set these as **runtime variables**
- Build variables are not required for this project
- Use a strong `ADMIN_PASSWORD`
- Use a long random `JWT_SECRET`
- `EXTENSION_TOKEN` must match the token configured in the Chrome extension

## Deploy Flow

Recommended order:

1. Push the repository to GitHub, GitLab, or another Git provider connected to Coolify
2. Create the Coolify application from the repository
3. Select Dockerfile deployment
4. Set port `3000`
5. Add persistent storage mounted to `/data`
6. Add the runtime environment variables
7. Add your domain
8. Trigger the first deploy

## Validation Checklist

After deployment:

### Dashboard

- Open `https://your-domain`
- Log in with `ADMIN_PASSWORD`

### Health check

- Open `https://your-domain/health`
- Expected response:

```json
{
  "status": "ok"
}
```

### API endpoints

- OpenAI-compatible base URL:

```text
https://your-domain/v1
```

- Anthropic-compatible base URL:

```text
https://your-domain/anthropic
```

### Persistence

1. Add a provider or create an API key in the dashboard
2. Redeploy from Coolify
3. Confirm the data is still present

## Important Constraints

- This deployment uses SQLite, so it is best suited for a **single instance**
- Do not scale to multiple replicas while using the same SQLite file
- Requests without a gateway API key still work if the gateway is in open mode
- For public deployments, restrict `CORS_ORIGINS` to your real domain instead of `*`

## Troubleshooting

### Application deploys but dashboard does not open

- Confirm Coolify routes traffic to port `3000`
- Check the application logs in Coolify
- Confirm the health endpoint responds on `/health`

### Data disappears after redeploy

- Confirm persistent storage is mounted to `/data`
- Confirm `DB_PATH=/data/gateway.db`

### Dashboard login fails

- Confirm `ADMIN_PASSWORD` is set in Coolify
- Redeploy after updating the variable

### Chrome extension cannot push cookies

- Confirm `EXTENSION_TOKEN` in Coolify matches the token saved in the extension popup
- Make sure the extension points to your public Coolify domain
