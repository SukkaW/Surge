// @ts-check

/**
 * @typedef {Object} StreamService
 * @property {string} name
 * @property {Object} [ip]
 * @property {string[]} ip.v4
 * @property {string[]} ip.v6
 * @property {string[]} rules
 */

/** @type {StreamService} */
const $4GTV = {
  name: '4gtv',
  rules: [
    'DOMAIN-SUFFIX,4gtv.tv',
    'DOMAIN,4gtvfreepcvod-cds.cdn.hinet.net'
  ]
};

/** @type {StreamService} */
const ALL4 = {
  name: 'All4',
  rules: [
    'DOMAIN-SUFFIX,c4assets.com',
    'DOMAIN-SUFFIX,channel4.com',

    'USER-AGENT,All4*'
  ]
};

/** @type {StreamService} */
const AMAZON_PRIME_VIDEO = {
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
    'USER-AGENT,Prime%20Video*',
    'PROCESS-NAME,com.amazon.avod.thirdpartyclient'

  ]
};

/** @type {StreamService} */
const ABEMA_TV = {
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

/** @type {StreamService} */
const APPLE_TV = {
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

/** @type {StreamService} */
const APPLE_MUSIC_TV = {
  name: 'Apple Music TV',
  rules: [
    'DOMAIN-SUFFIX,applemusic.com',
    'PROCESS-NAME,music'
  ]
};

/** @type {StreamService} */
const BAHAMUT = {
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

/** @type {StreamService} */
const BBC = {
  name: 'BBC',
  rules: [
    'DOMAIN-KEYWORD,bbcfmt',
    'DOMAIN-KEYWORD,uk-live',

    'DOMAIN-SUFFIX,bbc.co.uk',
    'DOMAIN-SUFFIX,bbci.co.uk',

    'USER-AGENT,BBCiPlayer*'
  ]
};

/** @type {StreamService} */
const BILIBILI_INTL = {
  name: 'Bilibili International',
  rules: [
    'DOMAIN-SUFFIX,biliintl.com',
    'DOMAIN,apm-misaka.biliapi.net',
    'DOMAIN,p.bstarstatic.com',
    'DOMAIN,p-bstarstatic.akamaized.net',
    'DOMAIN,upos-bstar-mirrorakam.akamaized.net',
    'DOMAIN,upos-bstar1-mirrorakam.akamaized.net',
    'DOMAIN-SUFFIX,bilibili.tv',
    'PROCESS-NAME,com.bstar.intl'
  ]
};

/** @type {StreamService} */
const DAZN = {
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

/** @type {StreamService} */
const DEEZER = {
  name: 'Deezer',
  rules: [
    'DOMAIN-SUFFIX,deezer.com',
    'DOMAIN-SUFFIX,dzcdn.net',
    'USER-AGENT,Deezer*'
  ]
};

/** @type {StreamService} */
const DISNEY_PLUS = {
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

/** @type {StreamService} */
const DISCOVERY_PLUS = {
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

/** @type {StreamService} */
const DMM = {
  name: 'DMM',
  rules: [
    'DOMAIN-SUFFIX,dmm.co.jp',
    'DOMAIN-SUFFIX,dmm.com',
    'DOMAIN-SUFFIX,dmm-extension.com'
  ]
};

/** @type {StreamService} */
const ENCORE_TVB = {
  name: 'encoreTVB',
  rules: [
    'DOMAIN,bcbolt446c5271-a.akamaihd.net',

    'DOMAIN,edge.api.brightcove.com',

    'DOMAIN-SUFFIX,encoretvb.com',

    'USER-AGENT,encoreTVB*',

    'USER-AGENT,TVer-Release*',
    'DOMAIN-SUFFIX,tver.jp'
  ]
};

/** @type {StreamService} */
const FOX_NOW = {
  name: 'Fox Now',
  rules: [
    'DOMAIN-SUFFIX,fox.com',
    'DOMAIN-SUFFIX,foxdcg.com',
    'DOMAIN-SUFFIX,uplynk.com',

    'USER-AGENT,FOX%20NOW*'
  ]
};

/** @type {StreamService} */
const FOX_PLUS = {
  name: 'Fox+',
  rules: [
    'DOMAIN,dashasiafox.akamaized.netflix',
    'DOMAIN,staticasiafox.akamaized.net',

    'DOMAIN-SUFFIX,foxplus.com',
    'DOMAIN-SUFFIX,theplatform.com',

    'USER-AGENT,FOXPlus*'
  ]
};

/** @type {StreamService} */
const HBO = {
  name: 'HBO Go / HBO Now / HBO Max',
  rules: [
    'DOMAIN-SUFFIX,hbo.com',
    'DOMAIN-SUFFIX,hbogo.com',
    'DOMAIN-SUFFIX,hbonow.com',

    'USER-AGENT,HBO%20NOW*',
    'USER-AGENT,HBOMAX*',

    'DOMAIN-SUFFIX,hbomax.com',
    'DOMAIN-SUFFIX,hbomaxcdn.com'
  ]
};

/** @type {StreamService} */
const HBO_ASIA = {
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

    'USER-AGENT,HBO%20GO%20PROD%20HKG*',

    'USER-AGENT,HBO*'
  ]
};

/** @type {StreamService} */
const HIMALAYA_FM = {
  name: 'Himalaya FM',
  rules: [
    'USER-AGENT,Himalaya*',
    'DOMAIN-SUFFIX,himalaya.com'
  ]
};

/** @type {StreamService} */
const HULU = {
  name: 'Hulu',
  rules: [
    'DOMAIN-SUFFIX,happyon.jp',
    'DOMAIN-SUFFIX,hulu.com',
    'DOMAIN-SUFFIX,hulu.jp',
    'DOMAIN-SUFFIX,hulu.tv',
    'DOMAIN-SUFFIX,hulu.us',
    'DOMAIN-SUFFIX,huluim.com',
    'DOMAIN-SUFFIX,hulustream.com',
    'DOMAIN-SUFFIX,hjholdings.jp',

    'USER-AGENT,Hulu*',
    'PROCESS-NAME,com.hulu.plus'
  ]
};

/** @type {StreamService} */
const HWTV = {
  name: 'HWTV',
  rules: [
    'USER-AGENT,HWTVMobile*',
    'DOMAIN-SUFFIX,5itv.tv',
    'DOMAIN-SUFFIX,ocnttv.com'
  ]
};

/** @type {StreamService} */
const ITV = {
  name: 'ITV',
  rules: [
    'DOMAIN,itvpnpmobile-a.akamaihd.net',

    'DOMAIN-SUFFIX,itv.com',
    'DOMAIN-SUFFIX,itvstatic.com',

    'USER-AGENT,ITV_Player*'
  ]
};

/** @type {StreamService} */
const IQIYI_GLOBAL = {
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

/** @type {StreamService} */
const JOOX = {
  name: 'JOOX',
  rules: [
    'DOMAIN-SUFFIX,joox.com',
    'DOMAIN-KEYWORD,jooxweb-api',

    'USER-AGENT,JOOX*',
    'USER-AGENT,WeMusic*',
    'PROCESS-NAME,com.tencent.ibg.joox'
  ]
};

/** @type {StreamService} */
const KKBOX = {
  name: 'KKBOX',
  rules: [
    'DOMAIN-SUFFIX,kfs.io',
    'DOMAIN-SUFFIX,kkbox.com',
    'DOMAIN-SUFFIX,kkbox.com.tw',
    'DOMAIN-SUFFIX,kkbox-prime.com',
    'DOMAIN-SUFFIX,kktix.com'
  ]
};

/** @type {StreamService} */
const KKTV = {
  name: 'KKTV',
  rules: [
    'DOMAIN-SUFFIX,kk.stream',

    'DOMAIN-SUFFIX,kktv.com.tw',
    'DOMAIN-SUFFIX,kktv.me',

    'USER-AGENT,com.kktv.ios.kktv*',
    'USER-AGENT,KKTV*'
  ]
};

/** @type {StreamService} */
const LINE_TV = {
  name: 'Line TV',
  rules: [
    'DOMAIN,d3c7rimkq79yfu.cloudfront.net',
    'DOMAIN-SUFFIX,linetv.tw',
    'USER-AGENT,LINE%20TV*',
    'PROCESS-NAME,com.linecorp.linetv'
  ]
};

/** @type {StreamService} */
const LITV = {
  name: 'LiTV',
  rules: [
    'DOMAIN,litvfreemobile-hichannel.cdn.hinet.net',
    'DOMAIN-SUFFIX,litv.tv'
  ]
};

/** @type {StreamService} */
const MAX = {
  name: 'Max',
  rules: [
    'USER-AGENT,Max*',
    'PROCESS-NAME,com.wbd.stream',
    'DOMAIN-SUFFIX,max.com',
    'DOMAIN-SUFFIX,discomax.com'
  ]
};

/** @type {StreamService} */
const MY5 = {
  name: 'My5',
  rules: [
    'DOMAIN,d349g9zuie06uo.cloudfront.net',
    'DOMAIN-SUFFIX,channel5.com',
    'DOMAIN-SUFFIX,my5.tv',

    'USER-AGENT,My5*'
  ]
};

/** @type {StreamService} */
const MYTV_SUPER = {
  name: 'myTV Super',
  rules: [
    'DOMAIN-SUFFIX,mytvsuper.com',
    'DOMAIN-SUFFIX,tvb.com',

    'USER-AGENT,mytv*',

    'DOMAIN-KEYWORD,nowtv100',
    'DOMAIN-KEYWORD,rthklive'
  ]
};

/** @type {StreamService} */
const NAVER_TV = {
  name: 'Naver TV',
  rules: [
    'USER-AGENT,Naver%20TV*',
    'DOMAIN-SUFFIX,tv.naver.com',
    'DOMAIN-SUFFIX,smartmediarep.com'
  ]
};

/** @type {StreamService} */
const NICONICO = {
  name: 'niconico',
  rules: [
    'DOMAIN-SUFFIX,dmc.nico',
    'DOMAIN-SUFFIX,nicovideo.jp',
    'DOMAIN-SUFFIX,nimg.jp',
    'DOMAIN-SUFFIX,socdm.com',

    'USER-AGENT,Niconico*'
  ]
};

/** @type {StreamService} */
const NETFLIX = {
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

/** @type {StreamService} */
const NOW_E = {
  name: 'Now E',
  rules: [
    'DOMAIN-SUFFIX,nowe.com'
  ]
};

/** @type {StreamService} */
const OVERCAST_FM = {
  name: 'Overcast FM',
  rules: [
    'USER-AGENT,Overcast*',
    'DOMAIN-SUFFIX,overcast.fm'
  ]
};

/** @type {StreamService} */
const PARAMOUNT = {
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

/** @type {StreamService} */
const PBS = {
  name: 'PBS',
  rules: [
    'USER-AGENT,PBS*',
    'DOMAIN-SUFFIX,pbs.org'
  ]
};

/** @type {StreamService} */
const PEACOCK = {
  name: 'Peacock',
  rules: [
    'USER-AGENT,PeacockMobile*',
    'DOMAIN-SUFFIX,peacocktv.com'
  ]
};

/** @type {StreamService} */
const PANDORA = {
  name: 'Pandora',
  rules: [
    'DOMAIN-SUFFIX,pandora.com',
    'USER-AGENT,Pandora*'
  ]
};

/** @type {StreamService} */
const PORNHUB = {
  name: 'Pornhub',
  rules: [
    'DOMAIN-SUFFIX,phprcdn.com',
    'DOMAIN-SUFFIX,pornhub.com',
    'DOMAIN-SUFFIX,pornhubpremium.com'
  ]
};

/** @type {StreamService} */
const SOUNDCLOUD = {
  name: 'SoundCloud',
  rules: [
    'DOMAIN-SUFFIX,sndcdn.com',
    'DOMAIN-SUFFIX,soundcloud.com',

    'USER-AGENT,SoundCloud*'
  ]
};

/** @type {StreamService} */
const SPOTIFY = {
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

/** @type {StreamService} */
const TVB_ANYWHERE = {
  name: 'TVB Anywhere',
  rules: [
    'DOMAIN-KEYWORD,tvbanywhere'
  ]
};

/** @type {StreamService} */
const TAIWAN_GOOD = {
  name: 'TaiwanGood',
  rules: [
    'DOMAIN,hamifans.emome.net',
    'DOMAIN-SUFFIX,skyking.com.tw',
    'USER-AGENT,TaiwanGood*'
  ]
};

/** @type {StreamService} */
const TIDAL = {
  name: 'TIDAL',
  rules: [
    'USER-AGENT,TIDAL*',
    'DOMAIN-SUFFIX,tidal.com',
    'DOMAIN-SUFFIX,tidalhifi.com'
  ]
};

/** @type {StreamService} */
const TIKTOK = {
  name: 'TikTok',
  rules: [
    'DOMAIN-SUFFIX,byteoversea.com',
    'DOMAIN-SUFFIX,ibytedtos.com',
    'DOMAIN-SUFFIX,ibyteimg.com',
    'DOMAIN-SUFFIX,ipstatp.com',
    'DOMAIN-SUFFIX,isnssdk.com',
    'DOMAIN-SUFFIX,muscdn.com',
    'DOMAIN-SUFFIX,musical.ly',
    'DOMAIN-SUFFIX,tiktok.com',
    'DOMAIN-SUFFIX,tik-tokapi.com',
    'DOMAIN-SUFFIX,tiktokcdn.com',
    'DOMAIN-SUFFIX,tiktokv.com',
    'DOMAIN-KEYWORD,-tiktokcdn-com',

    'USER-AGENT,TikTok*'
  ]
};

/** @type {StreamService} */
const TWITCH = {
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

/** @type {StreamService} */
const VIUTV = {
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
    'USER-AGENT,Viu*'
  ]
};

/** @type {StreamService} */
const YOUTUBE = {
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

/** @type {StreamService} */
const YOUTUBE_MUSIC = {
  name: 'YouTube Music',
  rules: [
    'USER-AGENT,com.google.ios.youtubemusic*',
    'USER-AGENT,YouTubeMusic*'
  ]
};

/** @type {StreamService} */
const SHOWTIME = {
  name: 'SHOWTIME',
  rules: [
    'DOMAIN-SUFFIX,sho.com',
    'DOMAIN-SUFFIX,showtime.com'
  ]
};

/** @type {StreamService} */
const WETV = {
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

/** @type {StreamService[]} */
module.exports.ALL = [
  $4GTV,
  ABEMA_TV, AMAZON_PRIME_VIDEO, ALL4, APPLE_TV, APPLE_MUSIC_TV,
  BAHAMUT, BBC, BILIBILI_INTL,
  DAZN, DEEZER, DISNEY_PLUS, DISCOVERY_PLUS, DMM,
  ENCORE_TVB,
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

/** @type {StreamService[]} */
module.exports.NORTH_AMERICA = [
  FOX_NOW,
  FOX_PLUS,
  HULU, // Hulu US
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

/** @type {StreamService[]} */
module.exports.EU = [
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

/** @type {StreamService[]} */
module.exports.HK = [
  NOW_E,
  VIUTV,
  MYTV_SUPER,
  HBO_ASIA,
  BILIBILI_INTL
];

/** @type {StreamService[]} */
module.exports.TW = [
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

/** @type {StreamService[]} */
module.exports.JP = [
  DMM,
  // DMMTV
  ABEMA_TV,
  NICONICO
  // music.jp
  // Telasa
  // Paravi
  // unext
  // HuluJP
  // TVer
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

/** @type {StreamService[]} */
module.exports.AU = [
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

/** @type {StreamService[]} */
module.exports.KR = [
  // WAVEE
  // Tving
  // CoupangPlay
  NAVER_TV
  // Afreeca
  // KBSDomestic
  // KOCOWA
];

/** @type {StreamService[]} */
module.exports.SOUTH_EAST_ASIA = [
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
