<div align="center">

<img height="96px" src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/logo-rounded.png" alt="Memos" />

# Memos

**A privacy-first, lightweight note-taking service**

Write, organize, and own your knowledge

[![Home](https://img.shields.io/badge/🏠-usememos.com-blue?style=flat-square)](https://www.usememos.com)
[![Live Demo](https://img.shields.io/badge/✨-Try%20Demo-orange?style=flat-square)](https://demo.usememos.com/)
[![Docs](https://img.shields.io/badge/📚-Documentation-green?style=flat-square)](https://www.usememos.com/docs)
[![Discord](https://img.shields.io/badge/💬-Discord-5865f2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/tfPJa4UmAv)
[![Docker Pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)

### 💎 Sponsored By

<a href="https://go.warp.dev/memos" target="_blank" rel="noopener">
  <img src="https://raw.githubusercontent.com/warpdotdev/brand-assets/main/Github/Sponsor/Warp-Github-LG-02.png" alt="Warp - The terminal for the 21st century" height="200" />
</a>

**[Warp](https://go.warp.dev/memos)** — The AI-powered terminal built for speed and collaboration

![screenshot](https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png)

</div>

## 🎯 Why Memos?

**Your thoughts. Your data. Your control.**

Memos is an open-source, self-hosted alternative to cloud note-taking services. No tracking, no ads, no subscription fees — just a clean, fast way to capture and organize your ideas.

- 🔒 **Privacy by design** — All data stays on your server
- ⚡ **Lightning fast** — Built with Go and React for speed
- 📝 **Markdown native** — Write naturally with full markdown support
- 🐳 **Deploy in seconds** — One Docker command to get started
- 🎨 **Beautiful & minimal** — Focus on your thoughts, not the UI
- 🔗 **API-first** — Integrate with your workflow seamlessly

## 🚀 Quick Start

Get up and running in **under 30 seconds**:
```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Open `http://localhost:5230` and start writing! 🎉

**Need more options?** Check out our [installation guide](https://www.usememos.com/docs/installation) for Docker Compose, binaries, and building from source.

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔐 Privacy First
- Self-hosted on your infrastructure
- No telemetry or tracking
- Full data ownership
- Export anytime

### 📱 Modern Experience
- Clean, intuitive interface
- Mobile-responsive design
- Real-time updates
- Dark mode support

</td>
<td width="50%">

### 🛠️ Developer Friendly
- RESTful API
- SQLite, PostgreSQL, MySQL support
- Easy to deploy and scale
- Extensive documentation

### 🌍 Open Source
- MIT licensed
- Active community
- Regular updates
- Transparent development

</td>
</tr>
</table>

## 💡 Perfect For

- 📓 **Personal journaling** — Daily thoughts and reflections
- 🧠 **Knowledge management** — Build your second brain
- 📋 **Quick notes** — Capture ideas on the go
- 🔗 **Link collections** — Save and organize useful resources
- 👥 **Team wikis** — Collaborative knowledge bases
- 🎓 **Learning logs** — Document your learning journey

## 💖 Support Memos

Love Memos? Help us keep it growing!

<a href="https://github.com/sponsors/usememos" target="_blank">
  <img src="https://img.shields.io/badge/❤️_Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github-sponsors&logoColor=white" alt="Sponsor on GitHub">
</a>

**Community Sponsors:**

<a href="https://github.com/yourselfhosted" target="_blank"><img src="https://avatars.githubusercontent.com/u/140182318?v=4" alt="yourselfhosted" height="50" style="border-radius: 50%; margin: 5px;" /></a>
<a href="https://github.com/fixermark" target="_blank"><img src="https://avatars.githubusercontent.com/u/169982?v=4" alt="fixermark" height="50" style="border-radius: 50%; margin: 5px;" /></a>
<a href="https://github.com/alik-agaev" target="_blank"><img src="https://avatars.githubusercontent.com/u/2662697?v=4" alt="alik-agaev" height="50" style="border-radius: 50%; margin: 5px;" /></a>

*Every contribution, big or small, makes a difference!*

## 🤝 Contributing

We love contributions! Whether you're fixing bugs, adding features, improving docs, or spreading the word — every contribution matters.

**Get involved:**
- 🐛 [Report bugs](https://github.com/usememos/memos/issues/new?template=bug_report.md)
- 💡 [Suggest features](https://github.com/usememos/memos/issues/new?template=feature_request.md)
- 🔧 [Submit pull requests](https://github.com/usememos/memos/pulls)
- 📖 [Improve documentation](https://github.com/usememos/memos/tree/main/docs)
- 🌍 [Help with translations](https://github.com/usememos/memos/tree/main/web/src/locales)

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

---

<div align="center">

**[Website](https://www.usememos.com)** • 
**[Documentation](https://www.usememos.com/docs)** • 
**[Demo](https://demo.usememos.com/)** • 
**[Discord](https://discord.gg/tfPJa4UmAv)** • 
**[Twitter](https://twitter.com/usememos)**

Made with ❤️ by the Memos community

**If you like Memos, give us a ⭐ on GitHub!**

</div>
