# -*- coding: utf-8 -*-
"""从安鑫乐量化实验室「跨境额度日报」抓取 QDII 基金直销限额。

主数据源：https://anxinletech.com/instrument-qdii.html
口径：基金管理人公告（直销/代销分渠道），本脚本只取**直销**额度；
代销额度仍由 scanner.py 从天天基金获取，两源按基金代码合并。

兜底数据源：微信公众号「QDII额度日报」（每交易日 8:45 推送，比安信乐
网站早约一天）。经搜狗微信搜索定位最新日报 -> 解出真实文章地址 ->
解析正文条目。安信乐数据滞后当日时自动切换。

独立运行：
    python3 fetch_direct_limit.py [--out direct_limits.json]
    输出 {source, as_of, fetched_at, funds: {code: {...}}}
作为模块：
    from fetch_direct_limit import fetch_direct_limits
    data = fetch_direct_limits()   # 失败抛异常，由调用方兜底
"""
import argparse
import datetime as _dt
import html as _html
import json
import logging
import re
import sys
import urllib.parse
import urllib.request
import http.cookiejar
from pathlib import Path

ANXINLE_URL = "https://anxinletech.com/instrument-qdii.html"
SOGOU_SEARCH_URL = "https://weixin.sogou.com/weixin"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_OUT = BASE_DIR / "direct_limits.json"
TIMEOUT = 30

log = logging.getLogger("direct_limit")

# 一行基金：<tr><td class="cell-name"...><a href="/fund/{code}.html">名称</a>（{code}）</td>
#          <td data-label="状态"...>{状态}</td><td data-label="限额"...>{限额}</td>
#          <td data-label="渠道说明"...>{说明}</td>...
ROW_RE = re.compile(
    r'<tr><td class="cell-name"[^>]*>'
    r'<a href="/fund/(\d{6})\.html">[^<]*</a>（(\d{6})）</td>'
    r'<td data-label="状态"[^>]*>(.*?)</td>'
    r'<td data-label="限额"[^>]*>(.*?)</td>'
    r'<td data-label="渠道说明"[^>]*>(.*?)</td>',
    re.S,
)
AS_OF_RE = re.compile(r"最新一期\s*·\s*(\d{4}-\d{2}-\d{2})")

# 限额单元格内的分渠道行：<div>代销 100元</div><div>直销 1000元</div>
CHANNEL_RE = re.compile(r"(代销|直销)\s*([\d.,]+)\s*(万)?元")
AMOUNT_RE = re.compile(r"^([\d.,]+)\s*(万)?元$")


def parse_amount(text: str):
    """'100元'/'10万元' -> 100 / 100000（元）；不匹配返回 None。"""
    m = AMOUNT_RE.search(text.strip())
    if not m:
        return None
    value = float(m.group(1).replace(",", ""))
    return value * 10000 if m.group(2) else value


def cell_text(cell_html: str) -> str:
    """单元格 HTML -> 纯文本，</div> 与 <br> 转换行符。"""
    text = re.sub(r"</div>\s*<div[^>]*>", "\n", cell_html)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def parse_page(html: str) -> dict:
    """解析页面，返回 {as_of, funds: {code: {...}}}。"""
    as_of_m = AS_OF_RE.search(html)
    as_of = as_of_m.group(1) if as_of_m else None

    funds = {}
    for url_code, text_code, status_html, limit_html, note_html in ROW_RE.findall(html):
        code = text_code or url_code
        status = cell_text(status_html)
        note = cell_text(note_html)[:200]
        limit_text = cell_text(limit_html)

        record = {
            "direct_limit_amount": None,
            "direct_channel_note": note,
            "direct_source_status": status[:60],
            "anxinle_verified": "公告直核" in status_html,
        }

        if "暂停申购" in status:
            # 暂停 = 全渠道不可买，直销置 0（页面限额显示 —）
            record["direct_limit_amount"] = 0.0
        else:
            direct_amount = _channel_amount(limit_text, "直销")
            if direct_amount is not None:
                record["direct_limit_amount"] = direct_amount
            elif not limit_text or re.fullmatch(r"[—\s]*", limit_text):
                pass  # 无限额信息，保持 None
            else:
                # 裸单值：公告直核行形如「X元 —」或「X元 代销（第三方平台）X元」，
                # 公告未分渠道 → 统一限额，直销与公告（=代销）同口径
                bare = AMOUNT_RE.search(limit_text.strip())
                if bare and record["anxinle_verified"]:
                    record["announcement_limit_amount"] = parse_amount(limit_text)
                    if re.search(r"仅.{0,12}直销|代销无", note):
                        record["direct_limit_amount"] = parse_amount(limit_text)
        funds[code] = record
    return {"as_of": as_of, "funds": funds}


