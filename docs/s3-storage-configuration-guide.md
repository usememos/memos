# S3-compatible Storage

## What is this?

Now _Memos_ supports storing resources in the S3-compatible third-party storage services (e.g., AWS S3, Cloudflare R2, Tencent COS) to keep lightweight of the database file.

## How to configure?

### Management of configurations

1. Click “Create” to create a new storage configuration.

   ![image-20230218164320231](https://s2.loli.net/2023/02/18/1K7l4sUwDhGa9BP.png)

2. Click to select the configuration to enable.

   ![image-20230218164456975](https://s2.loli.net/2023/02/18/XJvmawQeRcIB8Wh.png)

3. Click the name to update the configuration.

   ![image-20230218164614920](https://s2.loli.net/2023/02/18/ZBucYyi2sbmvaow.png)

4. Click “Delete” to delete the configuration.

   ![image-20230218164646196](https://s2.loli.net/2023/02/18/MaTf6lhjsSwu2n3.png)

### An example (Cloudflare R2)

First, make sure that you have a plan for R2 and have created a bucket for storing. You also need to enable the **public bucket access** and create an **API token** that allows editing operations. For more details, please refer to the [documentation of R2](https://developers.cloudflare.com/r2).

![image-20230215113853796](https://s2.loli.net/2023/02/15/WXbKmkxquz9fFOy.png)

![image-20230215113936625](https://s2.loli.net/2023/02/15/Mt8caxuYZjoN69U.png)

![image-20230215114038763](https://s2.loli.net/2023/02/15/s4ArEQx5PBRdoOC.png)

Next, instructions on how to fill in each field of the configuration are as follows:

1. Name

   A **unique** identifier

2. EndPoint

   The server URL provided by the S3 provider. It is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` in R2.

3. Region

   The region of the storing bucket. It must be set to `auto` in R2.

4. AccessKey

   A part of the API token.

5. SecretKey

   A part of the API token.

6. Bucket

   The bucket name.

7. URLPrefix

   An optional field that means the custom resource URL prefix. **But in R2, you must enable public bucket access or custom domain access, and fill in this field.**
