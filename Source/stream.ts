export interface StreamService {
  name: string,
  rules: string[],
  ip?: {
    v4: string[],
    v6: string[]
  }
}

const $4GTV: StreamService = {
  name: '4gtv',
  rules: [
    'DOMAIN-SUFFIX,4gtv.tv',
    'DOMAIN,4gtvfreepcvod-cds.cdn.hinet.net'
  ]
};

const ALL4: StreamService = {
  name: 'All4',
  rules: [
    'DOMAIN-SUFFIX,c4assets.com',
    'DOMAIN-SUFFIX,channel4.com',

    'USER-AGENT,All4*'
  ]
};

const AMAZON_PRIME_VIDEO: StreamService = {
  name: 'Amazon Prime Video',
  rules: [
    'DOMAIN,avodmp4s3ww-a.akamaihd.net',
    'DOMAIN,d1v5ir2lpwr8os.cloudfront.net',
    'DOMAIN,d22qjgkvxw22r6.cloudfront.net',
    'DOMAIN,d25xi40x97liuc.cloudfront.net',
    'DOMAIN,dmqdd6hw24ucf.cloudfront.net',
    'DOMAIN,d27xxe7juh1us6.cloudfront.net',
    'DOMAIN,d184dfn36gombl.cloudfront.net',
    'DOMAIN,d1xfray82862hr.cloudfront.net',
    'DOMAIN,d3196yreox78o9.cloudfront.net',

    'DOMAIN-KEYWORD,avoddashs',

    'DOMAIN-SUFFIX,aiv-cdn.net',
    'DOMAIN-SUFFIX,aiv-delivery.net',
    'DOMAIN-SUFFIX,amazonvideo.com',
    'DOMAIN-SUFFIX,amazonvideo.cc',
    'DOMAIN-SUFFIX,media-amazon.com',
    'DOMAIN-SUFFIX,primevideo.com',
    'DOMAIN-SUFFIX,prime-video.com',
    'DOMAIN-SUFFIX,primevideo.cc',
    'DOMAIN-SUFFIX,primevideo.info',
    'DOMAIN-SUFFIX,primevideo.org',
    'DOMAIN-SUFFIX,primevideo.tv',
    'DOMAIN-SUFFIX,amazonvideodirect.cc',
    'DOMAIN-SUFFIX,amazonprimevideos.com',
    'DOMAIN-SUFFIX,atv-ps.amazon.com',
    'DOMAIN-SUFFIX,avodmp4s3ww-a.akamaihd.net',
    'DOMAIN-SUFFIX,fls-na.amazon.com',

    'USER-AGENT,InstantVideo.US*',
    'USER-AGENT,Prime Video*',
    'PROCESS-NAME,com.amazon.avod.thirdpartyclient'

  ]
};

const ABEMA_TV: StreamService = {
  name: 'AbemaTV',
  rules: [
    'DOMAIN-KEYWORD,abematv.akamaized.net',
    'DOMAIN-SUFFIX,abema.io',
    'DOMAIN-SUFFIX,abema.tv',
    'DOMAIN-SUFFIX,ameba.jp',
    'DOMAIN-SUFFIX,abema-tv.com',
    'DOMAIN-SUFFIX,hayabusa.dev',
    'DOMAIN-SUFFIX,hayabusa.io',
    'DOMAIN-SUFFIX,hayabusa.media',
    'DOMAIN-SUFFIX,amebame.com',
    'DOMAIN-SUFFIX,amebaownd.com',
    'DOMAIN-SUFFIX,amebaowndme.com',
    'DOMAIN-SUFFIX,ameblo.jp',
    'DOMAIN-SUFFIX,dokusho-ojikan.jp',
    'DOMAIN-SUFFIX,winticket.jp',

    'USER-AGENT,AbemaTV*'
  ]
};