def _channel_amount(limit_text: str, channel: str):
    """从多行限额文本中取指定渠道的金额。"""
    for line in limit_text.splitlines():
        m = re.match(rf"{channel}\s*([\d.,]+)\s*(万)?元", line.strip())
        if m:
            value = float(m.group(1).replace(",", ""))
            return value * 10000 if m.group(2) else value
    return None


def fetch_page() -> str:
    req = urllib.request.Request(
        ANXINLE_URL, headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_direct_limits_anxinle() -> dict:
    """安信乐单源抓取：返回 {as_of, funds}。失败抛异常。"""
    html = fetch_page()
    data = parse_page(html)
    if not data["funds"]:
        raise RuntimeError("页面解析到 0 只基金，结构可能已变更")
    return data


# ---------------------------------------------------------------------------
# 兜底源：微信公众号「QDII额度日报」（搜狗微信搜索 -> 文章正文）
# ---------------------------------------------------------------------------

def _make_opener() -> urllib.request.OpenerDirector:
    """带 cookie 的 opener（搜狗 /link 跳转需要会话 cookie）。"""
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


_OPENER = _make_opener()


def _http_get(url: str, referer: str = None) -> str:
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with _OPENER.open(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _unescape_jsx(text: str) -> str:
    """还原 \\xNN 形式的 JS 字符串转义（公众号正文嵌在 JS 变量里）。"""
    return re.sub(
        r"\\x([0-9a-fA-F]{2})", lambda m: chr(int(m.group(1), 16)), text
    )


def _html_to_text(html: str) -> str:
    """HTML -> 纯文本，块级标签转换行，保留条目分行结构。

    输入可能含还原转义后的 script 片段（见 _extract_article_body），
    不做 script 删除——script 边界已不可信；噪声由条目正则过滤。
    """
    html = re.sub(r"<(p|section|div|br|li|tr|h\d)[^>]*>", "\n", html)
    html = re.sub(r"<[^>]+>", "", html)
    text = _html.unescape(html)
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t\u3000]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


def _parse_title_date(title: str):
    """从文章标题解析日期（支持 2026-09-16 / 2026年9月16日），返回 ISO 串。"""
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", title)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", title)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


def search_wechat_daily(opener_timeout: int = TIMEOUT):
    """搜狗微信搜索最新一期「QDII额度日报」。

    返回 (iso_date, real_url)；找不到返回 (None, None)。反爬失败抛异常。
    """
    query = urllib.parse.quote("QDII额度日报")
    search_url = f"{SOGOU_SEARCH_URL}?type=2&query={query}"
    search_html = _http_get(search_url, referer="https://weixin.sogou.com/")
    if "antispider" in search_html or "验证码" in search_html:
        raise RuntimeError("搜狗触发验证码，本次跳过公众号兜底")

    # 结果条目：标题（含日期）+ /link 跳转
    items = re.findall(
        r'<a[^>]+href="(/link\?url=[^"]+)"[^>]*>(.*?)</a>', search_html, re.S
    )
    candidates = []
    seen_links = set()
    for href, raw_title in items:
        title = _html.unescape(re.sub(r"<[^>]+>", "", raw_title)).strip()
        if "额度日报" not in title:
            continue
        pub_date = _parse_title_date(title)
        if pub_date:
            candidates.append((pub_date, href, title))

    if not candidates:
        return None, None
    candidates.sort(key=lambda item: item[0], reverse=True)
    pub_date, href, _ = candidates[0]
    if href in seen_links:
        return pub_date, None
    # /link 页面用 JS 分段拼接真实地址，取回后拼合
    link_html = _http_get(
        "https://weixin.sogou.com" + _html.unescape(href),
        referer=search_url,
    )
    parts = re.findall(r"url \+= '([^']*)'", link_html)
    real_url = "".join(parts).strip()
    if not real_url.startswith("http"):
        raise RuntimeError("未能解出公众号文章真实地址（搜狗跳转格式变更）")
    return pub_date, real_url


