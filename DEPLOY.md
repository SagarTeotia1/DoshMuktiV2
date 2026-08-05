# Deploying to a single GCP VM

One Docker image, three Node processes (Backend :4000, Frontend :3000, Admin :3001), nginx in front routing by domain. Runs on one Compute Engine VM.

## 1. VM sizing

| Tier | Machine type | vCPU | RAM | When |
|---|---|---|---|---|
| Minimum (staging/low traffic) | `e2-small` | 2 | 2 GB | Testing the deploy, <50 orders/day |
| **Recommended (launch)** | `e2-medium` | 2 | 4 GB | 100–1,000 orders/day (this repo's actual target — see `docs/SCALE.md`) |
| Scale-up | `e2-standard-4` | 4 | 8 GB | Sustained high traffic, ad campaigns, or if you see CPU throttling |

Why 4 GB at minimum for the recommended tier: three Node runtimes (Fastify + two Next.js standalone servers) plus nginx plus the Prisma query-engine binary comfortably sit around 700 MB–1.2 GB combined at idle, and Next.js SSR under load spikes per-request memory — 2 GB leaves no headroom and will swap. Disk: 20–30 GB standard persistent disk is plenty (the image itself is small; Postgres/Redis are managed externally on Neon/Upstash, not on this VM).

## 2. Create the VM

```bash
gcloud compute instances create doshmukti-vm \
  --machine-type=e2-medium \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --tags=http-server,https-server

gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443 \
  --target-tags=http-server,https-server
```

Point DNS `A` records for `doshmukti.com`, `www.doshmukti.com`, `api.doshmukti.com`, `admin.doshmukti.com` at the VM's external IP.

## 3. Install Docker on the VM

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# re-login for the group change to take effect
```

## 4. Build and push the image

From your machine (or a CI runner) with the repo checked out:

```bash
docker build \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://api.doshmukti.com \
  -t doshmukti:latest .

# tag + push to Artifact Registry (or Docker Hub)
docker tag doshmukti:latest asia-south1-docker.pkg.dev/YOUR_PROJECT/doshmukti/app:latest
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT/doshmukti/app:latest
```

## 5. Issue TLS certificates (once, before first container start)

Certs are issued on the **host**, then mounted read-only into the container — nginx inside the container never talks to Let's Encrypt directly, which keeps renewal simple (stop container → renew → start container, no cert-handling code in the image).

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone \
  -d doshmukti.com -d www.doshmukti.com \
  -d api.doshmukti.com \
  -d admin.doshmukti.com
# certs land in /etc/letsencrypt/live/<domain>/
```

Renewal (cron, since port 80 is briefly needed by certbot standalone mode):

```bash
# /etc/cron.d/certbot-renew
0 3 * * * root docker stop doshmukti-app && certbot renew --standalone && docker start doshmukti-app
```

## 6. Run the container

```bash
docker pull asia-south1-docker.pkg.dev/YOUR_PROJECT/doshmukti/app:latest

docker run -d \
  --name doshmukti-app \
  --restart unless-stopped \
  -p 80:80 -p 443:443 \
  --env-file Backend/.env \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  asia-south1-docker.pkg.dev/YOUR_PROJECT/doshmukti/app:latest
```

`--env-file Backend/.env` supplies every Backend secret (`DATABASE_URL`, `JWT_SECRET`, `RAZORPAY_*`, `MSG91_*`, etc — see `Backend/.env.example`) at container runtime, not baked into the image. `NEXT_PUBLIC_BACKEND_URL` for Frontend/Admin is already baked in at build time via `--build-arg` in step 4, since Next.js inlines `NEXT_PUBLIC_*` vars during `next build`.

Before running, set in `Backend/.env`:
```
FRONTEND_ORIGIN=https://doshmukti.com
ADMIN_ORIGIN=https://admin.doshmukti.com
```
(CORS is keyed off these — see `Backend/src/app.ts`.)

On first boot the container runs `prisma migrate deploy` automatically (set `-e RUN_MIGRATIONS=false` to skip, e.g. if you run migrations separately in CI before rolling out).

## 7. Deploying a new version

```bash
docker pull asia-south1-docker.pkg.dev/YOUR_PROJECT/doshmukti/app:latest
docker stop doshmukti-app && docker rm doshmukti-app
docker run -d --name doshmukti-app --restart unless-stopped \
  -p 80:80 -p 443:443 --env-file Backend/.env \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  asia-south1-docker.pkg.dev/YOUR_PROJECT/doshmukti/app:latest
```

Brief downtime during the swap (single-container, single-VM — there's no rolling update here). For zero-downtime deploys later, this is the point to move to two VMs behind a load balancer, or to Cloud Run per-service.

## Notes

- Postgres (Neon) and Redis (Upstash) are managed/external — nothing to provision on the VM for them.
- If any of the three Node processes crashes, `entrypoint.sh` brings the whole container down so Docker's `--restart unless-stopped` cleanly restarts everything — a half-dead container (e.g. Backend down but nginx still serving Frontend) is worse than a visibly failed one.
- This setup is one VM, one point of failure. Fine for the current 100–1,000 orders/day target; re-evaluate before the next order-of-magnitude traffic jump (see `docs/SCALE.md`).
