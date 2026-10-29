# Checklist App

A simple, mobile-friendly checklist app built with Next.js.

## Features

- ✅ Import lists by pasting line-by-line text
- ✅ Check/uncheck items with checkboxes
- ✅ Three tabs: Todo, Done and Trash
- ✅ Add single items by clicking the Todo tab while it's active
- ✅ Drag and drop to reorder items (in the Todo tab)
- ✅ Click completed items to move them back to Todo
- ✅ Deleted items go to Trash and can be restored
- ✅ Shared lists that sync live: open the same list on your laptop and phone, and changes on either show up on the other
- ✅ Phone link at the top of the page (the server's LAN IP plus the list ID) for opening the current list on a phone
- ✅ Lists are saved on the server (as JSON files in `data/`)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser. The URL changes to `/?list=<id>`, which is the link to this list. To use it on your phone, open the "Phone link" shown at the top of the page from a phone on the same network. Both devices then edit the same list live.

## Usage

1. **Import a list**: Paste your list items (one per line) in the textarea and click "Import List"
2. **Add an item**: Click the Todo tab while it's already selected to open the "Add New Item" dialog
3. **Check items**: Click the checkbox to mark items as complete (moves to Done tab)
4. **Reorder items**: Drag items by the handle in the Todo tab to reorder them
5. **Un-complete items**: Click any item in the Done tab to move it back to Todo
6. **Delete items**: Click the trash icon to move an item to the Trash tab. In Trash, click an item or its restore icon to bring it back
7. **Empty the trash**: The "Clear All" button in the Trash tab permanently deletes the items in Trash
8. **Start over**: Open the app with `?new=true` (e.g. `http://localhost:3000/?new=true`) to start a new, empty list. The old list is still there at its old link.

## Sharing and sync

Each list lives on the server at `data/lists/<id>.json` and has its own link, `/?list=<id>`. Anyone who opens that link sees the list and can edit it. Changes are pushed live to every open copy using Server-Sent Events. Opening the app without `?list=` takes you back to the last list you used in that browser.

There is no login. On a public server, a list is private only as long as its link stays private.

## Production Deployment

### Building for Production

1. Build the production version:
```bash
npm run build
```

This creates an optimized production build in the `.next` folder.

2. Start the production server:
```bash
npm start
```

The app will run on port 3000 by default.

### Deployment Options

#### Option 1: Using PM2 (Recommended for VPS)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Start the app with PM2:
```bash
pm2 start npm --name "checklist-app" -- start
```

3. Save PM2 configuration:
```bash
pm2 save
pm2 startup
```

4. Monitor your app:
```bash
pm2 status
pm2 logs checklist-app
```

#### Option 2: Using Docker

1. Create a `Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

2. Build and run:
```bash
docker build -t checklist-app .
docker run -p 3000:3000 checklist-app
```

**Note**: The `output: 'standalone'` in `next.config.js` creates a minimal production build that includes only necessary files.

#### Option 3: Direct Node.js

1. Set production environment:
```bash
export NODE_ENV=production
```

2. Start the app:
```bash
npm start
```

### Reverse Proxy Setup (Nginx)

Create an Nginx configuration file `/etc/nginx/sites-available/checklist`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/checklist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL/HTTPS Setup (Let's Encrypt)

1. Install Certbot:
```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

2. Obtain SSL certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

3. Certbot will automatically configure Nginx and set up auto-renewal.

### Environment Variables

Create a `.env.production` file if needed:
```env
NODE_ENV=production
PORT=3000
DATA_DIR=/var/lib/checklist
```

`DATA_DIR` is where lists are stored. It defaults to `data/` in the directory the server starts from. With the standalone build or Docker, set it to a fixed path, and in Docker mount a volume there, so lists survive redeploys.

Live sync uses Server-Sent Events. The app sends `X-Accel-Buffering: no` so that Nginx doesn't buffer the stream. With a different proxy, turn off response buffering for `/api/lists/`.

### Firewall Configuration

If using a VPS, ensure ports are open:
```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Monitoring and Maintenance

- **Check logs**: `pm2 logs checklist-app` (if using PM2)
- **Restart app**: `pm2 restart checklist-app`
- **Update app**: Pull latest code, run `npm install`, `npm run build`, then restart
- **Check status**: `pm2 status` or `curl http://localhost:3000`

### Troubleshooting

- **Port already in use**: Change port with `PORT=3001 npm start` or update Nginx config
- **Build fails**: Ensure Node.js version is 18+ (`node --version`)
- **Memory issues**: Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`