def _direct_from_entry(amount_text: str, body: str):
    """单条目解析直销限额。amount_text=条目行限额文本，body=说明行。"""
    if "暂停申购" in amount_text + body:
        return 0.0
    # 显式分渠道标注：如「大成直销（官网/APP）1000元」
    m = re.search(r"直销[^0-9\n]{0,14}([\d,]+(?:\.\d+)?)\s*(万)?元", body)
    if m:
        value = float(m.group(1).replace(",", ""))
        return value * 10000 if m.group(2) else value
    # 「仅直销，代销无此额度」：条目基础限额即直销额度
    base = re.match(r"\s*([\d,]+(?:\.\d+)?)\s*(万)?元$", amount_text)
    if base and re.search(r"仅.{0,15}直销|代销无", body):
        value = float(base.group(1).replace(",", ""))
        return value * 10000 if base.group(2) else value
    return None


def _extract_article_body(html: str) -> str:
    """返回文章 HTML 的「正文可解析源」。

    公众号正文可能服务端渲染在 js_content div，也可能整体嵌在 JS 变量
    （\\xNN 转义的 HTML 字符串）里且 div 为空。统一策略：先整体还原
    \\xNN 转义（不按 script 边界裁剪——还原后 script 边界不可信，正文
    常嵌在 script 字符串中，裁剪会误删正文），块级标签与条目正则会在
    后续步骤过滤 JS 噪声。
    """
    return re.sub(
        r"\\x([0-9a-fA-F]{2})",
        lambda m: chr(int(m.group(1), 16)),
        html,
    )


def parse_wechat_article(html: str) -> dict:
    """解析公众号日报正文，返回 {as_of, funds: {code: {...}}}。

    条目行结构（span 相连无分隔）：名称+6位代码+限额元，如
    「宝盈纳斯达克100指数发起(QDII)A人民币019736200元」；
    说明行紧随其后（合并计算提示 / 仅直销说明 / 分渠道限额）。
    """
    text = _html_to_text(_extract_article_body(html))
    as_of = None
    m = re.search(r"数据截至\s*(\d{4}-\d{2}-\d{2})", text)
    if m:
        as_of = m.group(1)

    # 条目行：名称（非数字结尾）+ 6 位代码 + 金额行尾（名称/代码/限额在页面上 span 相连）
    entry_re = re.compile(
        r"^(.*?[^\d])\s*(\d{6})\s*(\d[\d,]*(?:\.\d+)?\s*(?:万)?元)$"
    )
    lines = text.splitlines()
    funds = {}
    i = 0
    while i < len(lines):
        m = entry_re.match(lines[i].strip())
        if not m:
            i += 1
            continue
        code = m.group(2)
        amount_text = m.group(3)
        # 收集说明行（最多 3 行，遇到下一个条目/主题标题即止）
        body_lines = []
        j = i + 1
        while j < len(lines) and len(body_lines) < 3:
            nxt = lines[j].strip()
            if not nxt or entry_re.match(nxt) or re.match(r"^[^：]{1,12}(可买|全部档位)", nxt):
                break
            body_lines.append(nxt)
            j += 1
        body = "\n".join(body_lines)
        direct = _direct_from_entry(amount_text, body)
        if code not in funds or funds[code]["direct_limit_amount"] is None:
            funds[code] = {
                "direct_limit_amount": direct,
                "direct_channel_note": body[:120],
                "direct_source_status": "wechat-daily",
                "anxinle_verified": False,
            }
        i = j if j > i + 1 else i + 1
    return {"as_of": as_of, "funds": funds}


def fetch_from_wechat() -> dict:
    """公众号兜底：返回 {as_of, funds}。失败抛异常。"""
    pub_date, real_url = search_wechat_daily()
    if not real_url:
        raise RuntimeError("搜狗未找到「QDII额度日报」近期文章")
    article_html = _http_get(real_url, referer="https://mp.weixin.qq.com/")
    data = parse_wechat_article(article_html)
    if not data["funds"]:
        raise RuntimeError("公众号正文解析到 0 只基金，排版可能已变更")
    if data.get("as_of") is None:
        data["as_of"] = pub_date
    return data


