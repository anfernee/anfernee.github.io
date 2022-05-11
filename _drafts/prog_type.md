---
layout: post
title: 'ebpf: introduction to program and map'
date: 2022-05-10
categories: ebpf kernel program
---

## eBPF Program

### eBPF intructions

eBPF has a simple instruction set that is supported by Linux kernel. Once eBPF
program is loaded into kernel, kernel also attaches it to a certain event, and
call it back when the event happens. It's pretty similar to java and JVM, where
your .java code is compiled into .class file as bytecode, which is eventually
executed in JVM. In eBPF, your .c code is compiled into .o file as bytecode,
which is executed in kernel. The only difference is the kernel cannot yield
itself and run the eBPF bytecode for a long time, because it is KERNEL and
running eBPF bytecode is just a "part time" job.

```
        javac              java
.java =========> .class ==========> JVM

       llvm             bpf(syscall)
.c ===========> .o ==================> kernel
```


### Program limitation

We know that eBPF program can be loaded into kernel and do a lot of powerful
stuffs efficiently, including packet filtering, kprobes etc. Because the
program runs inside kernel, kernel imposes limitations to the program, so
that kernel knows it can be trusted and run safely. It's so conservative, so
that for a very long time, even loops are not allowed in eBPF programs, util
[v5.3](https://git.kernel.org/pub/scm/linux/kernel/git/netdev/net-next.git/commit/?id=2589726d12a1b12eaaa93c7f1ea64287e383c7a5) the loop restriction is removed.


### Program type and attach type

Depending on the different purpose of eBPF program, there are different program
types. Which program types are supported depends on the kernel version. Because
eBPF is kept evolving, the types of eBPF program might vary from one kernel
version to another. The following is the supported program type in
[5.18](https://elixir.bootlin.com/linux/v5.18-rc6/source/include/uapi/linux/bpf.h#L880).
Programmer needs to decide the program type when they load the program into kernel.

```
enum bpf_prog_type {
	BPF_PROG_TYPE_UNSPEC,
	BPF_PROG_TYPE_SOCKET_FILTER,
	BPF_PROG_TYPE_KPROBE,
	BPF_PROG_TYPE_SCHED_CLS,
	BPF_PROG_TYPE_SCHED_ACT,
	BPF_PROG_TYPE_TRACEPOINT,
	BPF_PROG_TYPE_XDP,
	BPF_PROG_TYPE_PERF_EVENT,
	BPF_PROG_TYPE_CGROUP_SKB,
	BPF_PROG_TYPE_CGROUP_SOCK,
	BPF_PROG_TYPE_LWT_IN,
	BPF_PROG_TYPE_LWT_OUT,
	BPF_PROG_TYPE_LWT_XMIT,
	BPF_PROG_TYPE_SOCK_OPS,
	BPF_PROG_TYPE_SK_SKB,
	BPF_PROG_TYPE_CGROUP_DEVICE,
	BPF_PROG_TYPE_SK_MSG,
	BPF_PROG_TYPE_RAW_TRACEPOINT,
	BPF_PROG_TYPE_CGROUP_SOCK_ADDR,
	BPF_PROG_TYPE_LWT_SEG6LOCAL,
	BPF_PROG_TYPE_LIRC_MODE2,
	BPF_PROG_TYPE_SK_REUSEPORT,
	BPF_PROG_TYPE_FLOW_DISSECTOR,
	BPF_PROG_TYPE_CGROUP_SYSCTL,
	BPF_PROG_TYPE_RAW_TRACEPOINT_WRITABLE,
	BPF_PROG_TYPE_CGROUP_SOCKOPT,
	BPF_PROG_TYPE_TRACING,
	BPF_PROG_TYPE_STRUCT_OPS,
	BPF_PROG_TYPE_EXT,
	BPF_PROG_TYPE_LSM,
	BPF_PROG_TYPE_SK_LOOKUP,
	BPF_PROG_TYPE_SYSCALL, /* a program that can execute syscalls */
};
```

Programmer also needs to decide the attach type when they attach their program to
a hook/event. The follwing is the supported attach type in
[v5.18](https://elixir.bootlin.com/linux/v5.18-rc6/source/include/uapi/linux/bpf.h#L957)

```
enum bpf_attach_type {
	BPF_CGROUP_INET_INGRESS,
	BPF_CGROUP_INET_EGRESS,
	BPF_CGROUP_INET_SOCK_CREATE,
	BPF_CGROUP_SOCK_OPS,
	BPF_SK_SKB_STREAM_PARSER,
	BPF_SK_SKB_STREAM_VERDICT,
	BPF_CGROUP_DEVICE,
	BPF_SK_MSG_VERDICT,
	BPF_CGROUP_INET4_BIND,
	BPF_CGROUP_INET6_BIND,
	BPF_CGROUP_INET4_CONNECT,
	BPF_CGROUP_INET6_CONNECT,
	BPF_CGROUP_INET4_POST_BIND,
	BPF_CGROUP_INET6_POST_BIND,
	BPF_CGROUP_UDP4_SENDMSG,
	BPF_CGROUP_UDP6_SENDMSG,
	BPF_LIRC_MODE2,
	BPF_FLOW_DISSECTOR,
	BPF_CGROUP_SYSCTL,
	BPF_CGROUP_UDP4_RECVMSG,
	BPF_CGROUP_UDP6_RECVMSG,
	BPF_CGROUP_GETSOCKOPT,
	BPF_CGROUP_SETSOCKOPT,
	BPF_TRACE_RAW_TP,
	BPF_TRACE_FENTRY,
	BPF_TRACE_FEXIT,
	BPF_MODIFY_RETURN,
	BPF_LSM_MAC,
	BPF_TRACE_ITER,
	BPF_CGROUP_INET4_GETPEERNAME,
	BPF_CGROUP_INET6_GETPEERNAME,
	BPF_CGROUP_INET4_GETSOCKNAME,
	BPF_CGROUP_INET6_GETSOCKNAME,
	BPF_XDP_DEVMAP,
	BPF_CGROUP_INET_SOCK_RELEASE,
	BPF_XDP_CPUMAP,
	BPF_SK_LOOKUP,
	BPF_XDP,
	BPF_SK_SKB_VERDICT,
	BPF_SK_REUSEPORT_SELECT,
	BPF_SK_REUSEPORT_SELECT_OR_MIGRATE,
	BPF_PERF_EVENT,
	BPF_TRACE_KPROBE_MULTI,
	__MAX_BPF_ATTACH_TYPE
};
```

In [libbpf](https://github.com/libbpf/libbpf)

## eBPF map

### What is eBPF map?
Once eBPF program is loaded into kernel, it does certain things.

On a trigger

does it interact with user input, or generate output for user to consume,
or interact with another eBPF program? The answer is eBPF map. It is the
main mechanism for I/O and IPC for eBPF programs.

There are 2 main interfaces to interact with eBPF map, helper functions for
eBPF programs running inside kernel, and syscall for programs in user space.
Both allow basic CRUD and iteration operations on eBPF map.

### Map types

eBPF map is the main mechanism for

https://elixir.bootlin.com/linux/v5.18-rc6/source/include/uapi/linux/bpf.h#L880

### User space

```
int bpf(int cmd, union bpf_attr *attr, unsigned int size);
```

The `cmd` specifies the eBPF operation to commit. It could be load an eBPF
program to kernel, or eBPF map operations. The operations include:

- `BPF_MAP_CREATE`
- `BPF_MAP_LOOKUP_ELEM`
- `BPF_MAP_UPDATE_ELEM`
- `BPF_MAP_DELETE_ELEM`
- `BPF_MAP_GET_NEXT_KEY`

The operations include CRUD and also the operation to implement iterator
(`BPF_MAP_GET_NEXT_KEY`).

### eBPF type
