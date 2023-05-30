
### What is the process how image is pulled from container registry?

Use `containerd` as an example. `ctr images pull` gives you a result like this:

```
# ctr images pull docker.io/library/busybox:latest
docker.io/library/busybox:latest:                                                 resolved       |++++++++++++++++++++++++++++++++++++++|
index-sha256:560af6915bfc8d7630e50e212e08242d37b63bd5c1ccf9bd4acccf116e262d5b:    done           |++++++++++++++++++++++++++++++++++++++|
manifest-sha256:5cd3db04b8be5773388576a83177aff4f40a03457a63855f4b9cbe30542b9a43: done           |++++++++++++++++++++++++++++++++++++++|
layer-sha256:325d69979d33f72bfd1d30d420b8ec7f130919916fd02238ba23e4a22d753ed8:    done           |++++++++++++++++++++++++++++++++++++++|
config-sha256:8135583d97feb82398909c9c97607159e6db2c4ca2c885c0b8f590ee0f9fe90d:   done           |++++++++++++++++++++++++++++++++++++++|
elapsed: 2.8 s                                                                    total:  2.0 Mi (732.7 KiB/s)
unpacking linux/amd64 sha256:560af6915bfc8d7630e50e212e08242d37b63bd5c1ccf9bd4acccf116e262d5b...
done: 66.994927ms
```

NOTE: In `ctr images pull`, you need to specify the whole registry path. It doesn't default to
docker hub, which is reasonable, because it's not `docker` CLI anymore. But for people who are
used to `docker pull`, it's worth mentioning that `ctr images pull busybox` won't work.

`ctr images pull` provides an option `--http-dump` which dumps the registry interaction. Let's check
the result and see what happens.



#### Step 1: resolving url

```
INFO[0000] HEAD /v2/library/busybox/manifests/latest HTTP/1.1
INFO[0000] Host: registry-1.docker.io
INFO[0000] Accept: application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json, */*
INFO[0000] User-Agent: containerd/1.6.16
INFO[0000]
docker.io/library/busybox:latest: resolving      |--------------------------------------|
```

Just like calling
```
curl -i -L https://registry-1.docker.io/v2/library/busybox/manifests/latest

HTTP/1.1 401 Unauthorized
content-type: application/json
docker-distribution-api-version: registry/2.0
www-authenticate: Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/busybox:pull"
date: Mon, 29 May 2023 20:29:57 GMT
content-length: 158
strict-transport-security: max-age=31536000
docker-ratelimit-source: 98.51.39.159

{"errors":[{"code":"UNAUTHORIZED","message":"authentication required","detail":[{"Type":"repository","Class":"","Name":"library/busybox","Action":"pull"}]}]}
```

Dockerhub returns `401 Unauthorized`, and asks the client to authenticate itself on `auth.docker.io/token`
with the scope "repository:library/busybox:pull". It's following a common OAuth 2.0 protocol.

Then the client calls `auth.docker.io` to get a bearer token
```
curl -i https://auth.docker.io/token?scope=repository%3Alibrary%2Fbusybox%3Apull&service=registry.docker.io

{"token": "xyz","expires_in":300,"issued_at":"2023-05-29T20:22:56.264068617Z"}
```

