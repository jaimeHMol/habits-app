#!/bin/bash
set -e

# Ensure script is executed as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script with superuser privileges (e.g. sudo bash setup-ssl-hooks.sh)"
  exit 1
fi

echo "=== [1/5] Stopping Nginx container to free port 80 ==="
docker stop $(docker ps -q --filter "ancestor=nginx:stable-alpine") 2>/dev/null || true

echo "=== [2/5] Renewing SSL certificates with Certbot ==="
certbot renew

echo "=== [3/5] Starting Nginx container ==="
docker start $(docker ps -a -q --filter "ancestor=nginx:stable-alpine") 2>/dev/null || true

echo "=== [4/5] Installing automated renewal hooks in /etc/letsencrypt ==="
mkdir -p /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post

cat << 'EOF' > /etc/letsencrypt/renewal-hooks/pre/01-stop-nginx.sh
#!/bin/bash
/usr/bin/docker stop $(/usr/bin/docker ps -q --filter "ancestor=nginx:stable-alpine") 2>/dev/null || true
EOF

cat << 'EOF' > /etc/letsencrypt/renewal-hooks/post/01-start-nginx.sh
#!/bin/bash
/usr/bin/docker start $(/usr/bin/docker ps -a -q --filter "ancestor=nginx:stable-alpine") 2>/dev/null || true
EOF

chmod +x /etc/letsencrypt/renewal-hooks/pre/01-stop-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/post/01-start-nginx.sh

echo "=== [5/5] Testing automated renewal simulation (--dry-run) ==="
certbot renew --dry-run

echo ""
echo "Success: SSL certificates renewed and automatic hooks successfully configured."
