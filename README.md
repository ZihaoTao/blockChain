# blockChain
BlockChain by Node.js

### Installation
1. nodejs(6.14.1)
* website:https://nodejs.org/en/download/releases/
```
> wget https://nodejs.org/download/release/v6.14.1/node-v6.14.1-linux-x64.tar.gz
```
* unzip to this directory
```
> tar -zxvf node-v6.14.1-linux-x64.tar.gz -C /usr/local/
```
* add environment variables
```
> vim /etc/profile
add:
export NODE_HOME=/usr/local/node-v6.14.1-linux-x64
export PATH=$NODE_HOME/bin:$PATH
```
* source file
```
> source /etc/profile
```

2. initialization  
> cd blockChain  
> npm install

3. run    
> npm run dev  
OR  
> npm run dev &lt;port&gt;

### Commands:

    help [command...]    Provides help for a given command.
    exit                 Exits application.
    balance              Check balance.
    pub                  Check local address.
    detail <index>       Show block detail.
    mine                 Generate a new block.
    blockChain           Show chain.
    peers                Show peer list.
    trans <to> <amount>  Make a transfer. <to> receiver address  <amount> value
    chat <msg>           Send broadcast.
    pending              Show pending transfer.