def fetch_direct_limits(allow_wechat_fallback: bool = True) -> dict:
    """主入口：安信乐全量打底；网站滞后当日或失败时，用公众号日报补充。

    两源口径差异：安信乐=全量 164 只（每交易日更新，常滞后一天）；
    公众号=当日摘要（仅列重点档位与有直销差异的基金）。合并规则：
    公众号中**有明确直销值**的条目覆盖安信乐同代码旧值；其余保留安信乐。

    返回 {as_of, source, funds}。两源都不可用时抛异常。
    """
    anxinle = None
    try:
        raw = fetch_direct_limits_anxinle()
        anxinle = {
            "as_of": raw.get("as_of"),
            "funds": raw.get("funds", {}),
            "source": "anxinletech.com",
        }
        for info in anxinle['funds'].values():
            info.update(direct_as_of=raw.get('as_of'), direct_source='anxinletech.com',
                        direct_source_url=ANXINLE_URL)
    except Exception as e:  # noqa: BLE001
        log.warning("安信乐数据源失败: %s", e)

    result = anxinle or {"as_of": None, "funds": {}, "source": "anxinletech.com"}

    today = _dt.date.today().isoformat()
    if anxinle and anxinle["as_of"] == today and all(
        info.get('direct_limit_amount') is not None or info.get('announcement_limit_amount') is not None
        for info in anxinle['funds'].values()
    ):
        return result  # 网站已是当日全量，无需公众号补充

    if not allow_wechat_fallback:
        if not anxinle:
            raise RuntimeError('安鑫乐网站不可用')
        return result

    try:
        wechat = fetch_from_wechat()
    except Exception as e:  # noqa: BLE001
        log.warning("公众号兜底失败: %s", e)
        if anxinle:
            return result
        raise

    if not wechat.get('as_of') or wechat['as_of'] > today:
        return result
    if result.get('as_of') and wechat['as_of'] < result['as_of']:
        return result

    # 公众号当日数据覆盖：仅覆盖有明确直销值（含暂停=0）的条目
    merged = dict(result["funds"])
    covered = 0
    for code, info in wechat["funds"].items():
        if info["direct_limit_amount"] is None:
            continue
        base = merged.get(code) or {
            "direct_limit_amount": None,
            "direct_channel_note": "",
            "direct_source_status": "",
            "anxinle_verified": False,
        }
        if (base.get('direct_as_of') == wechat['as_of'] and
                (base.get('direct_limit_amount') is not None or base.get('announcement_limit_amount') is not None)):
            continue
        base["direct_limit_amount"] = info["direct_limit_amount"]
        base["direct_channel_note"] = info["direct_channel_note"]
        base["direct_source_status"] = info["direct_source_status"]
        base.update(direct_as_of=wechat['as_of'], direct_source='wechat-regex',
                    direct_source_url=wechat.get('source_url'))
        merged[code] = base
        covered += 1

    if wechat.get("as_of"):
        result["as_of"] = max((result["as_of"] or "", wechat["as_of"]))
        if anxinle:
            result["source"] = (
                f"anxinletech.com + wechat:{wechat['as_of']}"
                if covered else "anxinletech.com"
            )
        else:
            result["source"] = f"wechat:QDII额度日报({wechat['as_of']})"
    result["funds"] = merged
    log.info("公众号覆盖 %d 只当日条目", covered)
    return result


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    parser = argparse.ArgumentParser(description="抓取安鑫乐 QDII 直销限额")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    data = fetch_direct_limits()
    with_limits = sum(1 for f in data["funds"].values() if f["direct_limit_amount"])
    log.info("解析 %d 只基金（直销限额 %d 只），数据日期 %s，来源 %s",
             len(data["funds"]), with_limits, data["as_of"], data.get("source"))

    payload = {
        "source": data.get("source", "unknown"),
        "as_of": data["as_of"],
        "fetched_at": _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "funds": data["funds"],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    log.info("已写出 %s", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
