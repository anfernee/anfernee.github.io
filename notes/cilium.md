# ebpf maps

## Service maps

Map: `cilium_lb4_services_v2`

```golang
type Service4Key struct {
	Address     types.IPv4 `align:"address"`
	Port        uint16     `align:"dport"`
	BackendSlot uint16     `align:"backend_slot"`
	Proto       uint8      `align:"proto"`
	Scope       uint8      `align:"scope"`
	Pad         pad2uint8  `align:"pad"`
}

type Service4Value struct {
	BackendID uint32    `align:"backend_id"`
	Count     uint16    `align:"count"`         // active backends
	RevNat    uint16    `align:"rev_nat_index"`
	Flags     uint8     `align:"flags"`
	Flags2    uint8     `align:"flags2"`
	Pad       pad2uint8 `align:"pad"`
}

type ServiceFlags uint16

const (
	serviceFlagNone            = 0
	serviceFlagExternalIPs     = 1 << 0
	serviceFlagNodePort        = 1 << 1
	serviceFlagLocalScope      = 1 << 2
	serviceFlagHostPort        = 1 << 3
	serviceFlagSessionAffinity = 1 << 4
	serviceFlagLoadBalancer    = 1 << 5
	serviceFlagRoutable        = 1 << 6
	serviceFlagSourceRange     = 1 << 7
	serviceFlagLocalRedirect   = 1 << 8
	serviceFlagNat46x64        = 1 << 9
	serviceFlagL7LoadBalancer  = 1 << 10
	serviceFlagLoopback        = 1 << 11
)

const (
	// ANY represents all protocols.
	ANY    U8proto = 0
	ICMP   U8proto = 1
	TCP    U8proto = 6
	UDP    U8proto = 17
	ICMPv6 U8proto = 58
	SCTP   U8proto = 132
)

const (
	// ScopeExternal is the lookup scope for services from outside the node.
	ScopeExternal uint8 = iota
	// ScopeInternal is the lookup scope for services from inside the node.
	ScopeInternal
)
```

From:

- https://github.com/cilium/cilium/blob/master/pkg/loadbalancer/loadbalancer.go
- https://github.com/cilium/cilium/blob/master/pkg/u8proto/u8proto.go


Example:
```
key: 15 00 74 ba 1f 90 02 00  00 00 00 00  value: 34 00 00 00 00 00 00 34  00 00 00 00
key: 15 00 74 ba 1f 90 00 00  00 00 00 00  value: 00 00 00 00 03 00 00 34  e0 00 00 00
key: 15 00 74 ba 1f 90 03 00  00 00 00 00  value: 35 00 00 00 00 00 00 34  00 00 00 00
key: 15 00 74 ba 00 50 01 00  00 00 00 00  value: 33 00 00 00 00 00 00 32  00 00 00 00
key: 15 00 74 ba 1f 90 01 00  00 00 00 00  value: 33 00 00 00 00 00 00 34  00 00 00 00
key: 15 00 74 ba 00 50 00 00  00 00 00 00  value: 00 00 00 00 03 00 00 32  e0 00 00 00
key: 15 00 74 ba 00 50 02 00  00 00 00 00  value: 34 00 00 00 00 00 00 32  00 00 00 00
key: 15 00 74 ba 00 50 03 00  00 00 00 00  value: 35 00 00 00 00 00 00 32  00 00 00 00

Key:
[15 00 74 ba] [1f 90] [02 00]  [00]  [00]   [00 00]
    Addr       Port     slot   prot  scope
21.0.116.186   8080      2      any

[34 00 00 00] [00 00] [00 34]  [00]  [00] [00 00]
  backend      count   revid   flag  flag  
```





