---
layout: post
title: 'Getting started with libbpf-bootstrap'
date: 2022-04-24
categories: epbf linux
---

Recent years, one of my side project is to enable a Kubernetes network solution
[cilium](https://cilium.io) in GKE. cilium is built on top of
[ebpf](https://epbf.io), a super cool technology. During the process, I was able
to learn a lot from the amazing engineers from cilium community, like tgraf@,
joestringer@, borkmann@, pchaigno@ and a lot more.


Recently, I am thinking I should dig deeper into the ebpf, because it's so
powerful tool, and it's growing very fast. One of the first building block is
[libbpf](https://github.com/libbpf/libbpf), which is a library to help programmer
to write an ebpf application, and also
[libbpf-bootstrap](https://github.com/libbpf/libbpf-bootstrap) which helps you
to bootstrap a libbpf based application. This post will try to summarize how to
use libbpf-bootstrap to write your first ebpf program.


## Prepare

First of all, clone `libbpf-bootstrap`

```bash
git clone git@github.com:libbpf/libbpf-bootstrap.git --recursive
```

`libbpf-bootstrap` includes 2 submodules, `libbpf` and `bpftool`. `libbpf`
is the library that your ebpf application is built on top of. `bpftool`
is the CLI tool that talks directly to kernel and does all kinds of operations.

There is also an `examples` folder, in which contains some example C programs
and rust programs (Yes, rust!). Today we are going through the C programs.
Hopefully we have a chance to write about the `rust` programs as well.

## Build

Building the example application is C is very simple, simply go to `examples/c`
folder and run `make`. You will notice that each binary has 2 C files: `*.c` and
`*.bpf.c`. `.bpf.c` file is the ebpf program that is compiled into `.bpf.o` and
loaded into kernel. `.c` file is the file that runs in user space that loads the
ebpf program into the kernel and collect the result from the program.


## Example (minimal)

Let's go through the minimal possible ebpf application: minimal.

### BPF C code (minimal.bpf.c)

`minimal.bpf.c` is the program you want to load into kernel. It's normally
where most people start with. It has the following sections:

1. Headers

First of all, include the kernel headers.

```c
#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
```

2. License and other globals

Define the license for the program. It has to be either GPL or some dual license
including GPL, otherwise kernel [won't accept](https://elixir.bootlin.com/linux/v4.17/source/include/linux/module.h#L171)
the ebpf program.

```c
char LICENSE[] SEC("license") = "Dual BSD/GPL";

int my_pid = 0;
```

`my_pid` is the user space process pid, which will be assigned later.

3. Section

Section name determines how `libbpf` load and attach the ebpf program.

```c
SEC("tp/syscalls/sys_enter_write")
```

For example, previous section name tells the `libbpf`. It's a tracepoint for
event syscall `sys_enter_write`. It means every time kernel enters a syscall
`write`, this function defined after this section will be triggered. Similarly
there is a `sys_exit_write`, which defines the function that gets called before
kernel exits syscall `write`. For the full list of all the tracepoint supported
on the Linux machine, check `/sys/kernel/debug/tracing/events` on filesystem.
For example, you can `cat /sys/kernel/debug/tracing/events/syscalls/sys_enter_write/format` to understand the format.

Of course, tracepoint is only one type of section supported by eBPF, for the
full list, check [libbpf](https://github.com/libbpf/libbpf/blob/533c7666eb728e289abc2e6bf9ecf1186051d7d0/src/libbpf.c#L8674).

4. Function

Define the callback function. It could be called when a packet is received
on a network interface, a syscall is called, a syscall is returned. In this
case, it's called when syscall `sys_write` is called.

```c
int handle_tp(void *ctx)
{
    int pid = bpf_get_current_pid_tgid() >> 32;

    if (pid != my_pid)
        return 0;

    bpf_printk("BPF triggered from PID %d.\n", pid);

    return 0;
}
```

The previous simple command simply calls a bpf helper function
`bpf_get_current_pid_tgid()` to get the current pid. Compare with a global
variable. If it matches, call another bpf helper function to print a string
to debug console. The debug console is `/sys/kernel/debug/tracing/trace_pipe`.


Finally this program will be compiled into `minimal.bpf.o`. It will also
generate a `minimal.skel.h` which will be included by user space program.

### User space C code (minimal.c)

User space C code is responsible to load the ebpf byte code into kernel, and
attach it to a "resource". The resource could be a network interface, cgroup,
tracepoint or others, depending on the program type and attach type. In this
example, it's a tracepoint for syscall `sys_enter_write`.

The example program contains the following typical sections:

1. Headers

```c
#include <bpf/libbpf.h>
#include "minimal.skel.h"
```

One of the header file is from libbpf: `bpf/libbpf.h`. The other file is a
skeleton header file that is auto generated from `minimal.bpf.o`. There is
a `Makefile` target that does `bpftool gen skeleton .output/minimal.bpf.o > .output/minimal.skel.h`.

2. Initialization

```c
    struct minimal_bpf *skel;

    libbpf_set_strict_mode(LIBBPF_STRICT_ALL);
    /* Set up libbpf errors and debug info callback */
    libbpf_set_print(libbpf_print_fn);
```

Then define the skeleton struct, as well as some global configurations.

3. Open

Open skeleton allocates memory and initialize the scheleton struct.

```c
    skel = minimal_bpf__open();
```

After open, it does an additional step to set `my_pid` as its own pid.
```c
    /* ensure BPF program only handles write() syscalls from our process */
    skel->bss->my_pid = getpid();
```

3. Load

```c
err = minimal_bpf__load(skel);
```

This calls `sys_bpf` to load the program into kernel space. Kernel space will
load and verify the ebpf program. Verifier is another big topic for eBPF. A lot
of improvements in kernel have been made to make it more reliable and efficient.

4. Attach

```c
err = minimal_bpf__attach(skel);
```

As previously said, attach it to a "resource". In this example, it's a
tracepoint for syscall `sys_enter_write`.

5. Loop

```c
    for (;;) {
        /* trigger our BPF program */
        fprintf(stderr, ".");
        sleep(1);
    }
```

The loop makes sure the program keeps running.

6. Cleanup

```c
minimal_bpf__destroy(skel);
```

Cleanup epbf resources before exiting the user space program.


## Executing

Executing the command gives me the following output on console.

```
$ sudo ./minimal
[sudo] password for anfernee:
libbpf: loading object 'minimal_bpf' from buffer
libbpf: elf: section(3) tp/syscalls/sys_enter_write, size 104, link 0, flags 6, type=1
libbpf: sec 'tp/syscalls/sys_enter_write': found program 'handle_tp' at insn offset 0 (0 bytes), code size 13 insns (104 bytes)
libbpf: elf: section(4) .reltp/syscalls/sys_enter_write, size 32, link 13, flags 40, type=9
libbpf: elf: section(5) license, size 13, link 0, flags 3, type=1
libbpf: license of minimal_bpf is Dual BSD/GPL
libbpf: elf: section(6) .bss, size 4, link 0, flags 3, type=8
libbpf: elf: section(7) .rodata, size 28, link 0, flags 2, type=1
libbpf: elf: section(8) .BTF, size 600, link 0, flags 0, type=1
libbpf: elf: section(10) .BTF.ext, size 160, link 0, flags 0, type=1
libbpf: elf: section(13) .symtab, size 192, link 1, flags 0, type=2
libbpf: looking for externs among 8 symbols...
libbpf: collected 0 externs total
libbpf: map 'minimal_.bss' (global data): at sec_idx 6, offset 0, flags 400.
libbpf: map 0 is "minimal_.bss"
libbpf: map 'minimal_.rodata' (global data): at sec_idx 7, offset 0, flags 480.
libbpf: map 1 is "minimal_.rodata"
libbpf: sec '.reltp/syscalls/sys_enter_write': collecting relocation for section(3) 'tp/syscalls/sys_enter_write'
libbpf: sec '.reltp/syscalls/sys_enter_write': relo #0: insn #2 against 'my_pid'
libbpf: prog 'handle_tp': found data map 0 (minimal_.bss, sec 6, off 0) for insn 2
libbpf: sec '.reltp/syscalls/sys_enter_write': relo #1: insn #6 against '.rodata'
libbpf: prog 'handle_tp': found data map 1 (minimal_.rodata, sec 7, off 0) for insn 6
libbpf: map 'minimal_.bss': created successfully, fd=4
libbpf: map 'minimal_.rodata': created successfully, fd=5
Successfully started! Please run `sudo cat /sys/kernel/debug/tracing/trace_pipe` to see output of the BPF programs.
...........................^C

```

`libbpf` verbosely printed out elf sections for the ebpf programs, and also
how kernel loads the programs and maps into kernel. This `minimal` example
doesn't have a map of its own defined. We'll also see how to define a useful
ebpf map to exchange data between kernel and user space in future.

Check the debugfs for `bpf_trace_printk` result by doing the following:

```
sudo cat /sys/kernel/debug/tracing/trace_pipe
[sudo] password for anfernee:
         minimal-52645   [003] d... 49838.510917: bpf_trace_printk: BPF triggered from PID 52645.

         minimal-52645   [003] d... 49838.510924: bpf_trace_printk: BPF triggered from PID 52645.

         minimal-52645   [003] d... 49839.511052: bpf_trace_printk: BPF triggered from PID 52645.

```

`52645` is the pid of the user space program.

## Summary

This is basically the simpliest ebpf program on earth. With `libbpf-bootstrap`,
it helps to abstract the ebpf program into several steps: open, load, attach and
destroy. It makes bootstrapping an ebpf program very straight-forward. Of course,
this is a very simple example. Hopefully you find it useful, and I hope I can cover
more complicated program types in the future. eBPF can be a very powerful tool.

