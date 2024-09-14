<img height="56px" src="https://www.usememos.com/full-logo-landscape.png" alt="Memos" />

A privacy-first, lightweight note-taking service. Easily capture and share your great thoughts.

<a href="https://www.usememos.com">Home Page</a> •
<a href="https://www.usememos.com/blog">Blogs</a> •
<a href="https://www.usememos.com/docs">Docs</a> •
<a href="https://demo.usememos.com/">Live Demo</a>

<p>
  <a href="https://hub.docker.com/r/neosmemo/memos"><img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg"/></a>
  <a href="https://discord.gg/tfPJa4UmAv"><img alt="Discord" src="https://img.shields.io/badge/discord-chat-5865f2?logo=discord&logoColor=f5f5f5" /></a>
</p>

![demo](https://www.usememos.com/demo.png)

## Key points

- **Open source and free to use**. Embrace a future where creativity knows no boundaries with our open-source solution. All features are free to use and will never be charged in any form or content.
- **Self-hosting with Docker in just seconds**. Enjoy the flexibility, scalability, and ease of setup that Docker provides, allowing you to have full control over your data and privacy.
- **Pure text with added Markdown support.** Say goodbye to the overwhelming mental burden of rich formatting and embrace a minimalist approach.
- **Customize and share your notes effortlessly**. With our intuitive sharing features, you can easily collaborate and distribute your notes with others.
- **RESTful API for third-party services.** Embrace the power of integration and unleash new possibilities with our RESTful API support.

## Deploy with Docker in seconds

```bash
docker run -d --name memos -p 5230:5230 -v ~/.memos/:/var/opt/memos neosmemo/memos:stable
```

> [!NOTE]
> This command is only applicable for Unix/Linux systems. For Windows, please refer to the detailed [documentation](https://www.usememos.com/docs/install/container-install#docker-on-windows).
>
> The `~/.memos/` directory will be used as the data directory on your local machine, while `/var/opt/memos` is the directory of the volume in Docker and should not be modified.

Learn more about [other installation methods](https://www.usememos.com/docs/install).

## Deploy under a subdirectory of the domain

1. If you want to deploy memos to a subdirectory, you need to configure base-url (via environment variables or parameters when executing memos).
For example, if you want to deploy memos in the /memos subdirectory of the domain, run the following command(memos is installed in /usr/local/bin):
```bash
MEMOS_MODE="prod" MEMOS_PORT=5230 /usr/local/bin/memos --base-url /memos
```
or
```bash
MEMOS_MODE="prod" MEMOS_PORT=5230 MEMOS_BASE_URL=/memos /usr/local/bin/memos
```

2. nginx need add config item, like this:
```
location ^~ /memos/ {
    # Note: The reverse proxy backend URL needs to have a path symbol at the end
    proxy_pass http://127.0.0.1:5230/;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header REMOTE-HOST $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr; # Set the request source address
    proxy_set_header X-Forwarded-Proto $scheme; # Set Http protocol
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    add_header X-Cache $upstream_cache_status;
    add_header Cache-Control no-cache;
} 
```

Of course, there is a slight requirement when compiling the memos frontend. You need to execute the sed command to modify the index.html of the frontend after compiling the frontend (the corresponding command is already included in the Makefile).
```bash
sed -i "s|<script type=\"module\" crossorigin src=\"|&{{ .baseurl }}|g"   ./web/dist/index.html
sed -i "s|<link rel=\"stylesheet\" crossorigin href=\"|&{{ .baseurl }}|g" ./web/dist/index.html
```

## Contribution

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. We greatly appreciate any contributions you make. Thank you for being a part of our community! 🥰

## Sponsorship

If you find Memos helpful, please consider sponsoring us. Your support will help us to continue developing and maintaining the project.

❤️ Thanks to the following sponsors and backers: **[yourselfhosted](https://github.com/yourselfhosted)**, **[Burning_Wipf](https://github.com/KUKARAF)**, _[...see more](https://github.com/sponsors/usememos)_.

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

## Other projects

- [**Slash**](https://github.com/yourselfhosted/slash): An open source, self-hosted bookmarks and link sharing platform. Save and share your links very easily.
- [**Gomark**](https://github.com/usememos/gomark): A markdown parser written in Go for Memos. And its [WebAssembly version](https://github.com/usememos/gomark-wasm) is also available.
