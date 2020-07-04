---
layout: post
title: 'ebpf: tail call'
date: 2020-07-03
categories: ebpf kernel tailcall
---

Recently I've been involved in some development of a awesome project called
[cilium](https://github.com/cilium/cilium), which is an open sourced project,
providing cloud native networking solution. It can be deployed to Kubernetes
to provide a wide range of network functionality like pod connectivity, load
balancing, security, monitoring, etc. All the features are ebpf based, which
means it is really fast! During the past a few months, I got to learn a lot
about ebpf. It's really an great technology, but I feel like I don't find many
useful blog posts about it. I hope this will be useful to people who are
interested in this topic.

# What is a tail call?

The best document about tail call is [this](https://docs.cilium.io/en/latest/bpf/#tail-calls)
one from cilium doc. 

![tail call](https://docs.cilium.io/en/latest/_images/bpf_tailcall.png)

In the blog, they say:

<blockquote>
Another concept that can be used with BPF is called tail calls. Tail calls can be seen as a mechanism that allows one BPF program to call another, without returning back to the old program. Such a call has minimal overhead as unlike function calls, it is implemented as a long jump, reusing the same stack frame.
</blockquote>

<blockquote>
There are two components involved for carrying out tail calls: the first part needs to setup a specialized map called program array (BPF_MAP_TYPE_PROG_ARRAY) that can be populated by user space with key / values, where values are the file descriptors of the tail called BPF programs, the second part is a bpf_tail_call() helper where the context, a reference to the program array and the lookup key is passed to. Then the kernel inlines this helper call directly into a specialized BPF instruction. Such a program array is currently write-only from user space side.
</blockquote>

# How does tail call work?

## Calling tail call

When you ebpf program wants to tailcall another ebpf program, it calls epbf helper `ebpf_tail_call()`.
The definition of the helper function looks like this:

```c
int bpf_tail_call(void *ctx, struct bpf_map *prog_array_map, u32 index)
```

as it is documented here in [linux/bpf.h](https://elixir.bootlin.com/linux/v5.7.6/source/include/uapi/linux/bpf.h#L812)
source code (v5.7.6). I'll probably write another post about ebpf helper functions in the future.

## Executing tail call

As defined in [kernel/bpf/core.c](https://elixir.bootlin.com/linux/v5.7.6/source/kernel/bpf/core.c#L2176),
it basically defined helper function's metadata. It has 3 arguments, but no return type, because tail call never
returns. Unlike other helpers, `.func` property is also `NULL`, because it simplies jumps to an instruction
of another program. 

```c
/* Always built-in helper functions. */
const struct bpf_func_proto bpf_tail_call_proto = {
	.func		= NULL,
	.gpl_only	= false,
	.ret_type	= RET_VOID,
	.arg1_type	= ARG_PTR_TO_CTX,
	.arg2_type	= ARG_CONST_MAP_PTR,
	.arg3_type	= ARG_ANYTHING,
};
```
In the same file, the handler of the instruction simply load the program
from the `prog_array_map[index]`, and jump to the first instruction.
The JIT part is a little bit complex. For example, [this](https://elixir.bootlin.com/linux/v5.7.6/source/arch/x86/net/bpf_jit_comp32.c#L1270) for x86 for those who are interested in x86 implementations.


```c
	JMP_TAIL_CALL: {
		struct bpf_map *map = (struct bpf_map *) (unsigned long) BPF_R2;
		struct bpf_array *array = container_of(map, struct bpf_array, map);
		struct bpf_prog *prog;
		u32 index = BPF_R3;

		if (unlikely(index >= array->map.max_entries))
			goto out;
		if (unlikely(tail_call_cnt > MAX_TAIL_CALL_CNT))
			goto out;

		tail_call_cnt++;

		prog = READ_ONCE(array->ptrs[index]);
		if (!prog)
			goto out;

		/* ARG1 at this point is guaranteed to point to CTX from
		 * the verifier side due to the fact that the tail call is
		 * handeled like a helper, that is, bpf_tail_call_proto,
		 * where arg1_type is ARG_PTR_TO_CTX.
		 */
		insn = prog->insnsi;
		goto select_insn;
```

## Cilium optimization

Cilium has a very interesting [optimization](https://github.com/cilium/cilium/blob/f5537c26020d5297b70936c6b7d03a1e412a1035/bpf/include/bpf/tailcall.h), where they directly put the arguments into the register R1, R2 and R3, then `call 12`,
where `12` is the interesting number that represents the helper function `tail_call` as defined
[here](https://elixir.bootlin.com/linux/v5.7.6/source/include/uapi/linux/bpf.h#L3049), because it's the 12th function
defined.


```c
static __always_inline __maybe_unused void
tail_call_static(const struct __ctx_buff *ctx, const void *map,
		 const __u32 slot)
{
	if (!__builtin_constant_p(slot))
		__throw_build_bug();

	/* Don't gamble, but _guarantee_ that LLVM won't optimize setting
	 * r2 and r3 from different paths ending up at the same call insn as
	 * otherwise we won't be able to use the jmpq/nopl retpoline-free
	 * patching by the x86-64 JIT in the kernel.
	 *
	 * Note on clobber list: we need to stay in-line with BPF calling
	 * convention, so even if we don't end up using r0, r4, r5, we need
	 * to mark them as clobber so that LLVM doesn't end up using them
	 * before / after the call.
	 */
	asm volatile("r1 = %[ctx]\n\t"
		     "r2 = %[map]\n\t"
		     "r3 = %[slot]\n\t"
		     "call 12\n\t"
		     :: [ctx]"r"(ctx), [map]"r"(map), [slot]"i"(slot)
		     : "r0", "r1", "r2", "r3", "r4", "r5");
}
```