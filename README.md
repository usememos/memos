<h1 align="center">
  ✍️ Memos
</h1>
<p align="center">
  <a href="https://github.com/justmemos/memos/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/justmemos/memos"></a>
  <a href="https://github.com/justmemos/memos/network"><img alt="GitHub forks" src="https://img.shields.io/github/forks/justmemos/memos"></a>
  <a href="https://github.com/justmemos/memos/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/justmemos/memos"></a>
  <a href="https://github.com/justmemos/memos/blob/main/LICENSE"><img alt="GitHub license" src="https://img.shields.io/github/license/justmemos/memos"></a>
</p>
<p align="center">
  <a href="https://memos.onrender.com/"> Demo </a> •
  <a href="https://t.me/+M-AqruZmJBhkYWQ1">Telegram 群组</a> 
</p>


Memos 是一款开源的 flomo 替代工具。/ An open-source alternative to flomo.

您可以很方便快捷的私有化部署出属于您自己的碎片化知识管理工具！

## 为何做这个？

### 用于记录：
- 📅 每日/周计划、💡突发奇想、📕读后感...
- 🏗️ 代替了我在微信上经常使用的“文件传输助手”；
- 📒 打造一个属于自己的轻量化“卡片”笔记簿；

### 有何特点呢？
- ✨ 开源项目；
- 😋 精美且细节的视觉样式；
- 📑 体验优良的交互逻辑；
- ⚡ 快速部署
- 🚀 目前正在全力开发中，更多特性陆续公布...

## 使用Docker部署

一、下载数据库文件至本地 `~/data/memos.db`，运行命令。

```
mkdir ~/data
cd ~/data
wget --no-check-certificate https://github.com/justmemos/memos/blob/main/resources/memos.db?raw=true 
```

二、创建并启动容器，镜像里包含所需的所有环境。只需自行 pull + run，即可完成部署。
```
docker run --rm --pull always --name memos -p 8080:8080 -v ~/data/:/usr/local/memos/data/ -d neosmemo/memos
```

! 默认数据库内会有两个帐号，分别为 `test` 和 `guest` ，密码均为 `123456` ，**部署完成后请及时更改你的密码**

enjoy!
