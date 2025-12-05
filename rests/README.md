# REST Client Test Files

This directory contains `.rest` files for testing the API using the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension.

## Setup

1. Install the REST Client extension in VS Code
2. Start the backend server: `npm run dev:backend`
3. Open any `.rest` file
4. Click "Send Request" above any request block

## Files

| File | Description |
|------|-------------|
| `auth.rest` | Authentication endpoints (register, login, password reset) |
| `health.rest` | Health check endpoint |

## Workflow

1. **Start with health check** - Verify server is running
2. **Register a user** - Create an account
3. **Login** - Get an access token
4. **Copy token** - Update `@accessToken` variable at the top of the file
5. **Test protected endpoints** - Use token for authenticated requests

## Variables

Each file has variables at the top that you can modify:

```
@baseUrl = http://localhost:3000/api/v1
@accessToken = YOUR_TOKEN_HERE
```

After logging in, copy the `accessToken` from the response and paste it into the `@accessToken` variable to test authenticated endpoints.
