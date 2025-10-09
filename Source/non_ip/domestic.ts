import type { DNSMapping } from './direct';

export const DOMESTICS: Record<string, DNSMapping> = {
  ALIBABA: {
    hosts: {},
    dns: 'quic://dns.alidns.com:853',
    realip: false,
    ruleset: true,
    domains: [
      'uc.cn',
      // 'ucweb.com', // UC International
      'alibaba.com',
      '+alicdn.com',
      '+ialicdn.com',
      '+myalicdn.com',
      '+alidns.com',
      '+aliimg.com',
      'aliyun.com',
      '+aliyuncs.com',
      '+alikunlun.com',
      '+alikunlun.net',
      '+cdngslb.com',
      'alipay.com',
      'alipay.cn',
      'alipay.com.cn',
      'alipaydev.com',
      '+alipayobjects.com',
      'alibaba-inc.com',
      '+alibabausercontent.com',
      '+alibabadns.com',
      'alibabachengdun.com',
      'alicloudccp.com',
      'alipan.com',
      'aliyundrive.com',
      'aliyundrive.net',
      'alimama.com',
      'cainiao.com',
      'cainiao.com.cn',
      'cainiaoyizhan.com',
      'guoguo-app.com',
      'etao.com',
      'yitao.com',
      '1688.com',
      'amap.com',
      'gaode.com',
      'autonavi.com',
      'dingtalk.com',
      'mxhichina.com',
      'soku.com',
      'tb.cn',
      '+tbcdn.cn',
      'taobao.com',
      'taobao.org',
      '+taobaocdn.com',
      '+tbcache.com',
      'tmall.com',
      // 'tmall.hk',
      'goofish.com',
      'xiami.com',
      'xiami.net',
      '+ykimg.com',
      'youku.com',
      'tudou.com',
      '+cibntv.net',
      'ele.me',
      '+elemecdn.com',
      'feizhu.com',
      'taopiaopiao.com',
      'fliggy.com',
      'alibtrip.com',
      'koubei.com',
      'mybank.cn',
      'mmstat.com',
      'uczzd.cn',
      'iconfont.cn',
      'freshhema.com',
      'freshippo.com',
      'hemamax.com',
      'hemaos.com',
      'hemashare.cn',
      'shyhhema.com',
      'sm.cn',
      'npmmirror.com',
      'alios.cn',
      'wandoujia.com',
      '9game.cn',
      'aligames.com',
      '25pp.com',
      '+aliapp.org',
      'tanx.com',
      'hellobike.com',
      '+hichina.com',
      '+yunos.com',
      '+nlark.com',
      '+yuque.com',

      // Bilibili Aliyun CDN
      '$upos-sz-mirrorali.bilivideo.com',
      '$upos-sz-estgoss.bilivideo.com',

      // AcFun CDN
      '$ali-safety-video.acfun.cn'
    ]
  },
  TENCENT: {
    hosts: {},
    dns: 'https://doh.pub/dns-query',
    realip: false,
    ruleset: true,
    domains: [
      // 'dns.pub',
      // 'doh.pub',
      // 'dot.pub',
      '+qcloud.com',
      '+gtimg.cn',
      '+gtimg.com',
      '+gtimg.com.cn',
      '+gdtimg.com',
      '+idqqimg.com',
      '+udqqimg.com',
      '+igamecj.com', // apex domain no DNS resolution
      'myapp.com',
      '+myqcloud.com',
      'dnspod.com',
      '+qpic.cn',
      '+qlogo.cn',
      'qq.com',
      'qq.com.cn',
      // 'qq.wang',
      // 'qqmail.cn', // not owned by QQ, is sold on hichina.com
      '+qqmail.com',
      'qzone.com',
      'tencent-cloud.cn',
      '+tencent-cloud.net',
      '+tencent-cloud.com', // apex doain resolve to 0.0.0.1 by DNSPod public DNS
      'tencent.com',
      'tencent.com.cn',
      'tencentmusic.com',
      'weixinbridge.com',
      'weixin.com',
      // 'wechat.com', exclude `sgshort.wechat.com`
      'weiyun.com',
      'soso.com',
      'sogo.com',
      'sogou.com',
      '+sogoucdn.com',
      '+roblox.cn', // main domain is redirected to roblox.qq.com, only subdomain no redirect
      'robloxdev.cn',
      'wegame.com',
      'wegame.com.cn',
      'wegameplus.com',
      'cdn-go.cn',
      '+tencentcs.cn',
      '+qcloudimg.com',
      'dnspod.cn',
      'anticheatexpert.com',
      '$url.cn',
      '+qlivecdn.com',
      '+tcdnlive.com',
      '+dnsv1.com',
      '+smtcdns.net',
      'coding.net',
      '+codehub.cn',

      // AcFun QCloud CDN
      '$tx-safety-video.acfun.cn'
    ]
  },
  BILIBILI: {
    dns: 'https://doh.pub/dns-query',
    hosts: {},
    realip: false,
    ruleset: true,
    domains: [
      // '$upos-sz-mirrorcoso1.bilivideo.com', // already included in bilivideo.com
      // '$upos-sz-estgcos.bilivideo.com', // already included in bilivideo.com, tencent cloud cdn
      '$acg.tv',
      '$b23.tv',
      'bilibili.cn',
      'bilibili.com',
      // 'bilibili.tv',
      '+acgvideo.com',
      '+bilivideo.com',
      '+bilivideo.cn',
      '+bilivideo.net',
      '+hdslb.com',
      '+biliimg.com',
      '+biliapi.com',
      '+biliapi.net',
      // 'biligame.cn', // not owned by bilibili, was put on sale by ename
      'biligame.com',
      '+biligame.net', // subdomain only
      'bilicomic.com',
      'bilicomics.com', // m wap version of bilicomic
      // 'bilibilipay.cn', // not owned by bilibili
      // 'bilibilipay.com', // not owned by bilibili
      '+bilicdn1.com',
      '+bulicdn2.com'
    ]
  },
  XIAOMI: {
    dns: 'https://doh.pub/dns-query',
    hosts: {},
    realip: false,
    ruleset: true,
    domains: [
      'mi.com',
      'duokan.com',
      '+mi-img.com',
      '+mi-idc.com',
      '+xiaoaisound.com', // only subdomains
      '+xiaomixiaoai.com', // only subdomains
      '+mi-fds.com',
      '+mifile.cn',
      '+mijia.tech', // only subdomains
      'miui.com',
      'xiaomi.com',
      'xiaomi.cn',
      'xiaomi.net',
      'xiaomiev.com',
      'xiaomiyoupin.com',
      'gorouter.info'
    ]
  },
  BYTEDANCE: {
    dns: '180.184.2.2',
    hosts: {},
    realip: false,
    ruleset: true,
    domains: [
      'bytedance.com',
      '+bytecdn.cn',
      '+volccdn.com',
      '+toutiaoimg.com',
      '+toutiaoimg.cn',
      '+toutiaostatic.com',
      '+toutiaovod.com',
      '+toutiaocloud.com',
      'toutiaopage.com',
      'feiliao.com',
      'iesdouyin.com',
      '+pstatp.com',
      'snssdk.com',
      '+bytegoofy.com',
      'toutiao.com',
      'feishu.cn',
      'feishu.net',
      '+feishucdn.com',
      '+feishupkg.com',
      'baike.com',
      'zjurl.cn',
      'okr.com',
      'douyin.com',
      '+douyinpic.com',
      '+douyinstatic.com',
      '+douyincdn.com',
      '+douyinliving.com',
      '+douyinvod.com',
      'huoshan.com',
      'doubao.com',
      'coze.cn',
      'wukong.com',
      '+huoshanstatic.com',
      'huoshanzhibo.com',
      'ixigua.com',
      '+ixiguavideo.com',
      '+ixgvideo.com',
      '+volccdn.com',
      '+byted-static.com',
      'volces.com', // Use hichina.com NS
      'baike.com',
      '+zjcdn.com',
      '+zijieapi.com',
      'feelgood.cn',
      'volcengine.com',
      '+bytetcc.com', // Use hichina.com NS
      '+bytednsdoc.com', // Uses alidns.com NS
      '+byteimg.com', // Uses alidns.com NS
      '+byteacctimg.com', // Uses alidns.com NS
      '+byteeffecttos.com', // Use hichina.com NS
      '+ibytedapm.com', // China NS
      'oceanengine.com',
      '+edge-byted.com',
      '+volcvideo.com',
      '+bytecdntp.com', // hichina.com NS
      // Done Che Di
      'dongchedi.com',
      'dcarstatic.com',
      'dcarlive.com',
      'dcarimg.com',
      'dcarvod.com',
      'dcarapi.com',
      // PiPiXia
      'pipix.com',
      'ppximg.com',
      'ppxstatic.com',
      'ppxvod.com',
      'xiaoxiaapi.com',
      // rsproxy
      'rsproxy.cn'
    ]
  },
  BAIDU: {
    dns: '180.76.76.76',
    hosts: {},
    realip: false,
    ruleset: true,
    domains: [
      '91.com',
      'hao123.com',
      'baidu.cn',
      'baidu.com',
      'iqiyi.com',
      '+iqiyipic.com',
      '+baidubce.com',
      '+bcelive.com',
      '+baiducontent.com',
      '+baidustatic.com',
      '+bdstatic.com',
      '+bdimg.com',
      '+bcebos.com',
      '+baidupcs.com',
      '+baidubcr.com',
      '+yunjiasu-cdn.net',
      'tieba.com',
      'dwz.cn',
      'zuoyebang.com',
      'zybang.com',
      'xiaodutv.com',
      '+shifen.com',
      '+jomodns.com',
      '+bdydns.com',
      '+jomoxc.com', // Baidu PCDN, of sort
      '+duapp.com',
      '+antpcdn.com', // Baidu PCDN

      // Bilibili Baidu CDN
      '$upos-sz-mirrorbd.bilivideo.com',
      '$upos-sz-mirrorbdb.bilivideo.com',
      '$upos-sz-mirrorbos.bilivideo.com'
    ]
  },
  QIHOO360: {
    hosts: {},
    dns: 'https://doh.360.cn/dns-query',
    realip: false,
    ruleset: true,
    domains: [
      '+qhimg.com',
      '+qhimgs.com',
      '+qhimgs?.com',
      // '+qhimgs0.com',
      // '+qhimgs1.com',
      // '+qhimgs2.com',
      // '+qhimgs3.com',
      // '+qhimgs4.com',
      // '+qhimgs5.com',
      // '+qhimgs6.com',
      '+qhres.com',
      '+qhres2.com',
      '+qhmsg.com',
      '+qhstatic.com',
      '+qhupdate.com',
      '+qihucdn.com',
      '360.com',
      '360.cn',
      '360.net',
      '360safe.com',
      '+360tpcdn.com',
      '360os.com',
      '+360webcache.com',
      '360kuai.com',
      'so.com',
      'haosou.com',
      'yunpan.cn',
      'yunpan.com',
      'yunpan.com.cn',
      '+qh-cdn.com',
      'baomitu.com',
      'qiku.com',
      '360simg.com'
    ]
  }
};

