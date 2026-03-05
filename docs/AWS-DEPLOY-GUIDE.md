# MAJU Backend — AWS App Runner Deploy Guide

Deploys the MAJU video stitching backend (Node.js + FFmpeg) to AWS App Runner so the dashboard can process and stitch videos.

---

## Prerequisites

- AWS account with admin access
- AWS CLI installed (`brew install awscli` on Mac, or [aws.amazon.com/cli](https://aws.amazon.com/cli))
- Docker Desktop installed and running

## Setup AWS CLI (one-time)

1. Go to **AWS Console → IAM → Users → your user → Security Credentials**
2. Click **Create Access Key** → choose **CLI** → copy the Key ID and Secret
3. Run:
   ```bash
   aws configure
   ```
4. Enter:
   - Access Key ID: *(paste)*
   - Secret Access Key: *(paste)*
   - Region: `us-east-1`
   - Output format: `json`

## Deploy

```bash
git clone https://github.com/ryanrigneyfba/maju-ai-video-launchpad.git
cd maju-ai-video-launchpad
./deploy-aws.sh
```

Wait ~2-3 minutes. The script will:

1. Create an ECR container registry
2. Build the Docker image (Node.js + FFmpeg)
3. Push it to ECR
4. Create an App Runner service with health checks

At the end it prints:
```
Backend URL: https://xxxxxxxx.us-east-1.awsapprunner.com
```

## Connect the Dashboard

1. Open the MAJU dashboard (GitHub Pages URL)
2. Click the gear icon → **Settings**
3. Paste the Backend URL into the **Backend URL** field
4. Click **Save API Keys**
5. The status dot should turn green: **"Backend: Connected (FFmpeg ready)"**

## Redeploy After Code Changes

```bash
./deploy-aws.sh
```

## Verify It's Running

```bash
curl https://YOUR-URL.awsapprunner.com/api/health
```

Expected response:
```json
{"status": "ok", "ffmpeg": true, "jobs": 0}
```

## Cost

~$5–25/mo depending on usage. No cold starts — the backend responds immediately.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Docker not running" | Open Docker Desktop first |
| "Access denied" | Re-run `aws configure`; make sure IAM user has **AdministratorAccess** policy |
| "Service stuck creating" | Check **AWS Console → App Runner → maju-backend → Logs** |
| Dashboard says "Not connected" | Verify the URL in Settings matches the deploy output; check `/api/health` in browser |
