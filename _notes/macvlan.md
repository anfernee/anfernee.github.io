# Macvlan code walkthru

## macvlan structs

```c
struct macvlan_dev {
	struct net_device	*dev;
	struct list_head	list;
	struct hlist_node	hlist;
	struct macvlan_port	*port;
	struct net_device	*lowerdev;
	netdevice_tracker	dev_tracker;
	void			*accel_priv;
	struct vlan_pcpu_stats __percpu *pcpu_stats;

	DECLARE_BITMAP(mc_filter, MACVLAN_MC_FILTER_SZ);

	netdev_features_t	set_features;
	enum macvlan_mode	mode;
	u16			flags;
	unsigned int		macaddr_count;
	u32			bc_queue_len_req;
#ifdef CONFIG_NET_POLL_CONTROLLER
	struct netpoll		*netpoll;
#endif
};

struct macvlan_port {
	struct net_device	*dev;
	struct hlist_head	vlan_hash[MACVLAN_HASH_SIZE];
	struct list_head	vlans;
	struct sk_buff_head	bc_queue;
	struct work_struct	bc_work;
	u32			bc_queue_len_used;
	int			bc_cutoff;
	u32			flags;
	int			count;
	struct hlist_head	vlan_source_hash[MACVLAN_HASH_SIZE];
	DECLARE_BITMAP(bc_filter, MACVLAN_MC_FILTER_SZ);
	DECLARE_BITMAP(mc_filter, MACVLAN_MC_FILTER_SZ);
	unsigned char           perm_addr[ETH_ALEN];
};

// https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/if_link.h#L648
enum macvlan_mode {
	MACVLAN_MODE_PRIVATE = 1, /* don't talk to other macvlans */
	MACVLAN_MODE_VEPA    = 2, /* talk to other ports through ext bridge */
	MACVLAN_MODE_BRIDGE  = 4, /* talk to bridge ports directly */
	MACVLAN_MODE_PASSTHRU = 8,/* take over the underlying device */
	MACVLAN_MODE_SOURCE  = 16,/* use source MAC address list to assign */
};
```

## rtnl_link_ops

```
static struct rtnl_link_ops macvlan_link_ops = {
	.kind		= "macvlan",
	.setup		= macvlan_setup,
	.newlink	= macvlan_newlink,
	.dellink	= macvlan_dellink,
	.get_link_net	= macvlan_get_link_net,
	.priv_size      = sizeof(struct macvlan_dev),
};

int macvlan_link_register(struct rtnl_link_ops *ops)
{
	/* common fields */
	ops->validate		= macvlan_validate;
	ops->maxtype		= IFLA_MACVLAN_MAX;
	ops->policy		= macvlan_policy;
	ops->changelink		= macvlan_changelink;
	ops->get_size		= macvlan_get_size;
	ops->fill_info		= macvlan_fill_info;

	return rtnl_link_register(ops);
};
```

## net_device_ops

