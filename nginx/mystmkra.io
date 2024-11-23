server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mystmkra.io;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/mystmkra.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mystmkra.io/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Reverse proxy to Node.js application
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /openai/webhook/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}


    # Serve PHP files (if needed)
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
    }

    # Deny access to .htaccess files
    location ~ /\.ht {
        deny all;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name mystmkra.io;

    if ($host = mystmkra.io) {
        return 301 https://$host$request_uri;
    } # managed by Certbot
}
