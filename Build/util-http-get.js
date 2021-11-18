const https = require('https');

exports.simpleGet = {
  https(hostname, path) {
    const requestOpt = hostname instanceof URL ? hostname : {
      hostname,
      path,
      method: 'GET',
    };

    return new Promise((resolve, reject) => {
      const req = https.request(
        requestOpt,
        (res) => {
          const body = [];
          res.on('data', (chunk) => {
            body.push(chunk);
          });
          res.on('end', () => {
            try {
              resolve(String(Buffer.concat(body)));
            } catch (e) {
              reject(e);
            }
          });
          req.on('error', (err) => {
            reject(err);
          });
        }
      );
  
      req.end();
    });
  }
}