const APPLE_TV: StreamService = {
  name: 'Apple TV',
  rules: [
    'DOMAIN,ocvideo.apple.com',
    'DOMAIN,linear.tv.apple.com',
    'DOMAIN,play-edge.itunes.apple.com',
    'DOMAIN,np-edge.itunes.apple.com',
    'DOMAIN,uts-api.itunes.apple.com',
    'DOMAIN,hls-amt.itunes.apple.com',
    'DOMAIN,hls.itunes.apple.com',

    'USER-AGENT,AppleTV*',
    'USER-AGENT,com.apple.tv*',
    'PROCESS-NAME,tv'
  ]
};

const APPLE_MUSIC_TV: StreamService = {
  name: 'Apple Music TV',
  rules: [
    'DOMAIN-SUFFIX,applemusic.com',
    'PROCESS-NAME,music'
  ]
};

const BAHAMUT: StreamService = {
  name: 'Bahamut',
  rules: [
    'DOMAIN,bahamut.akamaized.net',
    'DOMAIN,gamer-cds.cdn.hinet.net',
    'DOMAIN,gamer2-cds.cdn.hinet.net',

    'DOMAIN-SUFFIX,viblast.com',

    'DOMAIN-SUFFIX,bahamut.com.tw',
    'DOMAIN-SUFFIX,gamer.com.tw',

    'USER-AGENT,Anime*'
  ]
};

const BBC: StreamService = {
  name: 'BBC',
  rules: [
    'DOMAIN-KEYWORD,bbcfmt',
    'DOMAIN-KEYWORD,uk-live',

    'DOMAIN-SUFFIX,bbc.co.uk',
    'DOMAIN-SUFFIX,bbci.co.uk',

    'USER-AGENT,BBCiPlayer*'
  ]
};

const BILIBILI_INTL: StreamService = {
  name: 'Bilibili International',
  rules: [
    'DOMAIN-SUFFIX,biliintl.com',
    'DOMAIN,apm-misaka.biliapi.net',
    'DOMAIN,upos-bstar-mirrorakam.akamaized.net',
    'DOMAIN,upos-bstar1-mirrorakam.akamaized.net',
    'DOMAIN-SUFFIX,bilibili.tv',
    'PROCESS-NAME,com.bstar.intl'
  ]
};

const DAZN: StreamService = {
  name: 'DAZN',
  rules: [
    'DOMAIN,d151l6v8er5bdm.cloudfront.net',
    'DOMAIN,d1sgwhnao7452x.cloudfront.net',

    'DOMAIN-KEYWORD,voddazn',

    'DOMAIN-SUFFIX,dazn-api.com',
    'DOMAIN-SUFFIX,dazn.com',
    'DOMAIN-SUFFIX,dazndn.com',
    'DOMAIN-SUFFIX,indazn.com',
    'DOMAIN-SUFFIX,indaznlab.com',

    'DOMAIN-SUFFIX,dca-ll-livedazn-dznlivejp.s.llnwi.net',
    'DOMAIN-SUFFIX,dcalivedazn.akamaized.net',
    'DOMAIN-SUFFIX,dcblivedazn.akamaized.net',

    'USER-AGENT,DAZN*'
  ]
};

const DEEZER: StreamService = {
  name: 'Deezer',
  rules: [
    'DOMAIN-SUFFIX,deezer.com',
    'DOMAIN-SUFFIX,dzcdn.net',
    'USER-AGENT,Deezer*'
  ]
};

const DISNEY_PLUS: StreamService = {
  name: 'Disney+',
  rules: [
    'DOMAIN,cdn.registerdisney.go.com',

    'DOMAIN-SUFFIX,bamgrid.com',
    'DOMAIN-SUFFIX,disney-plus.net',
    'DOMAIN-SUFFIX,disneyplus.com',
    'DOMAIN-SUFFIX,dssott.com',
    'DOMAIN-SUFFIX,disneystreaming.com',

    'USER-AGENT,Disney+*'
  ]
};

const DISCOVERY_PLUS: StreamService = {
  name: 'Discovery+',
  rules: [
    'USER-AGENT,DPlus*',
    'USER-AGENT,discovery+*',
    'DOMAIN-SUFFIX,disco-api.com',
    'DOMAIN-SUFFIX,discoveryplus.co.uk',
    'DOMAIN-SUFFIX,discoveryplus.com',
    'DOMAIN-SUFFIX,discoveryplus.in',
    'DOMAIN-SUFFIX,dnitv.com'
  ]
};

