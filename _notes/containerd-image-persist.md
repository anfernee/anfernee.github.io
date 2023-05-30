### How containerd persist image on file system?

All the content downloaded from registry, including manifest, layers, configs are
persisted under this folder: `/var/lib/containerd/io.containerd.content.v1.content/blobs/sha256`,
keyed by sha258 checksum.

Snapshotter interface decides how the image is persisted on file system. There are many different
implementations for containerd:

```
# ctr plugins ls | grep snapshotter
io.containerd.snapshotter.v1          aufs                     linux/amd64    ok
io.containerd.snapshotter.v1          btrfs                    linux/amd64    skip
io.containerd.snapshotter.v1          devmapper                linux/amd64    error
io.containerd.snapshotter.v1          native                   linux/amd64    ok
io.containerd.snapshotter.v1          overlayfs                linux/amd64    ok
io.containerd.snapshotter.v1          zfs                      linux/amd64    skip
```

`overlayfs` is default snapshotter implementation.

Check your configure file to see what is the snapshotter used:

```
# /etc/containerd/config.toml
[plugins]
  [plugins."io.containerd.grpc.v1.cri"]
    snapshotter = "overlayfs"
```

#### overlayfs

TODO: continue