First, take a look at some important [operations](https://elixir.bootlin.com/linux/latest/source/drivers/net/macvlan.c#L1182) for macvlan devices.

```c
static const struct net_device_ops macvlan_netdev_ops = {
	.ndo_init		= macvlan_init,
	.ndo_uninit		= macvlan_uninit,
	.ndo_open		= macvlan_open,
	.ndo_stop		= macvlan_stop,
	.ndo_start_xmit		= macvlan_start_xmit,
	.ndo_change_mtu		= macvlan_change_mtu,
	.ndo_fix_features	= macvlan_fix_features,
	.ndo_change_rx_flags	= macvlan_change_rx_flags,
	.ndo_set_mac_address	= macvlan_set_mac_address,
	.ndo_set_rx_mode	= macvlan_set_mac_lists,
	.ndo_get_stats64	= macvlan_dev_get_stats64,
	.ndo_validate_addr	= eth_validate_addr,
	.ndo_vlan_rx_add_vid	= macvlan_vlan_rx_add_vid,
	.ndo_vlan_rx_kill_vid	= macvlan_vlan_rx_kill_vid,
	.ndo_fdb_add		= macvlan_fdb_add,
	.ndo_fdb_del		= macvlan_fdb_del,
	.ndo_fdb_dump		= ndo_dflt_fdb_dump,
#ifdef CONFIG_NET_POLL_CONTROLLER
	.ndo_poll_controller	= macvlan_dev_poll_controller,
	.ndo_netpoll_setup	= macvlan_dev_netpoll_setup,
	.ndo_netpoll_cleanup	= macvlan_dev_netpoll_cleanup,
#endif
	.ndo_get_iflink		= macvlan_dev_get_iflink,
	.ndo_features_check	= passthru_features_check,
	.ndo_hwtstamp_get	= macvlan_hwtstamp_get,
	.ndo_hwtstamp_set	= macvlan_hwtstamp_set,
};
```

### Lifecycle management

```
	.ndo_init		= macvlan_init,
	.ndo_uninit		= macvlan_uninit,
	.ndo_open		= macvlan_open,
	.ndo_stop		= macvlan_stop,
    .ndo_validate_addr = eth_validate_addr, 
```

### Configurations via ioctl

`SIOCxIFxxx` via `ioctl`. Use `man 7 netdevice` to show how to configure network devices.

- `macvlan_change_mtu`: the callback to [set mtu](https://elixir.bootlin.com/linux/latest/source/net/core/dev.c#L8695) besides writing `dev->mtu`. request numbers are SIOCGIFMTU and SIOCSIFMTU.
  - In `macvlan`, it simply [check](https://elixir.bootlin.com/linux/latest/source/drivers/net/macvlan.c#L861) if lower device (parant device)'s MTU is smaller than the new mtu: `if (vlan->lowerdev->mtu < new_mtu) return -EINVAL;`
- `macvlan_set_mac_address`: the callback to [set mac address](https://elixir.bootlin.com/linux/latest/source/net/core/dev.c#L8850). request number is SIOCSIFHWADDR.
  - In `macvlan`, depending on the mode. If passthru, set directly to lower device. If addr is busy, return EADDRINUSE. Otherwise, `macvlan_sync_address`.
- `macvlan_set_rx_mode`
- `macvlan_hwtstamp_get` and `macvlan_hwtstamp_set`: hardware timestamping settings
 

### Features

2 callbacks are registered:

- `macvlan_fix_features`
- `passthru_features_check`: directly return features.

```c
#define MACVLAN_FEATURES \
	(NETIF_F_SG | NETIF_F_HW_CSUM | NETIF_F_HIGHDMA | NETIF_F_FRAGLIST | \
	 NETIF_F_GSO | NETIF_F_TSO | NETIF_F_LRO | \
	 NETIF_F_TSO_ECN | NETIF_F_TSO6 | NETIF_F_GRO | NETIF_F_RXCSUM | \
	 NETIF_F_HW_VLAN_CTAG_FILTER | NETIF_F_HW_VLAN_STAG_FILTER)
```

- `macvlan_fix_features`: Set `MACVLAN_FEATURES`. For the general device set features, it needs to consider both upper devices and lower device.

### Stats collection

- `macvlan_dev_get_stats64`: called in [dev.c](https://elixir.bootlin.com/linux/latest/source/net/core/dev.c#L10608) by `ndo_get_stats64`. Consumed in 3 places:
  - procfs: https://elixir.bootlin.com/linux/latest/source/net/core/net-procfs.c#L80
  - sysfs: https://elixir.bootlin.com/linux/latest/source/net/core/net-sysfs.c#L675
  - rtnetlink: https://elixir.bootlin.com/linux/latest/source/net/core/rtnetlink.c#L1272

#### procfs

```
cat /proc/net/dev
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 45853107  396428    0    0    0     0          0         0 45853107  396428    0    0    0     0       0          0
enp3s0:       0       0    0    0    0     0          0         0        0       0    0    0    0     0       0          0
wlp4s0: 19124762364 17591845    0    0    0     0          0         0 2001536419 7331286    0    0    0     0       0          0
virbr0:  119794    1417    0    0    0     0          0        93  2437042   11784    0    0    0     0       0          0
br-9784f24bcded:       0       0    0    0    0     0          0         0        0       0    0    0    0     0       0          0
docker0:       0       0    0    0    0     0          0         0        0       0    0    0    0     0       0          0

```

#### sysfs

```
➜  ls /sys/class/net/wlp4s0/statistics          
collisions  rx_bytes       rx_crc_errors  rx_errors       rx_frame_errors   rx_missed_errors  rx_over_errors  tx_aborted_errors  tx_carrier_errors  tx_dropped  tx_fifo_errors       tx_packets
multicast   rx_compressed  rx_dropped     rx_fifo_errors  rx_length_errors  rx_nohandler      rx_packets      tx_bytes           tx_compressed      tx_errors   tx_heartbeat_errors  tx_window_errors
```

#### rtnetlink

```
# ip -s -s link show wlp4s0 
3: wlp4s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DORMANT group default qlen 1000
    link/ether b0:10:41:98:b2:6b brd ff:ff:ff:ff:ff:ff
    RX:   bytes  packets errors dropped  missed   mcast           
    19132298461 17605070      0       0       0       0 
    RX errors:    length    crc   frame    fifo overrun           
                       0      0       0       0       0 
    TX:   bytes  packets errors dropped carrier collsns           
     2003332166  7339461      0       0       0       0 
    TX errors:   aborted   fifo  window heartbt transns
                       0      0       0       0      24 

```

strace result: 

```
socket(AF_NETLINK, SOCK_RAW|SOCK_CLOEXEC, NETLINK_ROUTE) = 3
setsockopt(3, SOL_SOCKET, SO_SNDBUF, [32768], 4) = 0
setsockopt(3, SOL_SOCKET, SO_RCVBUF, [1048576], 4) = 0
setsockopt(3, SOL_NETLINK, NETLINK_EXT_ACK, [1], 4) = 0
bind(3, {sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, 12) = 0
getsockname(3, {sa_family=AF_NETLINK, nl_pid=2143130, nl_groups=00000000}, [12]) = 0
setsockopt(3, SOL_NETLINK, NETLINK_GET_STRICT_CHK, [1], 4) = 0
sendto(3, [{nlmsg_len=32, nlmsg_type=RTM_NEWLINK, nlmsg_flags=NLM_F_REQUEST|NLM_F_ACK, nlmsg_seq=0, nlmsg_pid=0}, {ifi_family=AF_UNSPEC, ifi_type=ARPHRD_NETROM, ifi_index=0, ifi_flags=0, ifi_change=0}], 32, 0, NULL, 0) = 32
recvmsg(3, {msg_name={sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, msg_namelen=12, msg_iov=[{iov_base=[{nlmsg_len=52, nlmsg_type=NLMSG_ERROR, nlmsg_flags=0, nlmsg_seq=0, nlmsg_pid=2143130}, {error=-EPERM, msg=[{nlmsg_len=32, nlmsg_type=RTM_NEWLINK, nlmsg_flags=NLM_F_REQUEST|NLM_F_ACK, nlmsg_seq=0, nlmsg_pid=0}, {ifi_family=AF_UNSPEC, ifi_type=ARPHRD_NETROM, ifi_index=0, ifi_flags=0, ifi_change=0}]}], iov_len=16384}], msg_iovlen=1, msg_controllen=0, msg_flags=0}, 0) = 52

sendmsg(3, {msg_name={sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, msg_namelen=12, msg_iov=[{iov_base=[{nlmsg_len=52, nlmsg_type=RTM_GETLINK, nlmsg_flags=NLM_F_REQUEST, nlmsg_seq=1708901477, nlmsg_pid=0}, {ifi_family=AF_PACKET, ifi_type=ARPHRD_NETROM, ifi_index=0, ifi_flags=0, ifi_change=0}, [[{nla_len=11, nla_type=IFLA_IFNAME}, "wlp4s0"], [{nla_len=8, nla_type=IFLA_EXT_MASK}, RTEXT_FILTER_VF]]], iov_len=52}], msg_iovlen=1, msg_controllen=0, msg_flags=0}, 0) = 52
recvmsg(3, {msg_name={sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, msg_namelen=12, msg_iov=[{iov_base=NULL, iov_len=0}], msg_iovlen=1, msg_controllen=0, msg_flags=MSG_TRUNC}, MSG_PEEK|MSG_TRUNC) = 1472
recvmsg(3, {msg_name={sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, msg_namelen=12, msg_iov=[{iov_base=[{nlmsg_len=1472, nlmsg_type=RTM_NEWLINK, nlmsg_flags=0, nlmsg_seq=1708901477, nlmsg_pid=2143130}, {ifi_family=AF_UNSPEC, ifi_type=ARPHRD_ETHER, ifi_index=if_nametoindex("wlp4s0"), ifi_flags=IFF_UP|IFF_BROADCAST|IFF_RUNNING|IFF_MULTICAST|IFF_LOWER_UP, ifi_change=0}, [[{nla_len=11, nla_type=IFLA_IFNAME}, "wlp4s0"], [{nla_len=8, nla_type=IFLA_TXQLEN}, 1000], [{nla_len=5, nla_type=IFLA_OPERSTATE}, 6], [{nla_len=5, nla_type=IFLA_LINKMODE}, 1], [{nla_len=8, nla_type=IFLA_MTU}, 1500], [{nla_len=8, nla_type=IFLA_MIN_MTU}, 256], [{nla_len=8, nla_type=IFLA_MAX_MTU}, 2304], [{nla_len=8, nla_type=IFLA_GROUP}, 0], [{nla_len=8, nla_type=IFLA_PROMISCUITY}, 0], [{nla_len=8, nla_type=0x3d /* IFLA_??? */}, "\x00\x00\x00\x00"], [{nla_len=8, nla_type=IFLA_NUM_TX_QUEUES}, 1], [{nla_len=8, nla_type=IFLA_GSO_MAX_SEGS}, 65535], [{nla_len=8, nla_type=IFLA_GSO_MAX_SIZE}, 65536], [{nla_len=8, nla_type=0x3a /* IFLA_??? */}, "\x00\x00\x01\x00"], [{nla_len=8, nla_type=0x3f /* IFLA_??? */}, "\x00\x00\x01\x00"], [{nla_len=8, nla_type=0x40 /* IFLA_??? */}, "\x00\x00\x01\x00"], [{nla_len=8, nla_type=0x3b /* IFLA_??? */}, "\x00\x00\x01\x00"], [{nla_len=8, nla_type=0x3c /* IFLA_??? */}, "\xff\xff\x00\x00"], [{nla_len=8, nla_type=IFLA_NUM_RX_QUEUES}, 1], [{nla_len=5, nla_type=IFLA_CARRIER}, 1], [{nla_len=12, nla_type=IFLA_QDISC}, "noqueue"], [{nla_len=8, nla_type=IFLA_CARRIER_CHANGES}, 24], [{nla_len=8, nla_type=IFLA_CARRIER_UP_COUNT}, 12], [{nla_len=8, nla_type=IFLA_CARRIER_DOWN_COUNT}, 12], [{nla_len=5, nla_type=IFLA_PROTO_DOWN}, 0], [{nla_len=36, nla_type=IFLA_MAP}, {mem_start=0, mem_end=0, base_addr=0, irq=0, dma=0, port=0}], [{nla_len=10, nla_type=IFLA_ADDRESS}, b0:10:41:98:b2:6b], [{nla_len=10, nla_type=IFLA_BROADCAST}, ff:ff:ff:ff:ff:ff], [{nla_len=204, nla_type=IFLA_STATS64}, {rx_packets=17605396, tx_packets=7339679, rx_bytes=19132366122, tx_bytes=2003375666, rx_errors=0, tx_errors=0, rx_dropped=0, tx_dropped=0, multicast=0, collisions=0, rx_length_errors=0, rx_over_errors=0, rx_crc_errors=0, rx_frame_errors=0, rx_fifo_errors=0, rx_missed_errors=0, tx_aborted_errors=0, tx_carrier_errors=0, tx_fifo_errors=0, tx_heartbeat_errors=0, tx_window_errors=0, rx_compressed=0, tx_compressed=0, rx_nohandler=0}], [{nla_len=100, nla_type=IFLA_STATS}, {rx_packets=17605396, tx_packets=7339679, rx_bytes=1952496938, tx_bytes=2003375666, rx_errors=0, tx_errors=0, rx_dropped=0, tx_dropped=0, multicast=0, collisions=0, rx_length_errors=0, rx_over_errors=0, rx_crc_errors=0, rx_frame_errors=0, rx_fifo_errors=0, rx_missed_errors=0, tx_aborted_errors=0, tx_carrier_errors=0, tx_fifo_errors=0, tx_heartbeat_errors=0, tx_window_errors=0, rx_compressed=0, tx_compressed=0, rx_nohandler=0}], [{nla_len=8, nla_type=IFLA_NUM_VF}, 0], [{nla_len=12, nla_type=IFLA_XDP}, [{nla_len=5, nla_type=IFLA_XDP_ATTACHED}, XDP_ATTACHED_NONE]], ...]], iov_len=32768}], msg_iovlen=1, msg_controllen=0, msg_flags=0}, 0) = 1472


```

Registered by `nlmsg_type=RTM_NEWLINK`:

```
rtnl_register(PF_UNSPEC, RTM_GETLINK, rtnl_getlink,
		      rtnl_dump_ifinfo, 0);
```


[rtnl_fill_ifinfo()](https://elixir.bootlin.com/linux/latest/source/net/core/rtnetlink.c#L1810)

#### Data

The collected data includes:

- rx_packets
- rx_bytes
- rx_multicast
- rx_dropped
- rx_error
- tx_packets
- tx_bytes
- tx_multicast
- tx_dropped
- tx_error

This needs to be collected per CPU:

```c
		for_each_possible_cpu(i) {
			p = per_cpu_ptr(vlan->pcpu_stats, i);
        }
```

#### xmit

- `macvlan_start_xmit`: calls `macvlan_queue_xmit(skb, dev)`

By default:

```c
xmit_world:
	skb->dev = vlan->lowerdev;
	return dev_queue_xmit_accel(skb,
				    netdev_get_sb_channel(dev) ? dev : NULL);
```

In bridge mode, and also destination is broadcast address, broadcast it. If destination
MAC is also a bridge on the same host, directly forward it:

```c
if (vlan->mode == MACVLAN_MODE_BRIDGE) {
		const struct ethhdr *eth = skb_eth_hdr(skb);

		/* send to other bridge ports directly */
		if (is_multicast_ether_addr(eth->h_dest)) {
			skb_reset_mac_header(skb);
			macvlan_broadcast(skb, port, dev, MACVLAN_MODE_BRIDGE);
			goto xmit_world;
		}

		dest = macvlan_hash_lookup(port, eth->h_dest);
		if (dest && dest->mode == MACVLAN_MODE_BRIDGE) {
			/* send to lowerdev first for its network taps */
			dev_forward_skb(vlan->lowerdev, skb);

			return NET_XMIT_SUCCESS;
		}
	}
```

#### receive

```c
int macvlan_common_newlink(struct net *src_net, struct net_device *dev,
			   struct nlattr *tb[], struct nlattr *data[],
			   struct netlink_ext_ack *extack)
{
    if (!netif_is_macvlan_port(lowerdev)) {
		err = macvlan_port_create(lowerdev);
    }
}

static int macvlan_port_create(struct net_device *dev)
{
    ...
    err = netdev_rx_handler_register(dev, macvlan_handle_frame, port);
}
```

The following `macvlan_handle_frame` is the main handler for receive packet. It
does `hash_lookup` on destination, handle broadcast and multicast.
```c
static rx_handler_result_t macvlan_handle_frame(struct sk_buff **pskb)
```


#### multicast

```c
static void macvlan_multicast_rx(const struct macvlan_port *port,
				 const struct macvlan_dev *src,
				 struct sk_buff *skb)
{
	if (!src)
		/* frame comes from an external address */
		macvlan_broadcast(skb, port, NULL,
				  MACVLAN_MODE_PRIVATE |
				  MACVLAN_MODE_VEPA    |
				  MACVLAN_MODE_PASSTHRU|
				  MACVLAN_MODE_BRIDGE);
	else if (src->mode == MACVLAN_MODE_VEPA)
		/* flood to everyone except source */
		macvlan_broadcast(skb, port, src->dev,
				  MACVLAN_MODE_VEPA |
				  MACVLAN_MODE_BRIDGE);
	else
		/*
		 * flood only to VEPA ports, bridge ports
		 * already saw the frame on the way out.
		 */
		macvlan_broadcast(skb, port, src->dev,
				  MACVLAN_MODE_VEPA);
}
```