const DMM: StreamService = {
  name: 'DMM',
  rules: [
    'DOMAIN-SUFFIX,dmm.co.jp',
    'DOMAIN-SUFFIX,dmm.com',
    'DOMAIN-SUFFIX,dmm-extension.com'
  ]
};

const ENCORE_TVB: StreamService = {
  name: 'encoreTVB',
  rules: [
    'DOMAIN,bcbolt446c5271-a.akamaihd.net',

    'DOMAIN,edge.api.brightcove.com',

    'DOMAIN-SUFFIX,encoretvb.com',

    'USER-AGENT,encoreTVB*',

    'USER-AGENT,TVer-Release*'
  ]
};

const ENCORE_TVB_JP_TVER: StreamService = {
  name: 'encoreTVB JP',
  rules: [
    'DOMAIN-SUFFIX,tver.jp'
  ]
};

const FOX_NOW: StreamService = {
  name: 'Fox Now',
  rules: [
    'DOMAIN-SUFFIX,fox.com',
    'DOMAIN-SUFFIX,foxdcg.com',
    'DOMAIN-SUFFIX,uplynk.com',

    'USER-AGENT,FOX NOW*'
  ]
};

const FOX_PLUS: StreamService = {
  name: 'Fox+',
  rules: [
    'DOMAIN,dashasiafox.akamaized.netflix',
    'DOMAIN,staticasiafox.akamaized.net',

    'DOMAIN-SUFFIX,foxplus.com',
    'DOMAIN-SUFFIX,theplatform.com',

    'USER-AGENT,FOXPlus*'
  ]
};

const HBO: StreamService = {
  name: 'HBO Go / HBO Now / HBO Max',
  rules: [
    'DOMAIN-SUFFIX,hbo.com',
    'DOMAIN-SUFFIX,hbogo.com',
    'DOMAIN-SUFFIX,hbonow.com',

    'USER-AGENT,HBO NOW*',
    'USER-AGENT,HBOMAX*',

    'DOMAIN-SUFFIX,hbomax.com',
    'DOMAIN-SUFFIX,hbomaxcdn.com'
  ]
};

const HBO_ASIA: StreamService = {
  name: 'HBO Asia',
  rules: [
    'DOMAIN-SUFFIX,hboasia.com',
    'DOMAIN-SUFFIX,hbogoasia.com',
    'DOMAIN-SUFFIX,hbogoasia.hk',
    'DOMAIN-KEYWORD,.hbogoasia.',

    'DOMAIN,44wilhpljf.execute-api.ap-southeast-1.amazonaws.com',
    'DOMAIN,bcbolthboa-a.akamaihd.net',
    'DOMAIN,cf-images.ap-southeast-1.prod.boltdns.net',
    'DOMAIN,dai3fd1oh325y.cloudfront.net',
    'DOMAIN,hboasia1-i.akamaihd.net',
    'DOMAIN,hboasia2-i.akamaihd.net',
    'DOMAIN,hboasia3-i.akamaihd.net',
    'DOMAIN,hboasia4-i.akamaihd.net',
    'DOMAIN,hboasia5-i.akamaihd.net',
    'DOMAIN,hbogoprod-vod.akamaized.net',
    'DOMAIN,manifest.prod.boltdns.net',
    'DOMAIN,players.brightcove.net',
    'DOMAIN,s3-ap-southeast-1.amazonaws.com',
    'DOMAIN,hboasialive.akamaized.net',
    'DOMAIN,hbounify-prod.evergent.com',
    'DOMAIN,hbolb.onwardsmg.com',

    'USER-AGENT,HBO GO PROD HKG*',

    'USER-AGENT,HBO*'
  ]
};

const HIMALAYA_FM: StreamService = {
  name: 'Himalaya FM',
  rules: [
    'USER-AGENT,Himalaya*',
    'DOMAIN-SUFFIX,himalaya.com'
  ]
};

