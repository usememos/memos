# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [store/common.proto](#store_common-proto)
- [store/system_setting.proto](#store_system_setting-proto)
    - [BackupConfig](#memos-store-BackupConfig)
  
    - [SystemSettingKey](#memos-store-SystemSettingKey)
  
- [Scalar Value Types](#scalar-value-types)



<a name="store_common-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/common.proto


 

 

 

 



<a name="store_system_setting-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/system_setting.proto



<a name="memos-store-BackupConfig"></a>

### BackupConfig



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| enabled | [bool](#bool) |  | enabled indicates whether backup is enabled. |
| cron | [string](#string) |  | cron is the cron expression for backup. See https://godoc.org/github.com/robfig/cron#hdr-CRON_Expression_Format |
| max_keep | [int32](#int32) |  | max_keep is the maximum number of backups to keep. |





 


<a name="memos-store-SystemSettingKey"></a>

### SystemSettingKey


| Name | Number | Description |
| ---- | ------ | ----------- |
| SYSTEM_SETTING_KEY_UNSPECIFIED | 0 |  |
| BACKUP_CONFIG | 1 | BackupConfig is the key for auto-backup configuration. |


 

 

 



## Scalar Value Types

| .proto Type | Notes | C++ | Java | Python | Go | C# | PHP | Ruby |
| ----------- | ----- | --- | ---- | ------ | -- | -- | --- | ---- |
| <a name="double" /> double |  | double | double | float | float64 | double | float | Float |
| <a name="float" /> float |  | float | float | float | float32 | float | float | Float |
| <a name="int32" /> int32 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint32 instead. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="int64" /> int64 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint64 instead. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="uint32" /> uint32 | Uses variable-length encoding. | uint32 | int | int/long | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="uint64" /> uint64 | Uses variable-length encoding. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum or Fixnum (as required) |
| <a name="sint32" /> sint32 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int32s. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sint64" /> sint64 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int64s. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="fixed32" /> fixed32 | Always four bytes. More efficient than uint32 if values are often greater than 2^28. | uint32 | int | int | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="fixed64" /> fixed64 | Always eight bytes. More efficient than uint64 if values are often greater than 2^56. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum |
| <a name="sfixed32" /> sfixed32 | Always four bytes. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sfixed64" /> sfixed64 | Always eight bytes. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="bool" /> bool |  | bool | boolean | boolean | bool | bool | boolean | TrueClass/FalseClass |
| <a name="string" /> string | A string must always contain UTF-8 encoded or 7-bit ASCII text. | string | String | str/unicode | string | string | string | String (UTF-8) |
| <a name="bytes" /> bytes | May contain any arbitrary sequence of bytes. | string | ByteString | str | []byte | ByteString | string | String (ASCII-8BIT) |

