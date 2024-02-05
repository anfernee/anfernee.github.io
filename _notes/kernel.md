## Kernel Code

### macvlan

Ref: https://elixir.bootlin.com/linux/latest/source/drivers/net/macvlan.c 

A pretty complete document about different virtual network devices: 
https://developers.redhat.com/blog/2018/10/22/introduction-to-linux-interfaces-for-virtual-networking 

```shell
ip link add macvlan1 link eth0 type macvlan mode bridge
ip link add macvlan2 link eth0 type macvlan mode bridge
ip netns add net1
ip netns add net2
ip link set macvlan1 netns net1
ip link set macvlan2 netns net2
```

Default linux kernel config `CONFIG_MACVLAN=m`, which makes it hard to debug. Recompile
with `CONFIG_MACVLAN=y`.


#### Hash tables

There are 2 hashes
- vlan_hash
- vlan_source_hash

```c
struct macvlan_port {
	struct net_device	*dev;
    // 2 Hashes
	struct hlist_head	vlan_hash[MACVLAN_HASH_SIZE];
	struct hlist_head	vlan_source_hash[MACVLAN_HASH_SIZE];
};
```


```c
// Entry for source hash
struct macvlan_source_entry {
	struct hlist_node	hlist;
	struct macvlan_dev	*vlan;
	unsigned char		addr[6+2] __aligned(sizeof(u16));
	struct rcu_head		rcu;
};

// Add entry to the hashlist 
static int macvlan_hash_add_source(struct macvlan_dev *vlan,
				   const unsigned char *addr)
{
    // init

    // If entry is already there, return 0
  	entry = macvlan_hash_lookup_source(vlan, addr);
	if (entry)
		return 0;

    // Add entry
    h = &port->vlan_source_hash[macvlan_eth_hash(addr)];
	hlist_add_head_rcu(&entry->hlist, h);
}
```

#### macvlan xmit

xmit is pretty straight-forward.

- If macvlan mode is bridge, check the destination mac if it's also bridge, forward to
lower device by `dev_forward_skb()`.
- Otherwise, send to lower device by `dev_queue_xmit_accel()`

```c
static int macvlan_queue_xmit(struct sk_buff *skb, struct net_device *dev)
{
    if (vlan->mode == MACVLAN_MODE_BRIDGE) {
		const struct ethhdr *eth = skb_eth_hdr(skb);

		dest = macvlan_hash_lookup(port, eth->h_dest);
		if (dest && dest->mode == MACVLAN_MODE_BRIDGE) {
			/* send to lowerdev first for its network taps */
			dev_forward_skb(vlan->lowerdev, skb);

			return NET_XMIT_SUCCESS;
		}
	}
xmit_world:
	skb->dev = vlan->lowerdev;
	return dev_queue_xmit_accel(skb,
				    netdev_get_sb_channel(dev) ? dev : NULL);
}
```