const HULU: StreamService = {
  name: 'Hulu',
  rules: [
    'DOMAIN-SUFFIX,hulu.com',
    'DOMAIN-SUFFIX,hulu.tv',
    'DOMAIN-SUFFIX,hulu.us',
    'DOMAIN-SUFFIX,huluim.com',
    'DOMAIN-SUFFIX,hulustream.com',

    'USER-AGENT,Hulu*',
    'PROCESS-NAME,com.hulu.plus'
  ]
};

const HULU_JP: StreamService = {
  name: 'Hulu Japan',
  rules: [
    'DOMAIN-SUFFIX,happyon.jp',
    'DOMAIN-SUFFIX,hjholdings.jp',
    'DOMAIN-SUFFIX,hulu.jp'
  ]
};

const HWTV: StreamService = {
  name: 'HWTV',
  rules: [
    'USER-AGENT,HWTVMobile*',
    'DOMAIN-SUFFIX,5itv.tv',
    'DOMAIN-SUFFIX,ocnttv.com'
  ]
};

const ITV: StreamService = {
  name: 'ITV',
  rules: [
    'DOMAIN,itvpnpmobile-a.akamaihd.net',

    'DOMAIN-SUFFIX,itv.com',
    'DOMAIN-SUFFIX,itvstatic.com',

    'USER-AGENT,ITV_Player*'
  ]
};

const IQIYI_GLOBAL: StreamService = {
  name: 'iQiYi Global',
  rules: [
    'DOMAIN-SUFFIX,iq.com',
    'DOMAIN,cache.video.iqiyi.com',
    'DOMAIN,cache-video.iq.com',
    'DOMAIN,akmcdnoversea-tw.inter.ptqy.gitv.tv',
    'DOMAIN,chuangcachecdnoversea-tw.inter.ptqy.gitv.tv',
    'DOMAIN-SUFFIX,inter.iqiyi.com',
    'DOMAIN-SUFFIX,intl-rcd.iqiyi.com',
    'DOMAIN-SUFFIX,intl-subscription.iqiyi.com',
    'DOMAIN-SUFFIX,intl.iqiyi.com'
  ]
};

const JOOX: StreamService = {
  name: 'JOOX',
  rules: [
    'DOMAIN-SUFFIX,joox.com',
    'DOMAIN-KEYWORD,jooxweb-api',

    'USER-AGENT,JOOX*',
    'USER-AGENT,WeMusic*',
    'PROCESS-NAME,com.tencent.ibg.joox'
  ]
};

const KKBOX: StreamService = {
  name: 'KKBOX',
  rules: [
    'DOMAIN-SUFFIX,kfs.io',
    'DOMAIN-SUFFIX,kkbox.com',
    'DOMAIN-SUFFIX,kkbox.com.tw',
    'DOMAIN-SUFFIX,kkbox-prime.com',
    'DOMAIN-SUFFIX,kktix.com'
  ]
};

const KKTV: StreamService = {
  name: 'KKTV',
  rules: [
    'DOMAIN-SUFFIX,kk.stream',

    'DOMAIN-SUFFIX,kktv.com.tw',
    'DOMAIN-SUFFIX,kktv.me',

    'USER-AGENT,com.kktv.ios.kktv*',
    'USER-AGENT,KKTV*'
  ]
};

const LINE_TV: StreamService = {
  name: 'Line TV',
  rules: [
    'DOMAIN,d3c7rimkq79yfu.cloudfront.net',
    'DOMAIN-SUFFIX,linetv.tw',
    'USER-AGENT,LINE TV*',
    'PROCESS-NAME,com.linecorp.linetv'
  ]
};

const LITV: StreamService = {
  name: 'LiTV',
  rules: [
    'DOMAIN,litvfreemobile-hichannel.cdn.hinet.net',
    'DOMAIN-SUFFIX,litv.tv'
  ]
};

const MAX: StreamService = {
  name: 'Max',
  rules: [
    'USER-AGENT,Max*',
    'PROCESS-NAME,com.wbd.stream',
    'DOMAIN-SUFFIX,max.com',
    'DOMAIN-SUFFIX,discomax.com'
  ]
};

