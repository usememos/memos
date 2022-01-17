# 使用 Docker 部署

1. 下载初始化数据库文件至本地 `~/data/memos.db`，运行命令：

   ```shell
   mkdir ~/data
   cd ~/data
   wget --no-check-certificate https://github.com/justmemos/memos/blob/main/resources/memos.db?raw=true
   ```

2. 创建并启动容器，镜像里包含所需的所有环境。只需自行 pull + run，即可完成部署：

   ```docker
   docker run --rm --pull always --name memos -p 8080:8080 -v ~/data/:/usr/local/memos/data/ -d neosmemo/memos
   ```

默认数据库内会有两个帐号，分别为 `test` 和 `guest` ，密码均为 `123456`。