Then pass the token again to registry v2 API:
```
# curl -i -L https://registry-1.docker.io/v2/library/busybox/manifests/latest -H "Authorization: Bearer xyz"

HTTP/1.1 200 OK
...
docker-content-digest: sha256:2d8f8022682e640381ff1a54bda70b93ce6485ec9567e1eb434fd428aac85d3d
docker-distribution-api-version: registry/2.0
etag: "sha256:2d8f8022682e640381ff1a54bda70b93ce6485ec9567e1eb434fd428aac85d3d"

{
   "schemaVersion": 1,
   "name": "library/busybox",
   "tag": "latest",
   "architecture": "amd64",
   "fsLayers": [
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:325d69979d33f72bfd1d30d420b8ec7f130919916fd02238ba23e4a22d753ed8"
      }
   ],
   "history": [
      {
         "v1Compatibility": "{\"architecture\":\"amd64\",\"config\":{\"Hostname\":\"\",\"Domainname\":\"\",\"User\":\"\",\"AttachStdin\":false,\"AttachStdout\":false,\"AttachStderr\":false,\"Tty\":false,\"OpenStdin\":false,\"StdinOnce\":false,\"Env\":[\"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\"],\"Cmd\":[\"sh\"],\"Image\":\"sha256:505de91dcca928e5436702f887bbd8b81be91e719b552fb5c64e34234d22ac86\",\"Volumes\":null,\"WorkingDir\":\"\",\"Entrypoint\":null,\"OnBuild\":null,\"Labels\":null},\"container\":\"ffeefc40361ae173c8c4a1c2bad0f899f4de97601938eab16b5d019bdf2fa5f3\",\"container_config\":{\"Hostname\":\"ffeefc40361a\",\"Domainname\":\"\",\"User\":\"\",\"AttachStdin\":false,\"AttachStdout\":false,\"AttachStderr\":false,\"Tty\":false,\"OpenStdin\":false,\"StdinOnce\":false,\"Env\":[\"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\"],\"Cmd\":[\"/bin/sh\",\"-c\",\"#(nop) \",\"CMD [\\\"sh\\\"]\"],\"Image\":\"sha256:505de91dcca928e5436702f887bbd8b81be91e719b552fb5c64e34234d22ac86\",\"Volumes\":null,\"WorkingDir\":\"\",\"Entrypoint\":null,\"OnBuild\":null,\"Labels\":{}},\"created\":\"2023-05-19T20:19:22.751398522Z\",\"docker_version\":\"20.10.23\",\"id\":\"e823c37e9151f5eb323f64877b27411cc77c587d9ad3bfe36abc9bc55e7c5bff\",\"os\":\"linux\",\"parent\":\"7ec0c065cb647a60223667178492b614090db8cee8b61ab3a66630a419126df3\",\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"7ec0c065cb647a60223667178492b614090db8cee8b61ab3a66630a419126df3\",\"created\":\"2023-05-19T20:19:22.642507645Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop) ADD file:cfd4bc7e9470d1298c9d4143538a77aa9aedd74f96aa5a3262cf8714c6fc3ec6 in / \"]}}"
      }
   ],
   "signatures": [
      {
         "header": {
            "jwk": {
               "crv": "P-256",
               "kid": "V7Z4:D46Y:XW3C:OUTN:RJLO:5QM2:RM3R:6Y6Z:INJF:WZHS:KKUH:IHTI",
               "kty": "EC",
               "x": "XdKwfaR7c_4XWwp1mCsqKrL8WFNu7kjtZB_XPuMlqv0",
               "y": "ouc-Jt6noORbrtkRyM2yMCEbf7uOZnl-urfTIUsqMx0"
            },
            "alg": "ES256"
         },
         "signature": "WexUoLyK8Ia31pcNYviKgVUj-57oEJkp-oMqBOUH-FzjJB_tGHGJZkr2mKLyMhMU-bjqBO599pUIjKQzbjouIg",
         "protected": "eyJmb3JtYXRMZW5ndGgiOjIwODgsImZvcm1hdFRhaWwiOiJDbjAiLCJ0aW1lIjoiMjAyMy0wNS0yOVQyMzoyMToxMVoifQ"
      }
   ]
}
```

#### Get Manifest

```
index-sha256:560af6915bfc8d7630e50e212e08242d37b63bd5c1ccf9bd4acccf116e262d5b:    done           |++++++++++++++++++++++++++++++++++++++|
```

This requires another round of OAuth authentication to get a new bearer token

```
curl -H "Authorization: Bearer xyz" https://registry-1.docker.io/v2/library/busybox/manifests/sha256:560af6915bfc8d7630e50e212e08242d37b63bd5c1ccf9bd4acccf116e262d5b

{
  "manifests": [
    {
      "digest": "sha256:5cd3db04b8be5773388576a83177aff4f40a03457a63855f4b9cbe30542b9a43",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "amd64",
        "os": "linux"
      },
      "size": 528
    },
    {
      "digest": "sha256:bcf18ac9db3633b9029540e135774e632c738ce3717e8d4b6414a149d1aea21e",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "arm",
        "os": "linux",
        "variant": "v5"
      },
      "size": 528
    },
    {
      "digest": "sha256:810463200d4677abf3206f114c56d9f2be03cf034fcb7513e47fc32dc9eb0082",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "arm",
        "os": "linux",
        "variant": "v6"
      },
      "size": 527
    },
    {
      "digest": "sha256:521ca6b78dd745ac54932e9e22a5836b668ab23b301787f299a5d33ad5081364",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "arm",
        "os": "linux",
        "variant": "v7"
      },
      "size": 528
    },
    {
      "digest": "sha256:3be7f0919fc88e394cf86dc712cfb747f4ea29bd3e4e75508c3f53aeb2135ad7",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "arm64",
        "os": "linux",
        "variant": "v8"
      },
      "size": 528
    },
    {
      "digest": "sha256:b7d955e3db165bab168a4d222b24c9984d6777277d7419df32d3ec894cb5ef15",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "386",
        "os": "linux"
      },
      "size": 528
    },
    {
      "digest": "sha256:21808fb97631b90d4e01296d69dbc586329966f535b491ab20bd19419be689a0",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "mips64le",
        "os": "linux"
      },
      "size": 528
    },
    {
      "digest": "sha256:9226cfcbbc3fceda4909d618572110b7677bc04bfda51089f380904ecafcb45f",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "ppc64le",
        "os": "linux"
      },
      "size": 528
    },
    {
      "digest": "sha256:4b4ee25dcd28d311b8714439711df6d513cc3c2463bbd40722fca5e270b06d66",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "riscv64",
        "os": "linux"
      },
      "size": 527
    },
    {
      "digest": "sha256:bcd2e81400e5fdb7db26466458e0ebff30013cca93c2f683c76c83d5305cd87b",
      "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
      "platform": {
        "architecture": "s390x",
        "os": "linux"
      },
      "size": 528
    }
  ],
  "mediaType": "application/vnd.docker.distribution.manifest.list.v2+json",
  "schemaVersion": 2
}

```

