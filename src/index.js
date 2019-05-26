/*
* @Author: tino
* @Date:   2019-05-24 17:34:50
* @Last Modified by:   Zihao Tao
* @Last Modified time: 2019-05-25 20:34:35
*/
const vorpal = require('vorpal')();
const BlockChain = require('./block-chain');
const Table = require('cli-table');
const blockChain = new BlockChain();
const rsa = require('./rsa');


function formatLog(data) {
  if(!data || data.length === 0) return;
  if(!Array.isArray(data)) {
    data = [data];
  }

  let first = data[0];
  let head = Object.keys(first);
  let table = new Table({
    head: head,
    colWidths: new Array(head.length).fill(15)
  });
  let res = data.map((pair) => {
    return head.map((key => JSON.stringify(pair[key], null, 1)));
  })
  table.push(...res);
  console.log(table.toString());
}

vorpal
  .command('balance', 'Check balance')
  .action(function(args, callback){
            let balance = blockChain.balance(rsa.keys.pub);
            if(balance) {
              formatLog({address: rsa.keys.pub, balance});
            }
            callback();
          });

vorpal
  .command('pub', 'Check local address')
  .action(function(args, callback){
            console.log(rsa.keys.pub);
            callback();
          });

vorpal
  .command('detail <index>', 'Show block detail')
  .action(function(args, callback){
            let block = blockChain.blockChain[args.index];
            this.log(JSON.stringify(block, null, 2));
            callback();
          });

vorpal
  .command('mine', 'Generate a new block')
  .action(function(args, callback){
            let newBlock = blockChain.mine(rsa.keys.pub);
            if(newBlock) {
              formatLog(newBlock);
            }
            callback();
          });

vorpal
  .command('blockChain', 'Show chain')
  .action(function(args, callback){
            formatLog(blockChain.blockChain);
            callback();
          });

vorpal
  .command('peers', 'Show peer list')
  .action(function(args, callback){
            formatLog(blockChain.peers);
            callback();
          });


vorpal
  .command('trans <to> <amount>', 'Make a transfer')
  .action(function(args, callback){
            let trans = blockChain.transfer(rsa.keys.pub, args.to, args.amount);
            if(trans) formatLog(trans);
            callback();
          });

vorpal
  .command('chat <msg>', 'Send broadcast')
  .action(function(args, callback){
            formatLog(blockChain.broadcast({
              type: 'hi',
              data: args.msg
            }));
            callback();
          });

vorpal
  .command('pending', 'Show pending transfer')
  .action(function(args, callback){
            formatLog(blockChain.data);
            callback();
          });

vorpal.exec('help');
vorpal.delimiter('Chain => ').show();