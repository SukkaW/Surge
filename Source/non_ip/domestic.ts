import type { DNSMapping } from './direct';

export const DOMESTICS: Record<string, DNSMapping> = {
  ALIBABA: {
    hosts: {},
    dns: 'quic://dns.alidns.com:853',
    realip: false,
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
      '+alipayobjects.com',
      'alibaba-inc.com',
      '+alibabausercontent.com',
      '+alibabadns.com',
      'alicloudccp.com',
      'alipan.com',
      'aliyundrive.com',
      'aliyundrive.net',
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
      'taobao.com',
      '+taobaocdn.com',
      '+tbcache.com',
      'tmall.com',
      // 'tmall.hk',
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
      'koubei.com',
      'mybank.cn',
      'mmstat.com',
      'uczzd.cn',
      'iconfont.cn',
      'freshhema.com',
      'hemamax.com',
      'hemaos.com',
      'hemashare.cn',
      'shyhhema.com',
      'sm.cn',
      'npmmirror.com',
      'alios.cn',
      'wandoujia.com',
      'aligames.com',
      '25pp.com',
      '+aliapp.org',
      'tanx.com',
      'hellobike.com',
      '+hichina.com',
      '+yunos.com'
    ]
  },
  TENCENT: {
    hosts: {},
    dns: 'https://doh.pub/dns-query',
    realip: false,
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
      '+dnsv1.com'
    ]
  },
  BILIBILI_ALI: {
    dns: 'quic://dns.alidns.com:853',
    hosts: {},
    realip: false,
    domains: [
      '$upos-sz-mirrorali.bilivideo.com',
      '$upos-sz-estgoss.bilivideo.com'
    ]
  },
  BILIBILI_BD: {
    dns: '180.76.76.76',
    hosts: {},
    realip: false,
    domains: [
      '$upos-sz-mirrorbd.bilivideo.com',
      '$upos-sz-mirrorbos.bilivideo.com'
    ]
  },
  BILIBILI: {
    dns: 'https://doh.pub/dns-query',
    hosts: {},
    realip: false,
    domains: [
      // '$upos-sz-mirrorcoso1.bilivideo.com', // already included in bilivideo.com
      '$upos-sz-mirrorcosbstar1.bilivideo.com', // Bilibili Intl with Tencent Cloud CDN
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
      '+bilicdn1.com'
    ]
  },
  XIAOMI: {
    dns: 'https://doh.pub/dns-query',
    hosts: {},
    realip: false,
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
      'xiaomiyoupin.com'
    ]
  },
  BYTEDANCE: {
    dns: '180.184.2.2',
    hosts: {},
    realip: false,
    domains: [
      'bytedance.com.com',
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
      'douyin.com',
      '+douyinpic.com',
      '+douyinstatic.com',
      '+douyincdn.com',
      '+douyinliving.com',
      '+douyinvod.com',
      'huoshan.com',
      '+huoshanstatic.com',
      'huoshanzhibo.com',
      'ixigua.com',
      '+ixiguavideo.com',
      '+ixgvideo.com',
      '+volccdn.com',
      '+byted-static.com',
      'volces.com',
      'baike.com',
      '+zjcdn.com',
      '+zijieapi.com',
      'feelgood.cn',
      '+bytetcc.com', // Use hichina.com as NS
      '+bytednsdoc.com', // Uses alidns.com as NS
      '+byteimg.com', // Uses alidns.com as NS
      '+byteacctimg.com', // Uses alidns.com as NS
      '+ibytedapm.com', // China NS
      'oceanengine.com'
    ]
  },
  BAIDU: {
    dns: '180.76.76.76',
    hosts: {},
    realip: false,
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
      'xiaodutv.com',
      '+shifen.com',
      '+jomodns.com',
      '+bdydns.com',
      '+jomoxc.com', // Baidu PCDN, of sort
      '+duapp.com',
      '+antpcdn.com' // Baidu PCDN
    ]
  },
  QIHOO360: {
    hosts: {},
    dns: 'https://doh.360.cn/dns-query',
    realip: false,
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
      'qiku.com'
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
    dns: 'quic://223.5.5.5:853',
    domains: [
      '$dns.alidns.com'
    ]
  },
  DNSPOD: {
    hosts: {
      // 'dot.pub': ['120.53.53.53', '1.12.12.12'],
      'doh.pub': ['120.53.53.53', '1.12.12.12']
      // 'dns.pub': ['120.53.53.53', '1.12.12.12']
    },
    realip: false,
    dns: 'https://1.12.12.12/dns-query',
    domains: [
      // '$dot.pub',
      '$doh.pub'
      // '$dns.pub'
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