/**
 * This should only be used to build AdGuardHome
 *
 * Note that Surge only supports UDP 53 or Hosts as the bootstrap server of domain DoH
 */
export const DOH_BOOTSTRAP: Record<string, DNSMapping> = {
  ALIBABA: {
    hosts: {
      'dns.alidns.com': ['223.5.5.5', '223.6.6.6', '2400:3200:baba::1', '2400:3200::1']
    },
    realip: false,
    ruleset: false,
    dns: 'quic://223.5.5.5:853',
    domains: [
      '$dns.alidns.com'
    ]
  },
  DNSPOD: {
    hosts: {
      // 'dot.pub': ['120.53.53.53', '1.12.12.12'],
      // 'doh.pub': ['120.53.53.53', '1.12.12.12']
      // 'dns.pub': ['120.53.53.53', '1.12.12.12']
    },
    realip: false,
    ruleset: false,
    dns: '119.29.29.29',
    domains: [
      '$dot.pub',
      '$doh.pub',
      '$dns.pub'
    ]
  },
  QIHOO360: {
    hosts: {
      // dot.360.cn
      // doh.360.cn

      // sdns.360.net
      // dns.360.cn CNAME sdns.360.net

      // dns.360.net
      // doh.360.net CNAME dns.360.net
      // dot.360.net CNAME dns.360.net
    },
    realip: false,
    ruleset: false,
    // Surge only supports UDP 53 or Hosts as the bootstrap server of domain DoH
    dns: '101.198.198.198', // 'https://101.198.198.198/dns-query', // https://101.198.199.200/dns-query
    domains: [
      // '$dns.360.cn',
      // '$dot.360.cn',
      '$doh.360.cn'

      // '$sdns.360.net',

      // '$dns.360.net',
      // '$dot.360.net',
      // '$doh.360.net'
    ]
  }
};

export const AdGuardHomeDNSMapping = {
  system: ['udp://10.10.1.1:53'],
  'https://doh.pub/dns-query': ['tls://dot.pub', 'https://doh.pub/dns-query'],
  'quic://dns.alidns.com:853': ['quic://223.5.5.5', 'quic://223.6.6.6', 'h3://223.5.5.5/dns-query', 'h3://223.6.6.6/dns-query'],
  'https://doh.360.cn/dns-query': ['https://doh.360.cn/dns-query', 'tls://dot.360.cn'],
  '180.76.76.76': ['udp://180.76.76.76'],
  '180.184.2.2': ['udp://180.184.2.2', 'udp://180.184.1.1']
};
