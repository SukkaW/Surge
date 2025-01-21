# Sukka Ruleset

由 [Sukka](https://skk.moe) 搜集、整理、维护的、个人自用的、适用于 [Surge](https://nssurge.com/)、[Clash Meta (mihomo)](https://wiki.metacubex.one/) 和 [sing-box](https://sing-box.sagernet.org/) 的 Ruleset Snippet。

## 条款和协议

本项目除 `List/ip/china_ip.conf` 文件使用 CC BY-SA 2.0 协议分享以外，均使用 AGPL-3.0 协议开源，不提供任何担保，即：**本项目的作者和所有贡献者不会提供任何技术支持，也不会对你的任何损失负责**，包括但不限于：你的软件无法启动和正常工作、Kernel Panic、设备无法开机或正常使用、硬盘损坏或数据丢失、原子弹爆炸、第三次世界大战、[SCP 基金会](https://scp-wiki-cn.wikidot.com/) 无法阻止的全球 CK 级现实重构等。

如果你正在使用商业性质的公共代理服务，请务必先仔细阅读相关服务商的 服务条款与条件（ToS）。部分公共代理服务商的服务条款与条件规定，如果用户使用任何第三方规则文件将会被视为自动放弃 SLA 和技术支持服务。

如果你从 Sukka 提供的 Ruleset Server（[`https://ruleset.skk.moe`](https://ruleset.skk.moe)）获取本项目中的规则组文件，则意味着你已知晓并同意 [隐私政策](https://skk.moe/privacy-policy/) 中的所有条款。如果你不同意，请通过 GitHub 获取本项目中的源码、自行构建规则组文件。

## 规则组列表

**请务必按照 `domainset`、`non_ip`、`ip`，和 README 中的顺序 将规则组添加到你的配置文件中，确保所有 `domainset` 或 `non_ip` 规则组 位于所有的 `ip` 规则组之前**。

> Surge 和 Clash 会按照规则在配置中的顺序、从上到下逐一匹配，当且仅当进行 IP 规则的匹配、FINAL、或 direct 策略时，才会进行 DNS 解析。按照一定的顺序添加规则组，可以避免不必要的 DNS 解析。

#### 广告拦截 / 隐私保护 / Malware 拦截 / Phiishing 拦截

- 自动生成
- 数据来源、白名单域名列表和生成方式，请参考 [`build-reject-domainset.ts`](Build/build-reject-domainset.ts)
- 仅建议在 Surge for Mac 上使用，移动平台请使用专门的工具（如 ADGuard for Android/iOS）以获得更好的性能
- **不能替代浏览器广告屏蔽扩展（如 AdGuard for Browser）**

**Surge**

```ini
# Non IP
# 基础的 12 万拦截域名
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/reject.conf,REJECT,extended-matching,pre-matching
# 额外 20 万拦截域名，作为基础的补充，启用时需要搭配基础一起使用
# 在 Surge 5 for Mac（或更新版本），即使同时启用基础和额外的拦截域名也不会导致匹配性能下降或内存占用过高
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/reject_extra.conf,REJECT,pre-matching
RULE-SET,https://ruleset.skk.moe/List/non_ip/reject.conf,REJECT,extended-matching,pre-matching
RULE-SET,https://ruleset.skk.moe/List/non_ip/reject-no-drop.conf,REJECT-NO-DROP,extended-matching,pre-matching
RULE-SET,https://ruleset.skk.moe/List/non_ip/reject-drop.conf,REJECT-DROP,pre-matching
# URL-REGEX
# 需搭配 Surge 模块 https://ruleset.skk.moe/Modules/sukka_mitm_hostnames.sgmodule 使用
# MITM 和 URL-REGEX 性能开销极大，不推荐使用
# RULE-SET,https://ruleset.skk.moe/List/non_ip/reject-url-regex.conf,REJECT

# IP
RULE-SET,https://ruleset.skk.moe/List/ip/reject.conf,REJECT-DROP
```

**Clash Meta**

```yaml
rule-providers:
  reject_non_ip_no_drop:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/reject-no-drop.txt
    path: ./sukkaw_ruleset/reject_non_ip_no_drop.txt
  reject_non_ip_drop:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/reject-drop.txt
    path: ./sukkaw_ruleset/reject_non_ip_drop.txt
  reject_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/reject.txt
    path: ./sukkaw_ruleset/reject_non_ip.txt
  reject_domainset:
    type: http
    behavior: domain
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/domainset/reject.txt
    path: ./sukkaw_ruleset/reject_domainset.txt
  # 在 Clash 上，同时启用基础和额外的拦截域名会导致内存占用过高和匹配用时增加等性能问题
  reject_extra_domainset:
    type: http
    behavior: domain
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/domainset/reject_extra.txt
    path: ./sukkaw_ruleset/reject_domainset_extra.txt
  reject_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/reject.txt
    path: ./sukkaw_ruleset/reject_ip.txt

rules:
  - RULE-SET,reject_non_ip,REJECT

  - RULE-SET,reject_domainset,REJECT
  - RULE-SET,reject_extra_domainset,REJECT

  - RULE-SET,reject_ip,REJECT
  - RULE-SET,reject_non_ip_drop,REJECT-DROP
  - RULE-SET,reject_non_ip_no_drop,REJECT
```

#### 搜狗输入法

- 人工维护
- 该规则组用于避免搜狗输入法将你输入的每一个字符自动收集并通过 `get.sogou.com/q` 等域名回传
- 影响搜狗输入法账号同步、词库更新、问题反馈

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/sogouinput.conf,REJECT
```

**Clash Meta**

```yaml
rule-providers:
  sogouinput:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/sogouinput.txt
    path: ./sukkaw_ruleset/sogouinput.txt

rules:
  - RULE-SET,sogouinput,REJECT
```

#### Speedtest 测速域名

- `speedtest.net` 测速点通过 Speedtest API 获取数十个常见地区的测速服务器域名
- 人工维护 macOS `netQuality` 等其它测速工具的测速服务器域名
- `fast.com` 测速点和 Netflix CDN 共享基础设施和域名、影响流媒体分流，故不包含在此规则组中
- 实现指定使用某网络出口测速、同时不影响通过主要出口正常上网

**Surge**

```ini
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/speedtest.conf,[替换你的策略名],extended-matching
```

#### 常见静态 CDN

- 自动生成 + 人工维护
- 包含所有常见静态资源 CDN 域名、对象存储域名
- 如果你正在使用商业性质的公共代理服务、且你的服务商提供按低倍率结算流量消耗的节点，可使用上述规则组将流量分配给这部分节点
- 包含部分未包含在 `global.conf` 的域名，因此即使你用不到商业性质的公共代理服务提供的低倍率节点也不需要分流，也依然建议使用这部分规则，此时分配与 `global.conf` 相同的策略即可

**Surge**

```ini
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/cdn.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/cdn.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  cdn_domainset:
    type: http
    behavior: domain
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/domainset/cdn.txt
    path: ./sukkaw_ruleset/cdn_domainset.txt
  cdn_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/cdn.txt
    path: ./sukkaw_ruleset/cdn_non_ip.txt

rules:
  - RULE-SET,cdn_domainset,[Replace with your policy]
  - RULE-SET,cdn_non_ip,[Replace with your policy]
```

#### 流媒体

- 人工维护
- 包含 4gtv、AbemaTV、All4、Amazon Prime Video、Apple TV、Apple Music TV、Bahamut、BBC、Bilibili Intl、DAZN、Deezer、Disney+、Discovery+、DMM、encoreTVB、Fox Now、Fox+、HBO GO/Now/Max/Asia、Hulu、HWTV、JOOX、Jwplayer、KKBOX、KKTV、Line TV、Naver TV、myTV Super、Netflix、niconico、Now E、Paramount+、PBS、Peacock、Pandora、PBS、Pornhub、SoundCloud、PBS、Spotify、TaiwanGood、Tiktok Intl、Twitch、ViuTV、ShowTime、iQiYi Global、Himalaya Podcast、Overcast、WeTV 的规则组

**Surge**

```ini
# 北美相关流媒体
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream_us.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream_us.conf,[Replace with your policy]
# 欧洲相关流媒体
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream_eu.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream_eu.conf,[Replace with your policy]
# 日本相关流媒体
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream_jp.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream_jp.conf,[Replace with your policy]
# 韩国相关流媒体
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream_kr.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream_kr.conf,[Replace with your policy]
# 香港相关流媒体
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream_hk.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream_hk.conf,[Replace with your policy]
# 台湾相关流媒体
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream_tw.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream_tw.conf,[Replace with your policy]
# 所有流媒体（包括上述所有流媒体）
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  # 北美相关流媒体
  stream_us_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/stream_us.txt
    path: ./sukkaw_ruleset/stream_us_non_ip.txt
  stream_us_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/stream_us.txt
    path: ./sukkaw_ruleset/stream_us_ip.txt
  # 欧洲相关流媒体
  stream_eu_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/stream_eu.txt
    path: ./sukkaw_ruleset/stream_eu_non_ip.txt
  stream_eu_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/stream_eu.txt
    path: ./sukkaw_ruleset/stream_eu_ip.txt
  # 日本相关流媒体
  stream_jp_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/stream_jp.txt
    path: ./sukkaw_ruleset/stream_jp_non_ip.txt
  stream_jp_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/stream_jp.txt
    path: ./sukkaw_ruleset/stream_jp_ip.txt
  # 韩国相关流媒体
  stream_kr_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/stream_kr.txt
    path: ./sukkaw_ruleset/stream_kr_non_ip.txt
  stream_kr_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/stream_kr.txt
    path: ./sukkaw_ruleset/stream_kr_ip.txt
  # 香港相关流媒体
  stream_hk_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/stream_hk.txt
    path: ./sukkaw_ruleset/stream_hk_non_ip.txt
  stream_hk_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/stream_hk.txt
    path: ./sukkaw_ruleset/stream_hk_ip.txt
  # 台湾相关流媒体
  stream_tw_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/stream_tw.txt
    path: ./sukkaw_ruleset/stream_tw_non_ip.txt
  stream_tw_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/stream_tw.txt
    path: ./sukkaw_ruleset/stream_tw_ip.txt
  # 所有流媒体（包括上述所有流媒体）
  stream_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/stream.txt
    path: ./sukkaw_ruleset/stream_non_ip.txt
  stream_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/stream.txt
    path: ./sukkaw_ruleset/stream_ip.txt

rules:
  - RULE-SET,stream_us_non_ip,[Replace with your policy]
  - RULE-SET,stream_eu_non_ip,[Replace with your policy]
  - RULE-SET,stream_jp_non_ip,[Replace with your policy]
  - RULE-SET,stream_kr_non_ip,[Replace with your policy]
  - RULE-SET,stream_hk_non_ip,[Replace with your policy]
  - RULE-SET,stream_tw_non_ip,[Replace with your policy]
  - RULE-SET,stream_non_ip,[Replace with your policy]

  - RULE-SET,stream_us_ip,[Replace with your policy]
  - RULE-SET,stream_eu_ip,[Replace with your policy]
  - RULE-SET,stream_jp_ip,[Replace with your policy]
  - RULE-SET,stream_kr_ip,[Replace with your policy]
  - RULE-SET,stream_hk_ip,[Replace with your policy]
  - RULE-SET,stream_tw_ip,[Replace with your policy]
  - RULE-SET,stream_ip,[Replace with your policy]
```

#### AI

- 域名规则 人工维护
- 包含 OpenAI、Google Gemini、Claude、Perplexity 等

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/ai.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  ai_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/ai.txt
    path: ./sukkaw_ruleset/ai_non_ip.txt

rules:
  - RULE-SET,ai_non_ip,[Replace with your policy]
```

#### Telegram

- 域名规则 人工维护
- IP CIDR 规则 自动生成（数据来源：[`https://core.telegram.org/resources/cidr.txt`](https://core.telegram.org/resources/cidr.txt)）
- ASN 规则 人工维护

> 推荐仅使用 IP CIDR 规则。IP CIDR 规则数据完全来自 Telegram 官方发布的 CIDR 列表，不包含 Telegram 尚未启用的 CDN、数据中心的 IP。
> ASN 规则仅适合作为补充；搭配非官方 MaxMind GeoLite 数据库（例如 GeoIP2-CN）使用时会影响匹配。

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/telegram.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/telegram.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/telegram_asn.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  telegram_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/telegram.txt
    path: ./sukkaw_ruleset/telegram_non_ip.txt
  telegram_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/telegram.txt
    path: ./sukkaw_ruleset/telegram_ip.txt

rules:
  - RULE-SET,telegram_non_ip,[Replace with your policy]
  - RULE-SET,telegram_ip,[Replace with your policy]
```

#### Apple CDN

- 自动生成
- 规则组包含 Apple, Inc. 在中华人民共和国完成工信部 ICP 备案和公安网备、且在中华人民共和国境内提供 HTTP 服务的域名，如果由于某些原因需要代理其中部分域名，请自行针对域名编写规则、并添加到当前规则组之前。
- 数据来源 [`felixonmars/dnsmasq-china-list`](https://github.com/felixonmars/dnsmasq-china-list/blob/master/apple.china.conf)

**Surge**

```ini
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/apple_cdn.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  apple_cdn:
    type: http
    behavior: domain
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/domainset/apple_cdn.txt
    path: ./sukkaw_ruleset/apple_cdn.txt

rules:
  - RULE-SET,apple_cdn,[Replace with your policy]
```

#### Apple Service

- 人工维护

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_services.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  apple_services:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/apple_services.txt
    path: ./sukkaw_ruleset/apple_services.txt

rules:
  - RULE-SET,apple_services,[Replace with your policy]
```

#### Apple CN

- 人工维护
- 云上贵州（`icloud.com.cn`）和 苹果地图大陆特供版 等服务的域名。

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_cn.conf,DIRECT
```

**Clash Meta**

```yaml
rule-providers:
  apple_cn_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/apple_cn.txt
    path: ./sukkaw_ruleset/apple_cn_non_ip.txt

rules:
  - RULE-SET,apple_cn_non_ip,[Replace with your policy]
```

#### Microsoft CDN

- 自动生成
- 规则组包含 Microsoft 在中华人民共和国完成工信部 ICP 备案和公安网备、且在中华人民共和国境内提供 HTTP 服务的域名，如果由于某些原因需要代理其中部分域名，请自行针对域名编写规则、并添加到当前规则组之前。
- 数据来源 [`felixonmars/dnsmasq-china-list`](https://github.com/felixonmars/dnsmasq-china-list/blob/master/apple.china.conf)

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/microsoft_cdn.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  microsoft_cdn_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/microsoft_cdn.txt
    path: ./sukkaw_ruleset/microsoft_cdn_non_ip.txt

rules:
  - RULE-SET,microsoft_cdn_non_ip,[Replace with your policy]
```

#### Microsoft

- 人工维护

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/microsoft.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  microsoft_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/microsoft.txt
    path: ./sukkaw_ruleset/microsoft_non_ip.txt

rules:
  - RULE-SET,microsoft_non_ip,[Replace with your policy]
```

#### 网易云音乐

- 人工维护

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/neteasemusic.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/neteasemusic.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  neteasemusic_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/neteasemusic.txt
    path: ./sukkaw_ruleset/neteasemusic_non_ip.txt
  neteasemusic_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/neteasemusic.txt
    path: ./sukkaw_ruleset/neteasemusic_ip.txt

rules:
  - RULE-SET,neteasemusic_non_ip,[Replace with your policy]
  - RULE-SET,neteasemusic_ip,[Replace with your policy]
```

#### 软件更新、操作系统等大文件下载

- 人工维护
- 包含部分常见对象存储的域名
- 这部分域名可能包含 Microsoft 和 Apple 的国内 CDN 节点。你可以搭配使用前文的 Microsoft CDN 和 Apple CDN 规则组、并分配直连策略。
- 如果你正在使用商业性质的公共代理服务、且你的服务商提供按低倍率结算流量消耗的节点，可使用上述规则组将流量分配给这部分节点

**Surge**

```ini
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/download.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/download.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  download_domainset:
    type: http
    behavior: domain
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/domainset/download.txt
    path: ./sukkaw_ruleset/download_domainset.txt
  download_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/download.txt
    path: ./sukkaw_ruleset/download_non_ip.txt

rules:
  - RULE-SET,download_domainset,[Replace with your policy]
  - RULE-SET,download_non_ip,[Replace with your policy]
```

#### 内网域名和局域网 IP

- 人工维护
- 域名列表包含 `.local` 和局域网 IP 的 `in-addr.arpa` 域名（即 AS112 域名）。这部分域名一般会被解析到局域网 IP、需要走内网 DNS 解析、需要直连访问。
- Clash 没有内置局域网 IP 规则列表（Surge 内置有局域网 IP 规则列表 `LAN`），需要手动引入。

**Surge**

```ini
# Non IP
RULE-SET,https://ruleset.skk.moe/List/non_ip/lan.conf,DIRECT
# IP
RULE-SET,https://ruleset.skk.moe/List/ip/lan.conf,DIRECT
```

**Clash Meta**

```yaml
rule-providers:
  lan_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/lan.txt
    path: ./sukkaw_ruleset/lan_non_ip.txt
  lan_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/lan.txt
    path: ./sukkaw_ruleset/lan_ip.txt

rules:
  - RULE-SET,lan_non_ip,DIRECT
  - RULE-SET,lan_ip,DIRECT
```

#### Misc

- 人工维护

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/domestic.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/direct.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/global.conf,PROXY
RULE-SET,https://ruleset.skk.moe/List/ip/domestic.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  domestic_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/domestic.txt
    path: ./sukkaw_ruleset/domestic_non_ip.txt
  direct_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/direct.txt
    path: ./sukkaw_ruleset/direct_non_ip.txt
  global_non_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/non_ip/global.txt
    path: ./sukkaw_ruleset/global_non_ip.txt
  domestic_ip:
    type: http
    behavior: classical
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/domestic.txt
    path: ./sukkaw_ruleset/domestic_ip.txt

rules:
  - RULE-SET,domestic_non_ip,[Replace with your policy]
  - RULE-SET,direct_non_ip,[Replace with your policy]
  - RULE-SET,global_non_ip,[Replace with your policy]
  - RULE-SET,domestic_ip,[Replace with your policy]
```

#### chnroute CIDR

- 自动生成
- IPv4 [原始数据](https://github.com/misakaio/chnroutes2) 由 Misaka Network, Inc. 以 [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) 协议发布，二次处理补充合并了 Misaka Network, Inc. 收不到 BGP 路由的部分国内段、排除了被 Misaka Network, Inc. 误收的在香港广播的 IP 段（通常由 中国移动国际 CMI 广播）
- IPv6 原始数据 由 [gaoyifan/china-operator-ip](https://github.com/gaoyifan/china-operator-ip) 以 MIT 协议发布

**Surge**

```ini
RULE-SET,https://ruleset.skk.moe/List/ip/china_ip.conf,[Replace with your policy]
# Only use it if you are using IPv6
# RULE-SET,https://ruleset.skk.moe/List/ip/china_ip_ipv6.conf,[Replace with your policy]
```

**Clash Meta**

```yaml
rule-providers:
  china_ip:
    type: http
    behavior: ipcidr
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/china_ip.txt
    path: ./sukkaw_ruleset/china_ip.txt
  china_ip_ipv6:
    type: http
    behavior: ipcidr
    format: text
    interval: 43200
    url: https://ruleset.skk.moe/Clash/ip/china_ip_ipv6.txt
    path: ./sukkaw_ruleset/china_ipv6.txt
rules:
  - RULE-SET,china_ip,[Replace with your policy]
  # Only use it if you are using IPv6
  # - RULE-SET,china_ip_ipv6,[Replace with your policy]
```

## Surge 模块列表

- Sukka URL Rewrite: `https://ruleset.skk.moe/Modules/sukka_url_rewrite.sgmodule`
- Sukka Surge Network Test Domain: `https://ruleset.skk.moe/Modules/sukka_surge_network_test_domain.sgmodule`
- Sukka MITM Hostnames: `https://ruleset.skk.moe/Modules/sukka_mitm_hostnames.sgmodule`
- Sukka MITM All Hostnames: `https://ruleset.skk.moe/Modules/sukka_mitm_all_hostnames.sgmodule`
- Exclude Reserved IP from Surge VIF: `https://ruleset.skk.moe/Modules/sukka_exclude_reservered_ip.sgmodule`
- Common Always Real IP Hostnames: `https://ruleset.skk.moe/Modules/sukka_common_always_realip.sgmodule`
- Redirect Google CN to Google: `https://ruleset.skk.moe/Modules/google_cn_307.sgmodule`

## FAQ

**这是什么？**

我也不知道。

**有适用于 Clash 的规则组吗？**

规则组支持 Clash Meta（mihomo）。「Surge 模块」不适用于任何版本的 Clash。

**有适用于 Shadowrocket、Quantumult X、Loon、V2RayNG 的规则组吗？**

没有。而且未来 **一定** 不会有。

**这些规则组可被用于 Surfboard 吗？**

如果 Surfboard 能够完整解析 Surge 的所有 Syntax，且在导入 / 处理规则组时、不被支持的 Syntax（如涉及到 MITM 的 `URL-REGEX`、仅适用于 HTTP/HTTPS 请求的 `USER-AGENT`、仅支持 PC/Mac 平台的 `PROCESS-NAME`）在处理时仅 Silent Error，则可用于 Surfboard，反之则不适用。

**我使用你的规则组，结果出了问题，我该如何反馈？**

不，你不能。

**那我能参与维护项目、修复问题吗？**

如果你的 Pull Request 出现在了我 GitHub Notification Inbox 中、然后被我看到了的话，我会 Review 的。

## License

The `List/ip/china_ip.conf` file is licensed under [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). The rest of the files are licensed under [AGPL-3.0](./LICENSE).

----

**Surge** © [Sukka](https://github.com/SukkaW), Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/Surge/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Twitter [@isukkaw](https://twitter.com/isukkaw) · Keybase [@sukka](https://keybase.io/sukka)

<p align="center">
  <a href="https://github.com/sponsors/SukkaW/">
    <img src="https://sponsor.cdn.skk.moe/sponsors.svg"/>
  </a>
</p>