const MY5: StreamService = {
  name: 'My5',
  rules: [
    'DOMAIN,d349g9zuie06uo.cloudfront.net',
    'DOMAIN-SUFFIX,channel5.com',
    'DOMAIN-SUFFIX,my5.tv',

    'USER-AGENT,My5*'
  ]
};

const MYTV_SUPER: StreamService = {
  name: 'myTV Super',
  rules: [
    'DOMAIN-SUFFIX,mytvsuper.com',
    'DOMAIN-SUFFIX,tvb.com',
    'DOMAIN-SUFFIX,psg.cdn.hgc.com.hk',

    'USER-AGENT,mytv*',

    'DOMAIN-KEYWORD,nowtv100',
    'DOMAIN-KEYWORD,rthklive'
  ]
};

const NAVER_TV: StreamService = {
  name: 'Naver TV',
  rules: [
    'USER-AGENT,Naver TV*',
    'DOMAIN-SUFFIX,tv.naver.com',
    'DOMAIN-SUFFIX,smartmediarep.com'
  ]
};

const NICONICO: StreamService = {
  name: 'niconico',
  rules: [
    'DOMAIN-SUFFIX,dmc.nico',
    'DOMAIN-SUFFIX,nicovideo.jp',
    'DOMAIN-SUFFIX,asset.domand.nicovideo.jp',
    // 'DOMAIN-SUFFIX,nimg.jp',
    'DOMAIN-SUFFIX,socdm.com',

    'USER-AGENT,Niconico*'
  ]
};

const NETFLIX: StreamService = {
  name: 'Netflix',
  ip: {
    v4: [
      '23.246.18.0/23',
      '37.77.184.0/21',
      '45.57.0.0/17',
      '64.120.128.0/17',
      '66.197.128.0/17',
      '69.53.224.0/19',
      '108.175.32.0/20',
      '185.2.220.0/22',
      '185.9.188.0/22',
      '192.173.64.0/18',
      '198.38.96.0/19',
      '198.45.48.0/20',
      '208.75.76.0/22'
    ],
    v6: [
      '2607:fb10::/32',
      '2620:10c:7000::/44',
      '2a00:86c0::/32',
      '2a03:5640::/32'
    ]
  },
  rules: [
    'DOMAIN-SUFFIX,netflix.ca',
    'DOMAIN-SUFFIX,netflix.com',
    'DOMAIN-SUFFIX,netflix.net',
    'DOMAIN-SUFFIX,nflxext.com',
    'DOMAIN-SUFFIX,nflximg.com',
    'DOMAIN-SUFFIX,nflximg.net',
    'DOMAIN-SUFFIX,nflxso.net',
    'DOMAIN-SUFFIX,nflxvideo.net',
    'DOMAIN-SUFFIX,nflxsearch.net',
    'DOMAIN-SUFFIX,netflix.com.edgesuite.net',
    'DOMAIN-KEYWORD,netflixdnstest',
    'DOMAIN-KEYWORD,dualstack.apiproxy-',
    'DOMAIN-KEYWORD,dualstack.ichnaea-web-',
    'DOMAIN-KEYWORD,apiproxy-device-prod-nlb-',

    'USER-AGENT,Argo*',
    'PROCESS-NAME,com.netflix.mediaclient'
  ]
};

const NOW_E: StreamService = {
  name: 'Now E',
  rules: [
    'DOMAIN-SUFFIX,nowe.com'
  ]
};

const OVERCAST_FM: StreamService = {
  name: 'Overcast FM',
  rules: [
    'USER-AGENT,Overcast*',
    'DOMAIN-SUFFIX,overcast.fm'
  ]
};

const PARAMOUNT: StreamService = {
  name: 'Paramount+',
  rules: [
    'USER-AGENT,PPlus*',
    'DOMAIN-SUFFIX,cbsi.com',
    'DOMAIN-SUFFIX,cbsaavideo.com',
    'DOMAIN-SUFFIX,cbsivideo.com',
    'DOMAIN-SUFFIX,paramountplus.com',
    'DOMAIN,cbsi.live.ott.irdeto.com',
    'DOMAIN,cbsplaylistserver.aws.syncbak.com',
    'DOMAIN,cbsservice.aws.syncbak.com',
    'DOMAIN,link.theplatform.com'
  ]
};

