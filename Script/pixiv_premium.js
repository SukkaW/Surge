let body = $response.body;
body = JSON.parse(body);
if (body?.response?.user?.is_premium) {
  body.response.user.is_premium = true;
}
body = JSON.stringify(body);

$done({ body })
