"""出站 HTTP 收口：qdii-watcher 全部网络请求的唯一下口。

安全设计：
- 协议仅允许 https，主机必须在 ALLOWED_HTTPS_HOSTS 白名单内
- 目标域名解析后不得落在环回/私网/链路本地/保留网段（防 DNS rebinding 指向内网）
- 一律禁用重定向（重定向后的目标不会再经过本函数校验）

调用方传入模块内定义的 URL 常量；查询参数经 requests 编码，
不接受任何外部输入参与 URL 主机/路径的构造。
"""
import ipaddress
import socket
from urllib.parse import urlsplit

import requests

ALLOWED_HTTPS_HOSTS = frozenset({"push2his.eastmoney.com"})
_BLOCKED_NETS = tuple(ipaddress.ip_network(n) for n in (
    "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "169.254.0.0/16", "0.0.0.0/8", "100.64.0.0/10", "::1/128", "fc00::/7", "fe80::/10",
))


def https_get(url, *, params=None, headers=None, timeout=30):
    """仅允许对白名单 https 域名发起 GET；禁用重定向，解析 IP 受限。"""
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HTTPS_HOSTS:
        raise ValueError(f"出站请求目标不在白名单: {url!r}")
    for info in socket.getaddrinfo(parsed.hostname, 443, proto=socket.IPPROTO_TCP):
        addr = ipaddress.ip_address(info[4][0])
        if any(addr in net for net in _BLOCKED_NETS):
            raise ValueError(f"目标解析到受限地址: {addr}")
    return requests.get(url, params=params, headers=headers, timeout=timeout, allow_redirects=False)