const PBS: StreamService = {
  name: 'PBS',
  rules: [
    'USER-AGENT,PBS*',
    'DOMAIN-SUFFIX,pbs.org'
  ]
};

const PEACOCK: StreamService = {
  name: 'Peacock',
  rules: [
    'USER-AGENT,PeacockMobile*',
    'DOMAIN-SUFFIX,peacocktv.com'
  ]
};

const PANDORA: StreamService = {
  name: 'Pandora',
  rules: [
    'DOMAIN-SUFFIX,pandora.com',
    'USER-AGENT,Pandora*'
  ]
};

const PORNHUB: StreamService = {
  name: 'Pornhub',
  rules: [
    'DOMAIN-SUFFIX,phprcdn.com',
    'DOMAIN-SUFFIX,pornhub.com',
    'DOMAIN-SUFFIX,pornhubpremium.com'
  ]
};

const SOUNDCLOUD: StreamService = {
  name: 'SoundCloud',
  rules: [
    'DOMAIN-SUFFIX,sndcdn.com',
    'DOMAIN-SUFFIX,soundcloud.com',

    'USER-AGENT,SoundCloud*'
  ]
};

const SPOTIFY: StreamService = {
  name: 'Spotify',
  ip: {
    v4: ['35.186.224.47/32'],
    v6: []
  },
  rules: [
    'DOMAIN-KEYWORD,-spotify-com',

    'DOMAIN-SUFFIX,pscdn.co',
    'DOMAIN-SUFFIX,scdn.co',
    'DOMAIN-SUFFIX,spoti.fi',
    'DOMAIN-SUFFIX,spotify.com',
    'DOMAIN-SUFFIX,byspotify.com',
    'DOMAIN-SUFFIX,spotify-everywhere.com',
    'DOMAIN-SUFFIX,spotify.design',
    'DOMAIN-SUFFIX,spotifycdn.com',
    'DOMAIN-SUFFIX,spotifycdn.net',
    'DOMAIN-SUFFIX,spotifycharts.com',
    'DOMAIN-SUFFIX,spotifycodes.com',
    'DOMAIN-SUFFIX,spotifyforbrands.com',
    'DOMAIN-SUFFIX,spotifyjobs.com',
    'DOMAIN-SUFFIX,spotify-com.akamaized.net',
    'DOMAIN-SUFFIX,spotifynewsroom.jp',
    'DOMAIN-SUFFIX,spotilocal.com',
    'DOMAIN-SUFFIX,tospotify.com',

    'USER-AGENT,*Spotify*'
  ]
};

const TVB_ANYWHERE: StreamService = {
  name: 'TVB Anywhere',
  rules: [
    'DOMAIN-KEYWORD,tvbanywhere'
  ]
};

const TAIWAN_GOOD: StreamService = {
  name: 'TaiwanGood',
  rules: [
    'DOMAIN,hamifans.emome.net',
    'DOMAIN-SUFFIX,skyking.com.tw',
    'USER-AGENT,TaiwanGood*',
    'PROCESS-NAME,com.twgood.android'
  ]
};

const TIDAL: StreamService = {
  name: 'TIDAL',
  rules: [
    'USER-AGENT,TIDAL*',
    'DOMAIN-SUFFIX,tidal.com',
    'DOMAIN-SUFFIX,tidalhifi.com'
  ]
};

