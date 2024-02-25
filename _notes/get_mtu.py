import socket
import struct
from fcntl import ioctl

SIOCGIFMTU = 0x8921
SIOCSIFMTU = 0x8922

ifname = "wlp4s0"

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

ifr = ifname + '\x00'*(32-len(ifname))

ifs = ioctl(sock.fileno(), SIOCGIFMTU, ifr)
mtu = struct.unpack('<H',ifs[16:18])[0]

print("MTU:", mtu)