#### Get manifest for your OS type and architecture

```
curl -H "Authorization: Bearer xyz" https://registry-1.docker.io/v2/library/busybox/manifests/sha256:5cd3db04b8be5773388576a83177aff4f40a03457a63855f4b9cbe30542b9a43

{
   "schemaVersion": 1,
   "name": "library/busybox",
   "tag": "latest",
   "architecture": "amd64",
   "fsLayers": [
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:325d69979d33f72bfd1d30d420b8ec7f130919916fd02238ba23e4a22d753ed8"
      }
   ],
   "history": [
      {
         "v1Compatibility": "{\"architecture\":\"amd64\",\"config\":{\"Hostname\":\"\",\"Domainname\":\"\",\"User\":\"\",\"AttachStdin\":false,\"AttachStdout\":false,\"AttachStderr\":false,\"Tty\":false,\"OpenStdin\":false,\"StdinOnce\":false,\"Env\":[\"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\"],\"Cmd\":[\"sh\"],\"Image\":\"sha256:505de91dcca928e5436702f887bbd8b81be91e719b552fb5c64e34234d22ac86\",\"Volumes\":null,\"WorkingDir\":\"\",\"Entrypoint\":null,\"OnBuild\":null,\"Labels\":null},\"container\":\"ffeefc40361ae173c8c4a1c2bad0f899f4de97601938eab16b5d019bdf2fa5f3\",\"container_config\":{\"Hostname\":\"ffeefc40361a\",\"Domainname\":\"\",\"User\":\"\",\"AttachStdin\":false,\"AttachStdout\":false,\"AttachStderr\":false,\"Tty\":false,\"OpenStdin\":false,\"StdinOnce\":false,\"Env\":[\"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\"],\"Cmd\":[\"/bin/sh\",\"-c\",\"#(nop) \",\"CMD [\\\"sh\\\"]\"],\"Image\":\"sha256:505de91dcca928e5436702f887bbd8b81be91e719b552fb5c64e34234d22ac86\",\"Volumes\":null,\"WorkingDir\":\"\",\"Entrypoint\":null,\"OnBuild\":null,\"Labels\":{}},\"created\":\"2023-05-19T20:19:22.751398522Z\",\"docker_version\":\"20.10.23\",\"id\":\"e823c37e9151f5eb323f64877b27411cc77c587d9ad3bfe36abc9bc55e7c5bff\",\"os\":\"linux\",\"parent\":\"7ec0c065cb647a60223667178492b614090db8cee8b61ab3a66630a419126df3\",\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"7ec0c065cb647a60223667178492b614090db8cee8b61ab3a66630a419126df3\",\"created\":\"2023-05-19T20:19:22.642507645Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop) ADD file:cfd4bc7e9470d1298c9d4143538a77aa9aedd74f96aa5a3262cf8714c6fc3ec6 in / \"]}}"
      }
   ],
   "signatures": [
      {
         "header": {
            "jwk": {
               "crv": "P-256",
               "kid": "V7Z4:D46Y:XW3C:OUTN:RJLO:5QM2:RM3R:6Y6Z:INJF:WZHS:KKUH:IHTI",
               "kty": "EC",
               "x": "XdKwfaR7c_4XWwp1mCsqKrL8WFNu7kjtZB_XPuMlqv0",
               "y": "ouc-Jt6noORbrtkRyM2yMCEbf7uOZnl-urfTIUsqMx0"
            },
            "alg": "ES256"
         },
         "signature": "WexUoLyK8Ia31pcNYviKgVUj-57oEJkp-oMqBOUH-FzjJB_tGHGJZkr2mKLyMhMU-bjqBO599pUIjKQzbjouIg",
         "protected": "eyJmb3JtYXRMZW5ndGgiOjIwODgsImZvcm1hdFRhaWwiOiJDbjAiLCJ0aW1lIjoiMjAyMy0wNS0yOVQyMzoyMToxMVoifQ"
      }
   ]
}
```

