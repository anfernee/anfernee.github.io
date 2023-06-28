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

### How containerd persist container on file system?

This is the command to run a container
```
sudo ctr run -t docker.io/library/alpine:latest bash
```

Note that `--interactive` is removed, so you don't need to use `-i`.

After the container starts, there will be a new overlay fs mount:

```
overlay on /run/containerd/io.containerd.runtime.v2.task/default/bash/rootfs type overlay (rw,relatime,lowerdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/6/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/6/work)
```

- lowerdir is specific to OverlayFS and specifies the directory containing the lower (or base) layer of the filesystem. In the context of a container, this is typically the filesystem of the container image.
- upperdir is also specific to OverlayFS and specifies the directory containing the upper (or top) layer of the filesystem. This is a writable layer and in the context of a container, it typically contains any changes made during the runtime of the container, such as file modifications, additions or deletions.
- workdir is a working directory that is used for preparing files before they are switched to the upperdir.

In the previous case:

- lowerdir: /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1/fs
- upperdir: /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/6/fs
- workdir: /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/6/work

If you `touch xxx` in the container, it will show up in upperdir.

If you don't specify `--rm` while running the container, exiting the container won't delete the persisted snapshot.
The mount point will be unmounted though.

Running the `task` subcommand will run the previously stopped container again:

```
ctr task start bash
```
