/*
* @Author: tino
* @Date:   2019-05-24 16:22:49
* @Last Modified by:   tino
* @Last Modified time: 2019-05-25 16:50:19
*/

// [
//   {
//     index: 0, index
//     timestamp:
//     data:
//     hash:
//     prevHash:
//     nounce: random number
//   }
// ]


const crypto = require('crypto');
const dgram = require('dgram');
const rsa = require('./rsa');

const initBlock = { index: 0,
                    data: 'Hello chain!',
                    prevHash: 0,
                    timestamp: 1558741789200,
                    nounce: 548053,
                    hash:'0000034485b18b5374c6116a76790a1f0f8312437f2b905aaa6407dddd2b3d84' 
                  };

class BlockChain {
  constructor() {
    this.blockChain = [initBlock];
    this.data = [];
    this.difficulty = 4;
    this.peers = [];
    this.remote = '';
    this.seed = {address: 'localhost', port: 8002};
    this.udp = dgram.createSocket('udp4');
    this.init();
  }

  init() {
    this.bindP2p();
    this.bindExit();
  }

  bindP2p() {
    this.udp.on('message', (data, remote) => {
      let {address, port} = remote;
      let action = JSON.parse(data);
      if(action.type) {
        this.dispatch(action, {address, port});
      }
    });
    this.udp.on('listening', () => {
      let address = this.udp.address();
      console.log('[Message] Listening port: ' + address.port);
    });
    console.log('[Message] ' + process.argv);
    let port = Number(process.argv[2]) || 0;
    this.startNode(port);
  }

  startNode(port) {
    this.udp.bind(port);
    // not a seed node
    if(port !== 8002) {
      this.send({
        type: 'newPeer'
      }, this.seed.port, this.seed.address);
      this.peers.push(this.seed);
    }
  }

  send(message, port, address) {
    this.udp.send(JSON.stringify(message), port, address);
  }

  dispatch(action, remote) {
    switch(action.type) {
      case 'newPeer': 
        // save the ip and port
        this.send({
          type: 'remoteAddress',
          data: remote
        }, remote.port, remote.address);
        // save all peer list
        this.send({
          type: 'peerList',
          data: this.peers
        }, remote.port, remote.address);
        // broadcast, tell all peer your ip and port
        this.broadcast({
          type: 'sayHi',
          data: remote
        })
        // scyn block chain
        this.send({
          type: 'blockChain',
          data: JSON.stringify({
            blockChain: this.blockChain,
            trans: this.data
          })
        }, remote.port, remote.address);

        this.peers.push(remote);
        console.log('[Message] Welcome, ', remote);
        break;
      
      case 'blockChain':
        let allData = JSON.parse(action.data);
        let newChain = allData.blockChain;
        let newTrans = allData.trans;
        this.replaceChain(newChain);
        this.replaceTrans(newTrans);
        break;

      case 'remoteAddress':
        this.remote = action.data;
        break;

      case 'peerList': 
        let newPeers = action.data;
        this.addPeers(newPeers);
        break;

      case 'sayHi': 
        let remotePeer = action.data;
        this.peers.push(remotePeer);
        console.log('[Message] Add new peer: ' + JSON.stringify(remotePeer));
        this.send({
          type: 'hi',
          data: 'Hi'
        }, remotePeer.port, remotePeer.address);
        break;

      case 'hi':
        console.log(`[Message] ${remote.address}:${remote.port} : ${action.data}`); 
        break;

      case 'mine':
        // if the new msg is same as the old one, return
        if(this.getLastBlock().hash === action.data.hash) {
          return;
        }
        if(this.isValidBlock(action.data, this.getLastBlock())) {
          console.log(`[Message] Someone made a successful mine.`);
          this.blockChain.push(action.data);
          this.data = [];
          this.broadcast({
            type: 'mine',
            data: action.data
          });
        } else {
          console.log('[Error] Invalid Mine');
        }
        break;

      case 'trans':
        if(!this.data.find(v => this.isEqualObject(v, action.data))) {
          console.log('New transfer');
          this.addTrans(action.data);
          this.broadcast({
            type: 'trans',
            data: action.data
          });
        }
        break;

      default:
        console.log('[Error] Wrong action.', remote);
    }
  }

  addTrans(trans) {
    if(this.isValidTrans(trans)) {
      this.data.push(trans);
    } else {
      console.log('[Error] Invalid Transfer');
    }
  }

  broadcast(action) {
    this.peers.forEach(peer => {
      this.send(action, peer.port, peer.address);
    })
  }

