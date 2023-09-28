/* global $request, $response, $done */

const url = $request.url;
const body = url.endsWith('region') || url.endsWith('region/')
  ? 'OK'
  : $response.body;

if ($request.method === 'OPTION') {
  $done({});
} else {
  $done({
    status: 200,
    body,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': '*',
      'Access-Control-Allow-Headers': 'origin,range,hdntl,hdnts',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'Server,range,hdntl,hdnts,Akamai-Mon-Iucid-Ing,Akamai-Mon-Iucid-Del,Akamai-Request-BC',
      'Access-Control-Max-Age': '86400'
    }
  });
}
