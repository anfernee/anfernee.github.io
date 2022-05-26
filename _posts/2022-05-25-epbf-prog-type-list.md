---
layout: post
title: 'ebpf: introduction to program and map'
date: 2022-05-10
categories: ebpf kernel program
---

Thanks to Greg Marsden's [blog](https://blogs.oracle.com/linux/post/bpf-a-tour-of-program-types)
about ebpf program types. This is a table that summarizes the "latest" ebpf program types, which
is based on kernel v5.18. The list is not complete.

| Program Type                | Attach  | ctx | Trigger | Reference |
| --------------------------- | ------- | --- | ------- | --------- |
| BPF_PROG_TYPE_SOCKET_FILTER |         | [sk_buff][sk_buff] | sock_queue_rcv_skb() | [lwn.net](https://lwn.net/Articles/636647/) |
| BPF_PROG_TYPE_SOCK_OPS      |         | [bpf_sock_ops][bpf_sock_ops] | different places depending on ops | [lwn.net](https://lwn.net/Articles/727189/) |
| BPF_PROG_TYPE_SK_SKB        |         | [sk_buff][sk_buff] | attached to socket via sockmap | [lwn.net](https://lwn.net/Articles/731133/) |
| BPF_PROG_TYPE_SCHED_CLS <br> BPF_PROG_TYPE_SCHED_ACT | tc-bpf | [sk_buff][sk_buff] | packet ingress,egress | |
| BPF_PROG_TYPE_XDP           | netlink | [xdp_md][xdp_md] | driver transmit/receive | |
| BPF_PROG_TYPE_KPROBE        | kprobe hook | pt_regs *ctx | enter/return function | |
| BPF_PROG_TYPE_TRACEPOINT    | trace events defined in /sys/kernel/debug/tracing/events | depending on events | perf_trace_run_bpf_submit() | |
| BPF_PROG_TYPE_PERF_EVENT    | perf_event_open() | [bpf_perf_event_data][perf_event_data] | | |
| BPF_PROG_TYPE_CGROUP_SKB    | cgroup  | [sk_buff][sk_buff] | packet ingress/egress | |
| BPF_PROG_TYPE_CGROUP_SOCKET | cgroup  | socket | socket creation time | |
| BPF_PROG_TYPE_LWT_IN <br> BPF_PROG_TYPE_LWT_OUT <br> BPF_PROG_TYPE_LWT_XMIT | iproute2 | [sk_buff][sk_buff] | lwtunnel_{input,output,xmit} | [lwn.net](https://lwn.net/Articles/650778/) (lightweight tunnel) |

[sk_buff]: https://elixir.bootlin.com/linux/v5.18/source/include/uapi/linux/bpf.h#L5543
[bpf_sock_ops]: https://elixir.bootlin.com/linux/v5.18/source/include/uapi/linux/bpf.h#L5978
[xdp_md]: https://elixir.bootlin.com/linux/v5.18/source/include/uapi/linux/bpf.h#L5738
[perf_event_data]: https://elixir.bootlin.com/linux/v5.18/source/include/uapi/linux/bpf_perf_event.h#L13