  isEqualObject(obj1, obj2) {
    let key1 = Object.keys(obj1);
    let key2 = Object.keys(obj2);
    if(key1.length !== key2.length) return false;
    return key1.every(key => obj1[key] === obj2[key]);
  }

  addPeers(newPeers) {
    // add new peer if it is not in peers
    newPeers.forEach(newPeer => {
      if(!this.peers.find(oldPeer => this.isEqualObject(newPeer, oldPeer))) {
        this.peers.push(newPeer);
      }
    })
  }

  bindExit() {
    process.on('exit', () => {
      console.log('Bye')
    })
  }

  getLastBlock() {
    return this.blockChain[this.blockChain.length - 1];
  }

  transfer(from, to, amount) {
    let timestamp = new Date().getTime();
    // signature
    let signature = rsa.sign({from, to, amount, timestamp});
    let sigTrans = {from, to, amount, timestamp, signature};

    if(from !== '0') {
      let balance = this.balance(from);
      if(balance < amount) {
        console.log("[Message] Not enough balance.", from, balance, amount);
        return;
      }
      this.broadcast({
        type: 'trans',
        data: sigTrans
      });
    }

    this.data.push(sigTrans);
    return sigTrans;
  }

  balance(address) {
    let balance = 0;
    this.blockChain.forEach(block => {
      if(Array.isArray(block.data)) {
        block.data.forEach(trans => {
          if(address === trans.from) {
            balance -= trans.amount;
          }
          if(address === trans.to) {
            balance += trans.amount;
          }
        })
      }
    });
    return balance;
  }

  isValidTrans(transObj) {
    // address is public key
    return rsa.verify(transObj, transObj.from);
  }

  mine(address) {
    // if(!this.data.every(v => {
    //   this.isValidTrans(v);
    // })) {
    //   console.log('Invalid transfer');
    //   return;
    // }
    // filter invalid transfer
    this.data = this.data.filter(v => this.isValidTrans(v));
    // get 100 for each mine
    this.transfer('0', address, 100);
    let newBlock = this.generateNewBlock();

    if(this.isValidBlock(newBlock) && this.isValidChain()) {
      this.blockChain.push(newBlock);
      this.data = [];
      console.log('[Message] Mine Success');
      this.broadcast({
        type: 'mine',
        data: newBlock
      });
    } else {
      console.log('[Error] Invalid Block', newBlock);
    }
    return newBlock;
  }

  generateNewBlock() {
    let nounce = 0;
    let index = this.blockChain.length;
    let data = this.data;
    let prevHash = this.getLastBlock().hash;
    let timestamp = new Date().getTime();
    let hash = this.computeHash(index, prevHash, timestamp, data, nounce);
    while(hash.slice(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
      hash = this.computeHash(index, prevHash, timestamp, data, ++nounce);
    }
    return {
      index,
      data,
      prevHash,
      timestamp,
      nounce,
      hash
    }; 

  }

  computeHash(index, prevHash, timestamp, data, nounce) {
    return crypto.createHash('sha256').update(index + prevHash + timestamp + data + nounce).digest('hex');
  }

  computeHashForBlock({index, prevHash, timestamp, data, nounce}) {
    return this.computeHash(index, prevHash, timestamp, data, nounce);
  }

  isValidBlock(block, lastBlock = this.getLastBlock()) {
    if(block.index === lastBlock.index + 1 && 
      block.timestamp > lastBlock.timestamp && 
      block.prevHash === lastBlock.hash &&
      block.hash.slice(0, this.difficulty) === '0'.repeat(this.difficulty) &&
      block.hash === this.computeHashForBlock(block)) return true;
    return false;
  }

  isValidChain(chain = this.blockChain) {
    if(JSON.stringify(chain[0]) !== JSON.stringify(initBlock)) {
      return false;
    } 

    for(let i = chain.length - 1; i >= 1; i--) {
      if(!this.isValidBlock(chain[i], chain[i - 1])) {
        return false;
      }
    }
    
    return true;
  }

  replaceChain(newChain) {
    if(newChain.length == 1) return;
    if(this.isValidChain(newChain) && newChain.length > this.blockChain.length) {
      this.blockChain = JSON.parse(JSON.stringify(newChain));
    } else {
      console.log('[Error] invalid chain');
    }
  }

  replaceTrans(newTrans) {
    if(newTrans.every(v => this.isValidTrans(v))) {
      this.data = newTrans;
    }
  }
}

module.exports = BlockChain;
