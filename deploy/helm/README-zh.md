## 安装方式
示例
```shell
helm install memos .
```
指定`namespace`示例
```shell
helm install memos -n app .
```
## 自定义存储
修改`values.yaml`
```yaml
persistence:
  ## 如果enabled 为False, 会使用emptyDir, Pod 重建后数据可能丢失, 建议使用持久卷
  enabled: false
  storageClass: "local"
  existPersistClaim: ""
  accessMode: ReadWriteOnce
  size: 10Gi
```
`enabled` 是 `false` 时默认使用`emptyDir`

1、如果有已创建的`pvc`, 请修改`enabled`为`true`, 并修改`existPersistClaim`为`pvc`的名字
2、如果`enabled`为`true`但`existPersistClaim`为空,根据`accessMode`、`storageClass`、`size`创建pvc



