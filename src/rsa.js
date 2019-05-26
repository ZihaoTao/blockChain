/*
* @Author: tino
* @Date:   2019-05-24 19:50:51
* @Last Modified by:   Zihao Tao
* @Last Modified time: 2019-05-25 17:37:48
*/
let fs = require('fs');
let EC = require('elliptic').ec;
let ec = EC('secp256k1');
let keyPair = ec.genKeyPair();
let keys = generateKeys();

// generate keys based on wallet.json, it there is no wallet.json, create a new one
function generateKeys() {
  let fileName = './wallet.json';
  try {
    let res = JSON.parse(fs.readFileSync(fileName));
    // check if public key can be retrieved from private key
    if(res.prv && res.pub && getPub(res.prv) === res.pub) {
      keyPair = ec.keyFromPrivate(res.prv);
      return res;
    } else {
      throw new Error('Invalid wallet.json');
    }
  } catch(error) {
    let res = {
      prv : keyPair.getPrivate('hex').toString(),
      pub: keyPair.getPublic('hex').toString()
    }
    fs.writeFileSync(fileName, JSON.stringify(res));
    return res;
  }
}

// get public key
function getPub(prv) {
  return ec.keyFromPrivate(prv).getPublic('hex').toString();
}

// make signature
function sign({from, to, amount, timestamp}) {
  let bufferMsg = Buffer.from(`${timestamp} - ${amount} - ${from} - ${to}`);
  return Buffer.from(keyPair.sign(bufferMsg).toDER()).toString('hex');
}

//verify sendings based on public key
function verify({from, to, amount, timestamp, signature}, pub) {
  let keyPairTemp = ec.keyFromPublic(pub, 'hex');
  let bufferMsg = Buffer.from(`${timestamp} - ${amount} - ${from} - ${to}`);
  return keyPairTemp.verify(bufferMsg, signature);
}

module.exports = {sign, verify, keys};