const TIKTOK: StreamService = {
  name: 'TikTok',
  rules: [
    'DOMAIN-SUFFIX,byteoversea.com',
    'DOMAIN-SUFFIX,ibytedtos.com',
    // 'DOMAIN-SUFFIX,ibyteimg.com', // We confirm that tiktokcdn DOES NOT have ANY geoblock
    'DOMAIN-SUFFIX,ipstatp.com',
    'DOMAIN-SUFFIX,isnssdk.com',
    'DOMAIN-SUFFIX,muscdn.com',
    'DOMAIN-SUFFIX,musical.ly',
    'DOMAIN-SUFFIX,tiktok.com',
    'DOMAIN-SUFFIX,tiktok.us',
    'DOMAIN-SUFFIX,tiktokv.us',
    'DOMAIN-SUFFIX,tik-tokapi.com',
    // 'DOMAIN-SUFFIX,tiktokcdn.com', // We confirm that tiktokcdn DOES NOT have ANY geoblock
    'DOMAIN-SUFFIX,tiktokv.com',
    'DOMAIN-SUFFIX,tiktokw.com',
    'DOMAIN-KEYWORD,-tiktokcdn-com',

    'USER-AGENT,TikTok*'
  ]
};

const TWITCH: StreamService = {
  name: 'Twitch',
  rules: [
    'DOMAIN-SUFFIX,jtvnw.net',
    'DOMAIN-SUFFIX,ttvnw.net',
    'DOMAIN-SUFFIX,twitch.tv',
    'DOMAIN-SUFFIX,twitchcdn.net',
    'DOMAIN-SUFFIX,twitchsvc.net',
    'DOMAIN-SUFFIX,ext-twitch.tv',
    'PROCESS-NAME,tv.twitch.android.app'
  ]
};

const VIUTV: StreamService = {
  name: 'ViuTV',
  rules: [
    'DOMAIN,api.viu.now.com',
    'DOMAIN,d1k2us671qcoau.cloudfront.net',
    'DOMAIN,d2anahhhmp1ffz.cloudfront.net',
    'DOMAIN,dfp6rglgjqszk.cloudfront.net',

    'DOMAIN-SUFFIX,viu.com',
    'DOMAIN-SUFFIX,viu.now.com',
    'DOMAIN-SUFFIX,viu.tv',
    'PROCESS-NAME,com.viu.pad',
    'PROCESS-NAME,com.viu.phone',
    'PROCESS-NAME,com.vuclip.viu',
    'PROCESS-NAME,com.hktve.viutv',
    'USER-AGENT,Viu*'
  ]
};

const YOUTUBE: StreamService = {
  name: 'YouTube',
  rules: [
    'DOMAIN,youtubei.googleapis.com',
    'DOMAIN,youtube.googleapis.com',
    'DOMAIN-SUFFIX,googlevideo.com',
    'DOMAIN-SUFFIX,youtube.com',
    'DOMAIN-SUFFIX,withyoutube.com',

    'DOMAIN-SUFFIX,youtubeeducation.com',
    'DOMAIN-SUFFIX,youtubegaming.com',
    'DOMAIN-SUFFIX,youtubekids.com',
    'DOMAIN-SUFFIX,youtube-nocookie.com',

    'USER-AGENT,com.google.ios.youtube*',
    'USER-AGENT,YouTube*'
  ]
};

const YOUTUBE_MUSIC: StreamService = {
  name: 'YouTube Music',
  rules: [
    'USER-AGENT,com.google.ios.youtubemusic*',
    'USER-AGENT,YouTubeMusic*'
  ]
};

const SHOWTIME: StreamService = {
  name: 'SHOWTIME',
  rules: [
    'DOMAIN-SUFFIX,sho.com',
    'DOMAIN-SUFFIX,showtime.com'
  ]
};

const WETV: StreamService = {
  name: 'WeTV',
  ip: {
    v4: ['150.109.28.51/32'],
    v6: []
  },
  rules: [
    'USER-AGENT,WeTV*',
    'DOMAIN-SUFFIX,wetv.vip',
    'DOMAIN-SUFFIX,wetvinfo.com'
  ]
};

