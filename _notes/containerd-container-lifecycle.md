
```
# systemd-cgls
...
  ├─containerd.service
  │ ├─  1541 /usr/bin/containerd
  │ ├─  4221 /usr/bin/containerd-shim-runc-v2 -namespace moby -id d64d0d6043716abdfbf0a0b71f522b34e2f3dcb293945b80430c41a55f157e46 -address /run/containerd/containerd.sock
  │ └─569107 /usr/bin/containerd-shim-runc-v2 -namespace default -id bash -address /run/containerd/containerd.sock
```

You can see from previous result, that `/usr/bin/containerd-shim-runc-v2` uses `-namespace` to differentiate
who calls it. `moby` is for docker, `default` is for `ctr`, also `k8s.io` is for kubernetes.

```
# sudo ctr t pause bash
# ps aux
root      569129  0.0  0.0   1700  1096 pts/0    Ds+  23:30   0:00 /bin/sh
sudo ctr t resume bash
ps aux
root      569129  0.0  0.0   1700  1096 pts/0    Ss+  23:30   0:00 /bin/sh
```

