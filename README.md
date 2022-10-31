# Surge

由 [Sukka](https://skk.moe) 搜集、整理、维护的、个人自用的、仅适用于 [Surge](https://nssurge.com/) 的 Rule Snippet。

## 条款和协议

本项目除 `List/ip/china_ip.conf` 文件使用 CC BY-SA 2.0 协议分享以外，均使用 AGPL-3.0 协议开源，不提供任何担保，即：**本项目的作者和所有贡献者不会提供任何技术支持，也不会对你的任何损失负责**，包括但不限于：你的软件无法启动和正常工作、Kernel Panic、设备无法开机或正常使用、硬盘损坏或数据丢失、原子弹爆炸、第三次世界大战、[SCP 基金会](https://scp-wiki-cn.wikidot.com/) 无法阻止的全球 CK 级现实重构等。

如果你正在使用商业性质的公共代理服务，请务必先仔细阅读相关服务商的 服务条款与条件（ToS）。部分公共代理服务商的服务条款与条件规定，如果用户使用任何第三方规则文件将会被视为自动放弃 SLA 和技术支持服务。

如果你从 Sukka 提供的 Surge Ruleset Server（[`https://ruleset.skk.moe`](https://ruleset.skk.moe)）获取本项目中的规则组文件，则意味着你已知晓并同意 [隐私政策](https://skk.moe/privacy-policy/) 中的所有条款。如果你不同意，请通过 GitHub 获取本项目中的源码、自行构建规则组文件。

## 规则组列表

请按照 `non_ip`、`ip`，和 README 中的顺序 将规则组添加到你的配置文件中。

> Surge 和 Clash 会按照规则在配置中的顺序、从上到下逐一匹配，当且仅当进行 IP 规则的匹配、FINAL、或 direct 策略时，才会进行 DNS 解析。按照一定的顺序添加规则组，可以避免不必要的 DNS 解析。

#### 广告拦截 / 隐私保护 / Malware 拦截 / Phiishing 拦截

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/reject.conf,reject
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/reject.conf,reject-tinygif
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/reject_sukka.conf,reject-tinygif
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/reject_phishing.conf,reject
RULE-SET,https://ruleset.skk.moe/List/ip/reject.conf,reject-drop
```

- 自动生成
- 数据来源、白名单域名列表和生成方式，请参考 [`build-reject-domainset.js`](Build/build-reject-domainset.js)
- 仅建议在 Surge for Mac 上使用，移动平台请使用专门的工具（如 ADGuard for Android/iOS）以获得更好的性能
- 不能替代浏览器广告屏蔽扩展（如 uBlock Origin）

#### 搜狗输入法

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/sogouinput.conf,reject-drop
```

- 人工维护
- 该规则组用于避免搜狗输入法将你输入的每一个字符自动收集并通过 `get.sogou.com/q` 等域名回传
- 影响搜狗输入法账号同步、词库更新、问题反馈

#### 常见静态 CDN

```ini
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/cdn.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/cdn.conf,[Replace with your policy]
```

- 自动生成 + 人工维护
- 包含所有常见静态资源 CDN 域名、对象存储域名
- 如果你正在使用商业性质的公共代理服务、且你的服务商提供按低倍率结算流量消耗的节点，可使用上述规则组将流量分配给这部分节点

#### 流媒体

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/stream.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/stream.conf,[Replace with your policy]
```

- 人工维护
- 包含 4gtv、AbemaTV、All4、Amazon Prime Video、Apple TV、Apple Music TV、Bahamut、BBC、Bilibili Intl、DAZN、Deezer、Disney+、Discovery+、DMM、encoreTVB、Fox Now、Fox+、HBO GO/Now/Max/Asia、Hulu、HWTV、JOOX、Jwplayer、KKBOX、KKTV、Line TV、Naver TV、myTV Super、Netflix、niconico、Now E、Paramount+、PBS、Peacock、Pandora、PBS、Pornhub、SoundCloud、PBS、Spotify、TaiwanGood、Tiktok Intl、Twitch、ViuTV、ShowTime、iQiYi Global、Himalaya Podcast、Overcast、WeTV 的规则组

#### Telegram

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/telegram.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/telegram.conf,[Replace with your policy]
```

- 域名规则 人工维护
- IP CIDR 规则 自动生成（数据来源：[`https://core.telegram.org/resources/cidr.txt`](https://core.telegram.org/resources/cidr.txt)）

#### Apple CDN

```ini
DOMAIN-SET,https://ruleset.skk.moe/List/domainset/apple_cdn.conf,[Replace with your policy]
```

- 自动生成
- 规则组包含 Apple, Inc. 在中华人民共和国完成工信部 ICP 备案和公安网备、且在中华人民共和国境内提供 HTTP 服务的域名，如果由于某些原因需要代理其中部分域名，请自行针对域名编写规则、并添加到当前规则组之前。
- 数据来源 [`felixonmars/dnsmasq-china-list`](https://github.com/felixonmars/dnsmasq-china-list/blob/master/apple.china.conf)

#### Apple Service

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_services.conf,[Replace with your policy]
```

- 人工维护

#### 网易云音乐

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/neteasemusic.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/ip/neteasemusic.conf,[Replace with your policy]
```

- 人工维护

#### Misc

```ini
RULE-SET,https://ruleset.skk.moe/List/non_ip/domestic.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/direct.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/global_plus.conf,[Replace with your policy]
RULE-SET,https://ruleset.skk.moe/List/non_ip/global.conf,PROXY
RULE-SET,https://ruleset.skk.moe/List/ip/domestic.conf,[Replace with your policy]
```

- 人工维护

#### chnroute CIDR

```ini
RULE-SET,https://ruleset.skk.moe/List/ip/china_ip.conf,[Replace with your policy]
```

- 自动生成
- [原始数据](https://github.com/misakaio/chnroutes2) 由 Misaka Network, Inc.、DMIT, Inc.、NEROCLOUD Ltd.、Rainbow network Ltd.、MOACK Co., Ltd. 提供，由 Misaka Network, Inc. 整理，以 [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) 协议发布

## Surge 模块列表

- Sukka URL Rewrite: `https://ruleset.skk.moe/Modules/sukka_url_rewrite.sgmodule`
- Sukka Surge Network Test Domain: `https://ruleset.skk.moe/Modules/sukka_surge_network_test_domain.sgmodule`
- Sukka MITM Hostnames: `https://ruleset.skk.moe/Modules/sukka_mitm_hostnames.sgmodule`
- Sukka MITM All Hostnames: `https://ruleset.skk.moe/Modules/sukka_mitm_all_hostnames.sgmodule`
- Fix No Network Alert Plus: `https://ruleset.skk.moe/Modules/sukka_fix_network_alert.sgmodule`
- Exclude Reserved IP from Surge VIF: `https://ruleset.skk.moe/Modules/sukka_exclude_reservered_ip.sgmodule`
- Common Always Real IP Hostnames: `https://ruleset.skk.moe/Modules/sukka_common_always_realip.sgmodule`
- Hide iOS VPN Icon: `https://ruleset.skk.moe/Modules/ios_hide_vpn_icon.sgmodule`
- Redirect Google CN to Google: `https://ruleset.skk.moe/Modules/google_cn_307.sgmodule`

## FAQ

**这是什么？**

我也不知道。

**有适用于 Clash 的规则组吗？**

没有。如果 [Clash Premium 提供了对 `DOMAIN-SET` 格式的支持](https://github.com/Dreamacro/clash/issues/1838)，未来可能会有。

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