export const ALL: StreamService[] = [
  $4GTV,
  ABEMA_TV, AMAZON_PRIME_VIDEO, ALL4, APPLE_TV, APPLE_MUSIC_TV,
  BAHAMUT, BBC, BILIBILI_INTL,
  DAZN, DEEZER, DISNEY_PLUS, DISCOVERY_PLUS, DMM,
  ENCORE_TVB,
  ENCORE_TVB_JP_TVER,
  FOX_NOW, FOX_PLUS,
  HBO, HBO_ASIA, HIMALAYA_FM, HULU, HWTV,
  IQIYI_GLOBAL, ITV,
  JOOX,
  KKBOX,
  KKTV,
  LINE_TV, LITV,
  MAX, MY5, MYTV_SUPER,
  NETFLIX, NAVER_TV, NICONICO, NOW_E,
  OVERCAST_FM,
  PARAMOUNT, PBS, PEACOCK, PANDORA, PORNHUB,
  SOUNDCLOUD, SPOTIFY,
  TAIWAN_GOOD, TIDAL, TIKTOK, TVB_ANYWHERE, TWITCH,
  VIUTV,
  WETV,
  YOUTUBE, YOUTUBE_MUSIC,
  SHOWTIME
];

export const NORTH_AMERICA: StreamService[] = [
  FOX_NOW,
  FOX_PLUS,
  HULU, // Hulu US
  HULU_JP,
  // HBO,
  // www.nfl.com
  // epix.com
  // starz.com
  // www.philo.com
  // https://www.shudder.com/
  // https://www.britbox.com
  // crackle.com
  // www.cwtv.com
  // www.aetv.com
  // https://www.nba.com/watch/
  // fubo.tv
  // mola.tv
  // https://setantasports.com/
  // tubitv.com
  // SlingTV
  // PlutoTV
  // AcornTV
  SHOWTIME,
  ENCORE_TVB,
  // Funimation
  DISCOVERY_PLUS,
  PARAMOUNT,
  PEACOCK
  // Popcornflix
  // Crunchyroll
  // ATTNOW
  // KBSAmerican
  // KOCOWA
  // MathsSpot
  // CBCGem
  // Crave
];

export const EU: StreamService[] = [
  // RakutenTV
  // Funimation
  // SkyShowTime
  // HBO,
  // MathSpot
  // SkyGo
  // BritBox
  ITV, // ITVHUB
  // BBC Channel 4
  // BBC Channel 5
  BBC
  // Discovery+ UK discoveryplus.co.uk
  // Salto
  // CanalPlus
  // Molotov
  // Joyn
  // SKY_DE
  // ZDF
  // NLZIET
  // videoland
  // NPO_START_PLUS
  // HBO_Spain
  // Pantaya
  // RaiPlay
  // MegogoTV
  // Amediateka
];

export const HK: StreamService[] = [
  NOW_E,
  VIUTV,
  MYTV_SUPER,
  HBO_ASIA,
  BILIBILI_INTL
];

export const TW: StreamService[] = [
  KKTV,
  LITV,
  // MyVideo
  $4GTV,
  LINE_TV,
  // HamiVideo
  // CatchPlay
  HBO_ASIA,
  BAHAMUT,
  // elevensportstw
  BILIBILI_INTL
];

export const JP: StreamService[] = [
  DMM,
  // DMMTV
  ABEMA_TV,
  NICONICO,
  // music.jp
  // Telasa
  // Paravi
  // unext
  HULU_JP,
  ENCORE_TVB_JP_TVER
  // GYAO!
  // wowow
  // VideoMarket
  // FOD (Fuji TV)
  // Radiko
  // Karaoke@DAM
  // J:COM
  // Kancolle Japan
  // Pretty Derby Japan
  // Konosuba Fantastic Days
];

export const AU = [
  // Stan
  // Binge
  // 7plus
  // Channel9
  // Channel10
  // ABCiView
  // OptusSports
  // SBSonDemand
  // NeonTV
  // SKyGONZ
  // ThreeNow
  // MaoriTV
];

export const KR = [
  // WAVEE
  // Tving
  // CoupangPlay
  NAVER_TV
  // Afreeca
  // KBSDomestic
  // KOCOWA
];

export const SOUTH_EAST_ASIA = [
  // HBO
  // B-Global SouthEastAsia
  // MeWatch SG
  // AISPlay Thailand
  // B-Global Thailand
  // B-Global Indonesia
  // K_Plus VN
  // TV360 VN
  // B-Global VN
];
