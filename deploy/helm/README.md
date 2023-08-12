## Install Steps
example
```shell
helm install memos .
```
use custom `namespace` example
```shell
helm install memos -n app .
```
## Persistence
Edit `values.yaml`
```yaml
persistence:
  ## If enabled is False, emptyDir will be used, data may be lost after Pod rebuild, it is recommended to use persistent volume
  enabled: false
  storageClass: "local"
  existPersistClaim: ""
  accessMode: ReadWriteOnce
  size: 10Gi
```
when `enabled` is `false` use `emptyDir`, 
1、If has created `pvc`, Please change `enabled` to `true`, and change`existPersistClaim`to your `pvc` name
2、If `enabled` is `true` but `existPersistClaim` is empty,if will create a new `pvc` by `accessMode` `storageClass`  `size`



