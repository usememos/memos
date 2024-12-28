# Chris Curry's Memos

Thanks to this amazing [project](https://github.com/usememos/memos).

Checkout [How I develop this project](https://github.com/chriscurrycc/memos/issues/8) for more details.

## How to use

```bash
docker run -d \
  --init \
  --name memos \
  --publish 5230:5230 \
  --volume ~/.memos/:/var/opt/memos \
  chriscurrycc/memos:latest
```

### Use watchtower to update the container automatically

For example, update the container automatically if there is a new version at 3:00 AM (UTC+8) every day.

```bash
docker run -d \
  --name watchtower \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  -e TZ=Asia/Shanghai \
  containrrr/watchtower \
  --schedule "0 0 3 * * *" \
  memos
```

## Contact

If you have any questions, please [contact me](mailto:hichriscurry@gmail.com).
