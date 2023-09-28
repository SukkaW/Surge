/* global $request, $done */

const url = $request.url;
const newHeaders = {
  Crack: 'Sukka',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Method': '*',
  'Access-Control-Allow-Credentials': 'true'
};
let obj = {};

if (url.includes('/admin/service/registration/validateDevice')) {
  obj = {
    cacheExpirationDays: 365,
    message: 'Device Valid',
    resultCode: 'GOOD'
  };
} else if (url.includes('/admin/service/appstore/register')) {
  obj = {
    featId: '',
    registered: true,
    expDate: '2099-01-01',
    key: ''
  };
} else if (url.includes('/admin/service/registration/validate')) {
  obj = {
    featId: '',
    registered: true,
    expDate: '2099-01-01',
    key: ''
  };
} else if (url.includes('/admin/service/registration/getStatus')) {
  obj = {
    planType: 'Sukka',
    deviceStatus: '',
    subscriptions: []
  };
} else if (url.includes('/admin/service/supporter/retrievekey')) {
  obj = {
    Success: false,
    ErrorMessage: 'Supporter not found'
  };
}

const newBody = JSON.stringify(obj);

const myResponse = {
  status: 200,
  headers: newHeaders,
  body: newBody
};

$done(myResponse);