#### Get Manifest for image metadata

In console, you will the the following message:
```
index-sha256:560af6915bfc8d7630e50e212e08242d37b63bd5c1ccf9bd4acccf116e262d5b:    done           |++++++++++++++++++++++++++++++++++++++|
```

This requires another round of OAuth authentication to get a new bearer token.
The result is like below. It contains a list of file layers, and config information.
In the next steps, client will fetch those layers and configs in a similar way.

```
curl -H "Authorization: Bearer xyz" https://registry-1.docker.io/v2/library/busybox/manifests/sha256:560af6915bfc8d7630e50e212e08242d37b63bd5c1ccf9bd4acccf116e262d5b

{
  "layers": [
    {
      "digest": "sha256:8135583d97feb82398909c9c97607159e6db2c4ca2c885c0b8f590ee0f9fe90d\",
      "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
      "size": 2591575
    }
  ],
  "config": {
      "digest": "sha256:8135583d97feb82398909c9c97607159e6db2c4ca2c885c0b8f590ee0f9fe90d\",
      "mediaType": "application/vnd.docker.container.image.v1+json",
      "size": 1457,
  }
  "mediaType": "application/vnd.docker.distribution.manifest.list.v2+json",
  "schemaVersion": 2
}
```

### Get config
For docker hub, it uses cloudflare to host the content in SDN. For example, it redirect to
`https://production.cloudflare.docker.com/registry-v2/docker/registry/v2/blobs/sha256/81/8135583d97feb82398909c9c97607159e6db2c4ca2c885c0b8f590ee0f9fe90d/data?verify=1685405379-41FioLIC3jBp0E0X%2Bg7ltMswvj8%3D`

Example output:
```
{
  "architecture": "amd64",
  "config": {
    "Hostname": "",
    "Domainname": "",
    "User": "",
    "AttachStdin": false,
    "AttachStdout": false,
    "AttachStderr": false,
    "Tty": false,
    "OpenStdin": false,
    "StdinOnce": false,
    "Env": [
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    ],
    "Cmd": [
      "sh"
    ],
    "Image": "sha256:505de91dcca928e5436702f887bbd8b81be91e719b552fb5c64e34234d22ac86",
    "Volumes": null,
    "WorkingDir": "",
    "Entrypoint": null,
    "OnBuild": null,
    "Labels": null
  },
  "container": "ffeefc40361ae173c8c4a1c2bad0f899f4de97601938eab16b5d019bdf2fa5f3",
  "container_config": {
    "Hostname": "ffeefc40361a",
    "Domainname": "",
    "User": "",
    "AttachStdin": false,
    "AttachStdout": false,
    "AttachStderr": false,
    "Tty": false,
    "OpenStdin": false,
    "StdinOnce": false,
    "Env": [
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    ],
    "Cmd": [
      "/bin/sh",
      "-c",
      "#(nop) ",
      "CMD [\"sh\"]"
    ],
    "Image": "sha256:505de91dcca928e5436702f887bbd8b81be91e719b552fb5c64e34234d22ac86",
    "Volumes": null,
    "WorkingDir": "",
    "Entrypoint": null,
    "OnBuild": null,
    "Labels": {}
  },
  "created": "2023-05-19T20:19:22.751398522Z",
  "docker_version": "20.10.23",
  "history": [
    {
      "created": "2023-05-19T20:19:22.642507645Z",
      "created_by": "/bin/sh -c #(nop) ADD file:cfd4bc7e9470d1298c9d4143538a77aa9aedd74f96aa5a3262cf8714c6fc3ec6 in / "
    },
    {
      "created": "2023-05-19T20:19:22.751398522Z",
      "created_by": "/bin/sh -c #(nop)  CMD [\"sh\"]",
      "empty_layer": true
    }
  ],
  "os": "linux",
  "rootfs": {
    "type": "layers",
    "diff_ids": [
      "sha256:9547b4c33213e630a0ca602a989ecc094e042146ae8afa502e1e65af6473db03"
    ]
  }
}
```

#### Get Layers

Similar to previous config, layers are streamed down to containerd as tar.gz format.