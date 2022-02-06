# Deploy `memos` with Docker

1. download the initialized db file:

   ```shell
   mkdir ~/data
   cd ~/data
   wget --no-check-certificate https://github.com/justmemos/memos/blob/main/resources/memos-release.db?raw=true
   ```

2. pull and run docker image:

   ```docker
   docker run --name memos --restart always --publish 8080:8080 --volume ~/path/to/your/data/:/var/opt/memos/ neosmemo/memos:next -mode release
   ```

The default user account is `guest` with password `secret`.
