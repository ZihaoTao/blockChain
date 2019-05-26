/*
* @Author: tino
* @Date:   2019-05-24 16:22:49
* @Last Modified by:   Zihao Tao
* @Last Modified time: 2019-05-26 11:41:08
*/
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
    // data of pending transaction
    this.data = [];
    // difficulty of solving question to finish mining
    this.difficulty = 4;
    this.peers = [];
    // record the last remote address
    this.remote = '';
    // seed node info
    this.seed = {address: '47.254.23.123', port: 8002}; // server host
    // udp socket
    this.udp = dgram.createSocket('udp4');
    this.init();
  }

  // initiate p2p connection
  init() {
    this.bindP2p();
    this.bindExit();
  }
  
  // build p2p connection
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
  
  // add node to p2p
  startNode(port) {
    this.udp.bind(port);
    // if it is not a seed node
    if(port !== 8002) {
      this.send({
        type: 'newPeer'
      }, this.seed.port, this.seed.address);
      // add seed node to peer list
      this.peers.push(this.seed);
    }
  }

  // p2p send JSON
  send(message, port, address) {
    this.udp.send(JSON.stringify(message), port, address);
  }

  // based on the type of msg, do different things
  dispatch(action, remote) {
    switch(action.type) {
      // add new peer
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
      // replace old chain and transfers
      case 'blockChain':
        let allData = JSON.parse(action.data);
        let newChain = allData.blockChain;
        let newTrans = allData.trans;
        this.replaceChain(newChain);
        this.replaceTrans(newTrans);
        break;
      // save remote address
      case 'remoteAddress':
        this.remote = action.data;
        break;
      //add new peers to peer list
      case 'peerList': 
        let newPeers = action.data;
        this.addPeers(newPeers);
        break;
      // say hi to the new peer
      case 'sayHi': 
        let remotePeer = action.data;
        this.peers.push(remotePeer);
        console.log('[Message] Add new peer: ' + JSON.stringify(remotePeer));
        this.send({
          type: 'hi',
          data: 'Hi'
        }, remotePeer.port, remotePeer.address);
        break;
      // log hi
      case 'hi':
        console.log(`[Message] ${remote.address}:${remote.port} : ${action.data}`); 
        break;
      // mine and finish pending transfer
      case 'mine':
        // if the new msg is same as the old one, return
        if(this.getLastBlock().hash === action.data.hash) {
          return;
        }
        // if the new block is valid
        if(this.isValidBlock(action.data)) {
          console.log(`[Message] Someone made a successful mining.`);
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

  // add new transfer information to data
  addTrans(trans) {
    if(this.isValidTrans(trans)) {
      this.data.push(trans);
    } else {
      console.log('[Error] Invalid Transfer');
    }
  }

  // send msg to all peers in the peer list
  broadcast(action) {
    this.peers.forEach(peer => {
      this.send(action, peer.port, peer.address);
    })
  }

  // check if two objs are equal
  isEqualObject(obj1, obj2) {
    let key1 = Object.keys(obj1);
    let key2 = Object.keys(obj2);
    if(key1.length !== key2.length) return false;
    return key1.every(key => obj1[key] === obj2[key]);
  }

  // add peer to peer list
  addPeers(newPeers) {
    // add new peer if it is not in peers
    newPeers.forEach(newPeer => {
      if(!this.peers.find(oldPeer => this.isEqualObject(newPeer, oldPeer))) {
        this.peers.push(newPeer);
      }
    })
  }
  
  // log info before exit
  bindExit() {
    process.on('exit', () => {      
      console.log('Bye');
    });
  }
  
  // get the last block of the block chain
  getLastBlock() {
    return this.blockChain[this.blockChain.length - 1];
  }

  // transfer money to another based on the public key
  transfer(from, to, amount) {
    let timestamp = new Date().getTime();
    // signature
    let signature = rsa.sign({from, to, amount, timestamp});
    let sigTrans = {from, to, amount, timestamp, signature};
    // not from mining
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
  
  // check balance of your account
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
  
  // use signature and public key to check if it is valid
  isValidTrans(transObj) {
    // address is public key
    return rsa.verify(transObj, transObj.from);
  }
  
  //mining, eachtime get 100
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
  
  // a new block, when the prefix of hash is repeating 0
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
  
  // compute hash based on the parameters
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
  
  // every blocks is valid
  isValidChain(chain = this.blockChain) {
    if(JSON.stringify(chain[0]) !== JSON.stringify(initBlock)) {
      return false;
    } 
    // check block from tail to head
    for(let i = chain.length - 1; i >= 1; i--) {
      if(!this.isValidBlock(chain[i], chain[i - 1])) {
        return false;
      }
    }
    
    return true;
  }
  
  // update chain
  replaceChain(newChain) {
    // if it is init block
    if(newChain.length == 1) return;
    if(this.isValidChain(newChain) && newChain.length > this.blockChain.length) {
      this.blockChain = JSON.parse(JSON.stringify(newChain));
    } else {
      console.log('[Error] invalid chain');
    }
  }
  
  // update data
  replaceTrans(newTrans) {
    if(newTrans.every(v => this.isValidTrans(v))) {
      this.data = newTrans;
    }
  }
}

module.exports = BlockChain;
