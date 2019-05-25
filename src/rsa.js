/*
* @Author: tino
* @Date:   2019-05-24 19:50:51
* @Last Modified by:   tino
* @Last Modified time: 2019-05-25 16:10:14
*/
let fs = require('fs');
let EC = require('elliptic').ec;
let ec = EC('secp256k1');
let keyPair = ec.genKeyPair();
let keys = generateKeys();

function generateKeys() {
  let fileName = './wallet.json';
  try {
    let res = JSON.parse(fs.readFileSync(fileName));
    if(res.prv && res.pub && getPub(res.prv) === res.pub) {
      keyPair = ec.keyFromPrivate(res.prv);
      return res;
    } else {
      throw 'Invalid wallet.json';
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

function getPub(prv) {
  return ec.keyFromPrivate(prv).getPublic('hex').toString();
}

function sign({from, to, amount, timestamp}) {
  let bufferMsg = Buffer.from(`${timestamp} - ${amount} - ${from} - ${to}`);
  return Buffer.from(keyPair.sign(bufferMsg).toDER()).toString('hex');
}

function verify({from, to, amount, timestamp, signature}, pub) {
  let keyPairTemp = ec.keyFromPublic(pub, 'hex');
  let bufferMsg = Buffer.from(`${timestamp} - ${amount} - ${from} - ${to}`);
  return keyPairTemp.verify(bufferMsg, signature);
}

module.exports = {sign, verify, keys};

// let trans = {from: 'dd', to: 'ds', amount: 100};
// let trans1 = {from: 'dd1', to: 'ds', amount: 100};
// let signature = sign(trans);
// trans.signature = signature;
// trans1.signature = signature;
// console.log(signature);
// console.log(verify(trans1, keyPair.getPublic('hex').toString()));

